import { useState } from 'react';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { API_BASE_URL } from '../config';

/**
 * A location input that a farmer can fill three ways:
 *   1. type the address by hand,
 *   2. tap "Use Current Location" (real GPS + reverse geocoding),
 *   3. tap "Select on Map" and drop a pin anywhere.
 *
 * Whichever way is used, the parent receives both the readable address and the
 * exact coordinates, so distance maths downstream never depends on re-geocoding.
 */
export default function LocationField({ value, coords, onChange, inputStyle, labelStyle, label = 'Farm Location' }) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerMarker, setPickerMarker] = useState(null);
  const [pickerCenter, setPickerCenter] = useState(null);
  const [pickerLocating, setPickerLocating] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const { isLoaded: mapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBxvrTZazeyOivBPdZFKC6oYV2ycRTnsqo',
  });

  const handleTyping = (e) => {
    // Hand-typing invalidates any pin/GPS coordinates we were holding.
    onChange({ address: e.target.value, coords: null });
    setLocateError('');
  };

  // A typed address still needs coordinates — resolve it quietly once the
  // farmer moves on, so the mini-map preview and distance checks keep working.
  const handleBlur = async () => {
    if (coords || !value || !value.trim()) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/geocode`, { params: { address: value.trim() } });
      if (res.data.success) onChange({ address: value, coords: res.data.coords });
    } catch {
      /* preview simply won't show */
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Your browser does not support location detection.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await axios.get(`${API_BASE_URL}/api/auth/reverse-geocode`, {
            params: { lat: latitude, lng: longitude },
          });
          if (res.data.success) {
            onChange({ address: res.data.address, coords: { lat: latitude, lng: longitude } });
          } else {
            setLocateError('Could not find an address for your location.');
          }
        } catch {
          setLocateError('Could not find an address for your location.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocateError(err.code === 1 ? 'Location permission denied.' : 'Could not get your current location.');
      }
    );
  };

  const openMapPicker = () => {
    setPickerError('');
    setPickerMarker(coords || null);
    setPickerCenter(null);
    setShowMapPicker(true);
    if (navigator.geolocation) {
      setPickerLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickerCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          setPickerLocating(false);
        },
        () => setPickerLocating(false)
      );
    }
  };

  const handleConfirmPickedLocation = async () => {
    if (!pickerMarker) return;
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/reverse-geocode`, {
        params: { lat: pickerMarker.lat, lng: pickerMarker.lng },
      });
      if (res.data.success) {
        onChange({ address: res.data.address, coords: pickerMarker });
        setShowMapPicker(false);
        setPickerMarker(null);
      } else {
        setPickerError('Could not find an address for this point.');
      }
    } catch {
      setPickerError('Could not find an address for this point.');
    } finally {
      setPickerLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            style={{
              background: 'none', border: 'none', color: locating ? '#666' : '#a78bfa',
              fontSize: '11px', fontWeight: 600, cursor: locating ? 'not-allowed' : 'pointer', padding: 0,
            }}
          >
            {locating ? 'Locating…' : '📍 Use Current Location'}
          </button>
          <button
            type="button"
            onClick={openMapPicker}
            style={{
              background: 'none', border: 'none', color: '#a78bfa',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0,
            }}
          >
            🗺️ Select on Map
          </button>
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={handleTyping}
        onBlur={handleBlur}
        placeholder="Village, town or district"
        style={inputStyle}
      />

      {locateError && <p style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{locateError}</p>}

      {coords && mapLoaded && (
        <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '140px' }}
            center={coords}
            zoom={14}
            options={{ disableDefaultUI: true, gestureHandling: 'none', clickableIcons: false }}
          >
            <Marker position={coords} />
          </GoogleMap>
        </div>
      )}

      {/* Map picker overlay */}
      {showMapPicker && (
        <>
          <div
            onClick={() => setShowMapPicker(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1100, width: '92%', maxWidth: '520px',
            background: '#111113', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>🗺️ Select Your Location</h3>
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px' }}>
              {pickerLocating ? 'Finding your current location…' : "Click anywhere on the map to drop a pin at your farm's location."}
            </p>
            {mapLoaded ? (
              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '320px' }}
                  center={pickerMarker || coords || pickerCenter || { lat: 20.5937, lng: 78.9629 }}
                  zoom={(pickerMarker || coords || pickerCenter) ? 15 : 5}
                  onClick={(e) => setPickerMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                  options={{ clickableIcons: false, streetViewControl: false, mapTypeControl: false }}
                >
                  {pickerMarker && (
                    <Marker
                      position={pickerMarker}
                      draggable
                      onDragEnd={(e) => setPickerMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                    />
                  )}
                  {pickerCenter && window.google && (
                    <Marker
                      position={pickerCenter}
                      title="Your current location"
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                      }}
                    />
                  )}
                </GoogleMap>
              </div>
            ) : (
              <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '13px' }}>
                Loading map…
              </div>
            )}
            {pickerCenter && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                🔵 Blue dot = your current location. Click/drag the pin to set your exact field location.
              </p>
            )}
            {pickerError && <p style={{ fontSize: '11px', color: '#f87171', marginTop: '8px' }}>{pickerError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                style={{
                  flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                  color: '#ccc', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPickedLocation}
                disabled={!pickerMarker || pickerLoading}
                style={{
                  flex: 1, padding: '10px',
                  background: (!pickerMarker || pickerLoading) ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '13px', fontWeight: 600,
                  cursor: (!pickerMarker || pickerLoading) ? 'not-allowed' : 'pointer',
                }}
              >
                {pickerLoading ? 'Fetching address…' : 'Confirm Location'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
