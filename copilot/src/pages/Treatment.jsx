import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { API_BASE_URL } from '../config';
import { useTracking } from '../context/TrackingContext';

const mapContainerStyle = { width: '100%', height: '100%', minHeight: '500px', borderRadius: '0.75rem' };
const getApiUrl = (path) => `${API_BASE_URL}${path}`;

// Real-world coordinates for the 4 vendor shops, used to draw the equipment delivery route
const SHOP_LOCATIONS = {
  'SHOP-001': { lat: 12.8898, lng: 77.4519 }, // Kumbalgodu, Bengaluru
  'SHOP-002': { lat: 12.9081, lng: 77.4835 }, // Kengeri, Bengaluru
  'SHOP-003': { lat: 12.8004, lng: 77.5773 }, // Bannerghatta, Bengaluru
  'SHOP-004': { lat: 12.8763, lng: 77.6031 }, // Tavarekere, Bengaluru
};
// Default farmer field location shown on the map
const FARMER_FIELD_LOCATION = { lat: 12.8398, lng: 77.5192 }; // Kaggalipura, Bengaluru

// Simulated delivery duration for the demo tracking map (kept in sync with the backend's DELIVERY_DURATION_MS)
const DELIVERY_DURATION_MS = 2 * 60 * 1000; // 2 minutes

const getCropEmoji = (crop) => ({
  Tomato: '🍅', Potato: '🥔', Wheat: '🌾', Rice: '🌾', Cotton: '☁️',
  Grape: '🍇', Maize: '🌽', Chilli: '🌶️', Mango: '🥭', Onion: '🧅', Soybean: '🫘', General: '🌱',
}[crop] || '🌱');

export default function Treatment() {
  const [searchParams] = useSearchParams();
  const [diseases, setDiseases] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState('');
  const [diseaseFreeText, setDiseaseFreeText] = useState('');
  const [cropName, setCropName] = useState('');
  const [result, setResult] = useState(null);
  const [shops, setShops] = useState([]);
  const [nearestTenOnly, setNearestTenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopSource, setShopSource] = useState('');
  const [userLocation, setUserLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [selectedShop, setSelectedShop] = useState(null);
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState(null);
  const [advisoryProducts, setAdvisoryProducts] = useState([]);
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [equipTrack, setEquipTrack] = useState(null); // { reqId, machine, owner, shopName, bookedAtMs } when tracking equipment delivery
  const [equipDriverPos, setEquipDriverPos] = useState(null);
  const [equipArrived, setEquipArrived] = useState(false);
  const [vendorShopCoords, setVendorShopCoords] = useState(null); // { shopId: {lat,lng} }, real GPS from the vendor shop registry
  const equipPathRef = useRef([]);
  const mapRef = useRef(null);
  const autoSearchDone = useRef(false);
  const dropdownRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBxvrTZazeyOivBPdZFKC6oYV2ycRTnsqo'
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fc_advisory_products');
      if (stored) {
        setAdvisoryProducts(JSON.parse(stored));
      }
    } catch (e) { }
  }, []);

  // Poll active order status
  useEffect(() => {
    if (!activeOrder?.id) return;
    const interval = setInterval(() => {
      axios.get(getApiUrl('/api/vendor/orders'))
        .then(res => {
          if (res.data.success) {
            const updated = res.data.data.find(o => o.id === activeOrder.id);
            if (updated && updated.status !== activeOrder.status) {
              setActiveOrder(updated);
            }
          }
        }).catch(() => { });
    }, 3000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  const handleRequestStock = async (product) => {
    try {
      const res = await axios.post(getApiUrl('/api/vendor/orders'), {
        farmerName: 'Harsh (Farmer)',
        farmerPhone: '+91 98765 43210',
        location: 'Kumbalgodu, Bengaluru',
        shopName: 'SHREE AGRO SUPPLIERS',
        items: [{
          id: product.id || 'P-ITEM',
          name: product.name || product.pesticide,
          category: product.category || 'chemical',
          price: product.price || 350,
          qty: 1
        }]
      });
      if (res.data.success) {
        setActiveOrder(res.data.data);
      }
    } catch (err) {
      console.error("Order request failed:", err);
    }
  };

  useEffect(() => {
    axios.get(getApiUrl('/api/treatment/diseases'))
      .then(res => { if (res.data.success) setDiseases(res.data.data); })
      .catch(err => console.error('Failed to load diseases:', err));
  }, []);

  useEffect(() => { fetchNearbyShops(); }, []);

  // Click-outside to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Read query param and auto-search
  useEffect(() => {
    const diseaseFromUrl = searchParams.get('disease');
    if (diseaseFromUrl && !autoSearchDone.current) {
      setDiseaseFreeText(diseaseFromUrl);
      setSelectedDisease('');
      autoSearchDone.current = true;
      setTimeout(() => handleSubmitWithName(diseaseFromUrl), 300);
    }
  }, [searchParams]);


  const getFallbackShops = (baseLat, baseLng) => {
    const lat = parseFloat(baseLat) || 12.9716;
    const lng = parseFloat(baseLng) || 77.5946;
    const p = Math.PI / 180;
    const rawShops = [
      {
        name: "Shree Agro Suppliers",
        address: "Main Market Road, Near Bus Stand, Kumbalgodu, Bengaluru",
        rating: 4.6,
        phone: "+91 98765 43210",
        location: { lat: lat + 0.008, lng: lng + 0.006 },
        availability: "In Stock"
      },
      {
        name: "Sri Chamundeshwari Fertilizers",
        address: "Station Road, Opposite SBI Bank, Kengeri, Bengaluru",
        rating: 4.4,
        phone: "+91 99887 76655",
        location: { lat: lat - 0.007, lng: lng + 0.012 },
        availability: "In Stock"
      },
      {
        name: "Hassan Agro Bio Tech",
        address: "NH-48, Agricultural Market Yard, Bannerghatta, Bengaluru",
        rating: 4.5,
        phone: "+91 97766 55443",
        location: { lat: lat + 0.012, lng: lng - 0.009 },
        availability: "Limited Stock"
      },
      {
        name: "Venkateshwara Krishi Kendra",
        address: "Tavarekere Main Road, Near bus stand, Tavarekere, Bengaluru",
        rating: 4.6,
        phone: "+91 96655 44332",
        location: { lat: lat + 0.005, lng: lng - 0.012 },
        availability: "In Stock"
      }
    ];

    return rawShops.map(shop => {
      const a = 0.5 - Math.cos((shop.location.lat - lat) * p)/2 + 
                Math.cos(lat * p) * Math.cos(shop.location.lat * p) * 
                (1 - Math.cos((shop.location.lng - lng) * p))/2;
      const d = 12742 * Math.asin(Math.sqrt(a));
      return {
        ...shop,
        distanceVal: d,
        distance: d.toFixed(1) + " km"
      };
    }).filter(shop => shop.distanceVal <= 15.0).sort((a, b) => a.distanceVal - b.distanceVal);
  };

  const resetMap = () => {
    setSelectedShop(null);
    setDirections(null);
    setRouteInfo(null);
  };

  const fetchNearbyShops = (forceGps = false) => {
    resetMap();
    setShopLoading(true);

    const loadShops = (lat, lng) => {
      setUserLocation({ lat, lng });
      axios.get(getApiUrl(`/api/treatment/nearby-shops?lat=${lat}&lng=${lng}`))
        .then(res => {
          if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
            setShops(res.data.data);
            setShopSource(res.data.source);
            // Auto-sync nearest 10 shops into the vendor portal's Active Store
            // Context list. Fire-and-forget: never blocks the farmer's map.
            axios.post(getApiUrl('/api/vendor/sync-shops'), { shops: res.data.data.slice(0, 10) }).catch(() => {});
          } else {
            setShops(getFallbackShops(lat, lng));
          }
        })
        .catch(() => setShops(getFallbackShops(lat, lng)))
        .finally(() => setShopLoading(false));
    };

    const fallbackToBackendIp = () => {
      axios.get(getApiUrl('/api/treatment/ip-location'))
        .then(ipRes => {
          if (ipRes.data && ipRes.data.lat && ipRes.data.lng) {
            loadShops(ipRes.data.lat, ipRes.data.lng);
          } else {
            loadShops(userLocation.lat || 12.8006, userLocation.lng || 77.5084);
          }
        })
        .catch(() => loadShops(userLocation.lat || 12.8006, userLocation.lng || 77.5084));
    };

    if (forceGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadShops(pos.coords.latitude, pos.coords.longitude),
        () => fallbackToBackendIp(),
        { enableHighAccuracy: true, timeout: 6000 }
      );
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadShops(pos.coords.latitude, pos.coords.longitude),
        () => fallbackToBackendIp(),
        { enableHighAccuracy: false, timeout: 3000 }
      );
    } else {
      fallbackToBackendIp();
    }
  };

  const handleSubmitWithName = async (diseaseName) => {
    if (!diseaseName) return;
    setLoading(true); setResult(null);
    try {
      const res = await axios.post(getApiUrl('/api/treatment'), { disease_name: diseaseName, crop_name: cropName });
      setResult(res.data.data);
    } catch { setResult({ found: false, message: 'Error fetching recommendation. Please try again.' }); }
    finally { setLoading(false); }
  };

  const handleSubmit = () => handleSubmitWithName(selectedDisease || diseaseFreeText);

  const handleShopSelect = useCallback((shop) => {
    setSelectedShop(shop);
    if (!shop?.location || !isLoaded || !window.google) { setDirections(null); setRouteInfo(null); return; }
    new window.google.maps.DirectionsService().route({
      origin: userLocation,
      destination: { lat: shop.location.lat, lng: shop.location.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
    }, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        setDirections(result);
        const leg = result.routes[0].legs[0];
        setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text, durationInTraffic: leg.duration_in_traffic?.text || null });
      } else { setDirections(null); setRouteInfo(null); }
    });
  }, [userLocation, isLoaded]);

  const handleCloseInfoWindow = () => { setSelectedShop(null); setDirections(null); setRouteInfo(null); };

  const openInGoogleMaps = (shop) => {
    if (!shop?.location) return;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${shop.location.lat},${shop.location.lng}&travelmode=driving`, '_blank');
  };

  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Auto-route to vendor shop when navigating from Orders page with ?routeShop=ShopName
  const routeShopDone = useRef(false);
  useEffect(() => {
    const routeShopName = searchParams.get('routeShop');
    if (!routeShopName || routeShopDone.current || shops.length === 0 || !isLoaded) return;

    // Find matching shop by name (case-insensitive partial match)
    const targetShop = shops.find(s =>
      s.name.toLowerCase().includes(routeShopName.toLowerCase()) ||
      routeShopName.toLowerCase().includes(s.name.toLowerCase())
    );

    if (targetShop) {
      routeShopDone.current = true;
      // Delay slightly to ensure map is ready
      setTimeout(() => {
        handleShopSelect(targetShop);
        // Scroll to the map section
        const mapSection = document.getElementById('treatment-map-section');
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 600);
    }
  }, [searchParams, shops, isLoaded, handleShopSelect]);

  // Real GPS location for every vendor shop (demo + auto-synced real ones), used as the
  // route's starting point instead of guessing — loaded once, before tracking begins.
  const [shopCoordsLoaded, setShopCoordsLoaded] = useState(false);
  useEffect(() => {
    axios.get(getApiUrl('/api/vendor/shops'))
      .then(res => {
        if (res.data.success) {
          const map = {};
          for (const s of res.data.data) {
            if (s.coords) map[s.id] = s.coords;
          }
          setVendorShopCoords(map);
        }
      })
      .catch(() => {})
      .finally(() => setShopCoordsLoaded(true));
  }, []);

  // Delivery tracking — reached from either the Equipment page's "Track" button (?trackEquip=...)
  // or the Orders page's "Track vendor-to-you route" button (?trackOrder=...), both &shopId=...&bookedAt=...
  const { tracking: globalTracking, startTracking, stopTracking: stopGlobalTracking } = useTracking();
  const equipTrackDone = useRef(false);
  useEffect(() => {
    if (equipTrackDone.current || !isLoaded || !window.google || !shopCoordsLoaded) return;

    const equipReqId = searchParams.get('trackEquip');
    const orderId = searchParams.get('trackOrder');
    const trackId = equipReqId || orderId;
    const shopId = searchParams.get('shopId');

    let trackInfo = null;

    if (trackId && shopId) {
      // Fresh "Track" click from Orders/Equipment — build tracking info from the
      // URL, and push it into the shared context so it survives page switches.
      const isOrder = !!orderId;
      const bookedAt = searchParams.get('bookedAt');
      const destLat = parseFloat(searchParams.get('destLat'));
      const destLng = parseFloat(searchParams.get('destLng'));
      const hasRealDestination = isOrder && !isNaN(destLat) && !isNaN(destLng);
      trackInfo = {
        id: trackId,
        type: isOrder ? 'order' : 'equipment',
        shopId,
        label: isOrder ? `Order ${orderId}` : (searchParams.get('machine') || 'Equipment'),
        agent: isOrder ? (searchParams.get('shopName') || 'Vendor') : (searchParams.get('owner') || ''),
        shopName: searchParams.get('shopName') || '',
        bookedAtMs: bookedAt ? new Date(bookedAt).getTime() : Date.now(),
        destination: hasRealDestination ? { lat: destLat, lng: destLng } : FARMER_FIELD_LOCATION,
      };
      startTracking(trackInfo);
    } else if (globalTracking) {
      // Landing on this page while a delivery is already being tracked from
      // another page — pick up right where it really is (real elapsed time).
      trackInfo = globalTracking;
    }

    if (!trackInfo) return;
    equipTrackDone.current = true;

    setEquipTrack(trackInfo);

    const origin = (vendorShopCoords && vendorShopCoords[trackInfo.shopId]) || SHOP_LOCATIONS[trackInfo.shopId] || SHOP_LOCATIONS['SHOP-001'];
    const destination = trackInfo.destination || FARMER_FIELD_LOCATION;

    new window.google.maps.DirectionsService().route({
      origin,
      destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        setDirections(result);
        const leg = result.routes[0].legs[0];
        setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text });
        equipPathRef.current = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
        setEquipDriverPos(equipPathRef.current[0] || origin);
      }
    });

    setTimeout(() => {
      const mapSection = document.getElementById('treatment-map-section');
      if (mapSection) mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, [searchParams, isLoaded, globalTracking, startTracking, shopCoordsLoaded, vendorShopCoords]);

  // Move the equipment marker based on real elapsed time since booking (not a local counter), so the
  // "delivery" keeps progressing in the background — closing/reopening this page just resumes correctly.
  // Fit map bounds to show user location and all shops within 10 km
  useEffect(() => {
    if (mapRef.current && window.google && shops.length > 0 && !equipTrack) {
      try {
        const bounds = new window.google.maps.LatLngBounds();
        if (userLocation?.lat && userLocation?.lng) {
          bounds.extend(new window.google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        shops.forEach(shop => {
          if (shop.location?.lat && shop.location?.lng) {
            bounds.extend(new window.google.maps.LatLng(shop.location.lat, shop.location.lng));
          }
        });
        mapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      } catch (e) {
        console.error("Failed to fit map bounds:", e);
      }
    }
  }, [shops, userLocation, equipTrack, isLoaded]);

  useEffect(() => {
    if (!equipTrack || !equipPathRef.current.length) return;
    const tick = () => {
      const elapsed = Date.now() - equipTrack.bookedAtMs;
      const fraction = Math.min(1, Math.max(0, elapsed / DELIVERY_DURATION_MS));
      const path = equipPathRef.current;
      const index = Math.min(path.length - 1, Math.floor(fraction * (path.length - 1)));
      setEquipDriverPos(path[index]);
      setEquipArrived(fraction >= 1);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [equipTrack, directions]);

  const renderStars = (rating) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[...Array(5)].map((_, i) => (
        <span key={i} style={{ fontSize: '11px', color: i < Math.floor(rating) ? '#facc15' : 'rgba(255,255,255,0.15)' }}>★</span>
      ))}
      <span style={{ fontSize: '11px', color: '#666', marginLeft: '4px' }}>{rating}</span>
    </div>
  );

  /* ─── Inline styles matching the Home page glass panel system ─── */
  const glassPanel = {
    backgroundColor: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    overflow: 'hidden',
    position: 'relative',
  };

  const activeDiseaseName = selectedDisease || diseaseFreeText;
  const displayLabel = diseaseFreeText
    ? diseaseFreeText
    : selectedDisease
      ? diseases.find(d => d.key === selectedDisease)?.label || selectedDisease
      : '';

  // Shops are already sorted nearest-first by the backend, so "nearest 5" is just the first 5
  const displayedShops = nearestTenOnly ? shops.slice(0, 10) : shops;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px', paddingBottom: '60px' }}>

      {/* ═══ TREATMENT FINDER PANEL ═══ */}
      <div style={{
        ...glassPanel,
        padding: '28px',
        maxWidth: '640px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(139,92,246,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {/* Top bar — window dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#444', fontFamily: 'monospace', letterSpacing: '0.5px' }}>treatment-finder</span>
        </div>

        {/* Dropdown selector */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => { if (!diseaseFreeText) setDropdownOpen(!dropdownOpen); }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: '10px',
              padding: '12px 16px',
              border: `1px solid ${diseaseFreeText ? 'rgba(34,197,94,0.3)' : dropdownOpen ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: diseaseFreeText ? 'default' : 'pointer',
              transition: 'border-color 0.3s',
            }}
          >
            {diseaseFreeText ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14px' }}>🧠</span>
                <span style={{ fontSize: '14px', color: '#6ee7b7', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{diseaseFreeText}</span>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)', padding: '2px 8px', borderRadius: '100px', border: '1px solid rgba(52,211,153,0.2)', flexShrink: 0 }}>AI</span>
              </div>
            ) : displayLabel ? (
              <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>
                {getCropEmoji(diseases.find(d => d.key === selectedDisease)?.crop)} {displayLabel}
              </span>
            ) : (
              <span style={{ fontSize: '14px', color: '#555' }}>Select crop & disease…</span>
            )}

            {diseaseFreeText ? (
              <button
                onClick={(e) => { e.stopPropagation(); setDiseaseFreeText(''); setSelectedDisease(''); setResult(null); }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#666', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}
              >✕</button>
            ) : (
              <span style={{ color: '#555', fontSize: '12px' }}>▼</span>
            )}
          </div>

          {/* Custom dropdown list */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
              backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)', maxHeight: '240px', overflowY: 'auto', padding: '4px 0',
            }}>
              {diseases.map(d => (
                <div
                  key={d.key}
                  onClick={() => { setSelectedDisease(d.key); setCropName(d.crop); setDropdownOpen(false); setResult(null); handleSubmitWithName(d.key); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
                    color: selectedDisease === d.key ? '#e2e8f0' : '#888',
                    backgroundColor: selectedDisease === d.key ? 'rgba(255,255,255,0.04)' : 'transparent',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = selectedDisease === d.key ? 'rgba(255,255,255,0.04)' : 'transparent'; e.currentTarget.style.color = selectedDisease === d.key ? '#e2e8f0' : '#888'; }}
                >
                  <span style={{ fontSize: '16px' }}>{getCropEmoji(d.crop)}</span>
                  <span style={{ fontWeight: 500 }}>{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Find Treatment button (only when no auto-search was triggered) */}
        {!result && !loading && activeDiseaseName && !diseaseFreeText && (
          <button
            onClick={handleSubmit}
            disabled={loading || !activeDiseaseName}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            Find Treatment <span style={{ opacity: 0.5 }}>→</span>
          </button>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2].map(i => (
              <div key={i} style={{
                backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '10px',
                padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="shimmer" style={{ height: '14px', width: i === 1 ? '160px' : '200px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ height: '10px', width: '80px', borderRadius: '4px' }} />
                </div>
                <div className="shimmer" style={{ height: '22px', width: '64px', borderRadius: '100px' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── AI Advisory Recommended Branded Products Section ── */}
        {advisoryProducts.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(139,92,246,0.06)', borderRadius: '12px',
            padding: '14px 16px', border: '1px solid rgba(139,92,246,0.2)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', width: '100%' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.3px' }}>
                🌾 AI Diagnosis Recommended Products ({advisoryProducts.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {advisoryProducts.map(prod => (
                <div key={prod.id} style={{
                  backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                  padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>{prod.name}</div>
                    <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginBottom: '4px' }}>{prod.activeIngredient}</div>
                    {prod.dosage && <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Dose: {prod.dosage}</div>}
                    <button
                      type="button"
                      onClick={() => setSelectedInstruction({
                        name: prod.name,
                        dosage: prod.dosage,
                        category: prod.category,
                        precautions: prod.whyThis,
                        application: `Apply ${prod.name} (${prod.activeIngredient}) as directed for crop protection.`
                      })}
                      className="instruction-btn"
                      style={{ marginTop: '8px' }}
                    >
                      📖 Usage Instructions
                    </button>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>₹{prod.price}</span>
                    <div style={{
                      fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase',
                      backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                      padding: '2px 8px', borderRadius: '100px', marginTop: '4px', display: 'inline-block'
                    }}>{prod.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recommendation Cards (mockup style) ── */}
        {result && result.found && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Primary */}
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '10px',
              padding: '14px 16px', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'border-color 0.2s, background 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)'; }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '3px' }}>{result.pesticide}</div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Dose: {result.dosage}</div>
                <button
                  type="button"
                  onClick={() => setSelectedInstruction({
                    name: result.pesticide,
                    dosage: result.dosage,
                    category: result.category || 'Pesticide / Fungicide',
                    precautions: result.precautions,
                    application: result.application
                  })}
                  className="instruction-btn"
                >
                  📖 Usage Instructions
                </button>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 700, color: '#a78bfa',
                backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                padding: '3px 10px', borderRadius: '100px', textTransform: 'capitalize',
              }}>{result.category}</span>
            </div>

            {/* Alternative */}
            {result.alternative && (
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '10px',
                padding: '14px 16px', border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'border-color 0.2s, background 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)'; }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '3px' }}>{result.alternative}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Dose: {result.altDosage}</div>
                  <button
                    type="button"
                    onClick={() => setSelectedInstruction({
                      name: result.alternative,
                      dosage: result.altDosage,
                      category: result.category || 'Pesticide / Fungicide',
                      precautions: result.precautions,
                      application: result.application
                    })}
                    className="instruction-btn"
                  >
                    📖 Usage Instructions
                  </button>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: '#818cf8',
                  backgroundColor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
                  padding: '3px 10px', borderRadius: '100px', textTransform: 'capitalize',
                }}>{result.category}</span>
              </div>
            )}

            {/* Precautions */}
            {result.precautions && (
              <div style={{
                backgroundColor: 'rgba(234,179,8,0.04)', borderRadius: '10px',
                padding: '12px 16px', border: '1px solid rgba(234,179,8,0.12)',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <span style={{ fontSize: '14px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#eab308', letterSpacing: '0.5px', marginBottom: '3px' }}>PRECAUTIONS</div>
                  <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.6 }}>{result.precautions}</div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Not found */}
        {result && !result.found && (
          <div style={{
            backgroundColor: 'rgba(234,179,8,0.05)', borderRadius: '10px',
            padding: '14px 16px', border: '1px solid rgba(234,179,8,0.15)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#eab308' }}>No Match Found</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{result.message}</div>
            </div>
          </div>
        )}

        {/* Green shops banner */}
        {!shopLoading && shops.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: 'rgba(34,197,94,0.06)', borderRadius: '10px',
            padding: '12px 16px', border: '1px solid rgba(34,197,94,0.15)',
          }}>
            <span style={{ fontSize: '18px' }}>📍</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80' }}>
                {nearestTenOnly
                  ? `Showing ${displayedShops.length} nearest of ${shops.length} shops (within 10 km)`
                  : `${shops.length} shops nearby (within 10 km)`}
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                {displayedShops.slice(0, 3).map(s => s.name).join(' · ')}{displayedShops.length > 3 ? ' …' : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MAP & SHOP LIST ═══ */}
      <div id="treatment-map-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
              {equipTrack
                ? (equipArrived ? `✅ Arrived — ${equipTrack.label}` : `${equipTrack.type === 'order' ? '📦' : '🚜'} Tracking ${equipTrack.id} — ${equipTrack.label}`)
                : '🏪 Nearby Agri Shops'}
            </h2>
            <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0' }}>
              {equipTrack
                ? (equipArrived
                  ? `${equipTrack.agent} has reached your location. An SMS has been sent to your phone.`
                  : `${equipTrack.agent} is on the way from ${equipTrack.shopName}${routeInfo ? ` · ${routeInfo.distance} · ETA ${routeInfo.duration}` : ''} · keeps moving even if you leave this page`)
                : 'Click a shop to see the driving route'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {equipTrack && (
              <button onClick={() => { setEquipTrack(null); setDirections(null); setRouteInfo(null); setEquipDriverPos(null); setEquipArrived(false); stopGlobalTracking(); }} style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                color: '#888', fontSize: '12px', fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
              }}>✕ Stop Tracking</button>
            )}
            <button onClick={() => fetchNearbyShops(true)} style={{
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px',
              color: '#60a5fa', fontSize: '12px', fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'; }}
            >📍 Detect My Location</button>

            <button
              onClick={() => setNearestTenOnly(v => !v)}
              title="Show only the 10 closest agri shops"
              style={{
                background: nearestTenOnly ? 'rgba(74,222,128,0.15)' : 'none',
                border: nearestTenOnly ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: nearestTenOnly ? '#4ade80' : '#888',
                fontSize: '12px', fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >🎯 Nearest 10 Shops</button>

            <button onClick={() => fetchNearbyShops(false)} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
              color: '#888', fontSize: '12px', fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#888'; }}
            >🔄 Refresh</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {/* Map */}
          <div style={{ flex: '1 1 400px', minHeight: '500px', ...glassPanel, padding: '6px' }}>
            {!isLoaded ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px' }}>
                <div className="w-8 h-8 border-3 border-white/10 border-t-white rounded-full animate-spin" />
                <p style={{ color: '#555', marginTop: '12px', fontSize: '13px' }}>Loading Map…</p>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={equipTrack ? ((vendorShopCoords && vendorShopCoords[equipTrack.shopId]) || SHOP_LOCATIONS[equipTrack.shopId] || userLocation) : userLocation}
                  zoom={12}
                  onLoad={onMapLoad}
                  options={{
                    styles: [
                      { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
                      { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
                      { elementType: "labels.text.fill", stylers: [{ color: "#5e5e5e" }] },
                      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
                      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#5e5e5e" }] },
                      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1f2a1f" }] },
                      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4a6a4a" }] },
                      { featureType: "road", elementType: "geometry", stylers: [{ color: "#262626" }] },
                      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
                      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5e5e5e" }] },
                      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#333333" }] },
                      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
                      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
                      { featureType: "water", elementType: "geometry", stylers: [{ color: "#111111" }] },
                      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
                      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] }
                    ],
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {!equipTrack && !directions && <Marker position={userLocation} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />}
                  {!equipTrack && !directions && !shopLoading && displayedShops.map((shop, i) => shop.location && (
                    <Marker key={i} position={{ lat: shop.location.lat, lng: shop.location.lng }} onClick={() => handleShopSelect(shop)} />
                  ))}
                  {directions && (
                    <DirectionsRenderer directions={directions} options={{
                      polylineOptions: { strokeColor: '#4285F4', strokeWeight: 5, strokeOpacity: 0.9 },
                      suppressMarkers: equipTrack ? true : false,
                    }} />
                  )}
                  {equipTrack && (
                    <>
                      <Marker position={(vendorShopCoords && vendorShopCoords[equipTrack.shopId]) || SHOP_LOCATIONS[equipTrack.shopId] || userLocation} label={{ text: '🏬', fontSize: '20px' }} />
                      <Marker position={equipTrack.destination || FARMER_FIELD_LOCATION} label={{ text: '🌾', fontSize: '20px' }} />
                      {equipDriverPos && (
                        <Marker position={equipDriverPos} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png' }} />
                      )}
                    </>
                  )}
                  {selectedShop && !directions && (
                    <InfoWindow position={{ lat: selectedShop.location.lat, lng: selectedShop.location.lng }} onCloseClick={handleCloseInfoWindow}>
                      <div style={{ padding: '4px', maxWidth: '200px' }}>
                        <h4 style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px', color: '#111' }}>{selectedShop.name}</h4>
                        <p style={{ fontSize: '11px', margin: '0 0 4px', color: '#333' }}>{selectedShop.address}</p>
                        <p style={{ fontSize: '11px', margin: 0, color: '#555' }}>{selectedShop.rating || 0} ★ · {selectedShop.distance || 'Unknown'}</p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>

                {/* Equipment tracking overlay — bottom-left compact card */}
                {equipTrack && routeInfo && (
                  <div style={{ position: 'absolute', bottom: '40px', left: '12px', zIndex: 10, width: '240px' }}>
                    <div style={{
                      backgroundColor: 'rgba(17,17,19,0.95)', backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                      padding: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: equipArrived ? '#34d399' : '#f97316', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: '9px', fontWeight: 700, color: equipArrived ? '#34d399' : '#fb923c', letterSpacing: '0.6px' }}>
                          {equipArrived ? 'ARRIVED · SMS SENT' : 'LIVE (SIMULATED)'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{equipTrack.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px' }}>📏</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{routeInfo.distance}</span>
                        </div>
                        {!equipArrived && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px' }}>⏱️</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>ETA {routeInfo.duration}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Route info overlay — bottom-left compact card */}
                {routeInfo && selectedShop && (
                  <div style={{ position: 'absolute', bottom: '40px', left: '12px', zIndex: 10, width: '240px' }}>
                    <div style={{
                      backgroundColor: 'rgba(17,17,19,0.95)', backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                      padding: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'pulse 2s infinite' }} />
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.6px' }}>DRIVING ROUTE</span>
                        </div>
                        <button onClick={handleCloseInfoWindow} style={{ background: 'none', border: 'none', color: '#555', fontSize: '11px', cursor: 'pointer', padding: 0 }}>✕</button>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedShop.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px' }}>📏</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{routeInfo.distance}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px' }}>⏱️</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ccc' }}>{routeInfo.durationInTraffic || routeInfo.duration}</span>
                        </div>
                        {routeInfo.durationInTraffic && routeInfo.durationInTraffic !== routeInfo.duration && (
                          <span style={{ fontSize: '8px', fontWeight: 700, color: '#facc15', backgroundColor: 'rgba(250,204,21,0.1)', padding: '2px 6px', borderRadius: '100px', border: '1px solid rgba(250,204,21,0.2)' }}>🚦</span>
                        )}
                      </div>
                      <button onClick={() => openInGoogleMaps(selectedShop)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '8px', backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: '10px', color: '#60a5fa', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'}
                      >🗺️ Open in Google Maps</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shop list */}
          <div style={{ width: '100%', flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
            {shopLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ ...glassPanel, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="shimmer" style={{ height: '12px', width: '120px', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ height: '12px', width: '100%', borderRadius: '4px' }} />
                  <div className="shimmer" style={{ height: '28px', width: '100%', borderRadius: '6px', marginTop: '4px' }} />
                </div>
              ))
            ) : displayedShops.length > 0 ? (
              displayedShops.map((shop, i) => (
                <div
                  key={i}
                  onClick={() => handleShopSelect(shop)}
                  style={{
                    backgroundColor: selectedShop?.name === shop.name ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${selectedShop?.name === shop.name ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '14px', padding: '16px', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { if (selectedShop?.name !== shop.name) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; } }}
                  onMouseLeave={e => { if (selectedShop?.name !== shop.name) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)'; } }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{shop.name}</h4>
                    {shop.availability && (
                      <span style={{
                        fontSize: '9px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                        color: shop.availability === 'In Stock' ? '#4ade80' : shop.availability === 'Limited Stock' ? '#facc15' : '#888',
                        backgroundColor: shop.availability === 'In Stock' ? 'rgba(74,222,128,0.1)' : shop.availability === 'Limited Stock' ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${shop.availability === 'In Stock' ? 'rgba(74,222,128,0.2)' : shop.availability === 'Limited Stock' ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.08)'}`,
                        flexShrink: 0,
                      }}>{shop.availability}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#555', margin: '0 0 8px', lineHeight: 1.5 }}>📍 {shop.address}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    {renderStars(shop.rating)}
                    {shop.distance && <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 500 }}>{shop.distance}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {shop.phone && (
                      <a href={`tel:${shop.phone.replace(/\s+/g, '')}`} onClick={e => e.stopPropagation()} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '7px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px', color: '#ccc', fontSize: '11px', fontWeight: 500, textDecoration: 'none',
                        transition: 'all 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      >📞 Call</a>
                    )}
                    <button onClick={e => { e.stopPropagation(); openInGoogleMaps(shop); }} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '7px', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: '8px', color: '#60a5fa', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)'; }}
                    >🗺️ Google Maps</button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ ...glassPanel, padding: '24px', textAlign: 'center', color: '#555', fontSize: '13px' }}>No stores found nearby.</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ USAGE INSTRUCTIONS MODAL ═══ */}
      {selectedInstruction && (
        <div className="instruction-modal-backdrop" onClick={() => setSelectedInstruction(null)}>
          <div className="instruction-modal-card" onClick={e => e.stopPropagation()}>
            <div className="instruction-modal-header">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <div>
                  <h3 className="text-base font-semibold text-white">{selectedInstruction.name}</h3>
                  <span className="text-xs text-purple-400 capitalize">{selectedInstruction.category}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstruction(null)}
                className="instruction-close-icon-btn"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="instruction-step instruction-step-purple">
                <div className="step-title">🧪 Mixing Ratio & Dosage</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.dosage || '2g per litre of clean water'}. Mix thoroughly in a small container before adding to the main spray tank.
                </p>
              </div>

              <div className="instruction-step instruction-step-emerald">
                <div className="step-title">🚿 Application Method & Timing</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.application || 'Foliar spray at 10-15 day intervals'}. Apply evenly on upper and lower leaf surfaces during early morning (6-9 AM) or late evening (5-7 PM).
                </p>
              </div>

              <div className="instruction-step instruction-step-amber">
                <div className="step-title">🛡️ Safety & Protection</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.precautions || 'Avoid spraying during high winds. Wear protective gloves and a face mask.'} Keep out of reach of children and domestic animals.
                </p>
              </div>

              <div className="instruction-step instruction-step-blue">
                <div className="step-title">⏰ Spray Frequency</div>
                <p className="instruction-step-desc">
                  Repeat application every 10–14 days if pest or disease symptoms persist. Stop application 7–10 days before crop harvest.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedInstruction(null)}
              className="btn-primary w-full py-2.5 mt-1"
            >
              Got it, Close Instructions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
