import { useState } from 'react';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { API_BASE_URL } from '../config';

const mapContainerStyle = { width: '100%', height: '140px', borderRadius: '10px' };

export default function AuthModal({ mode, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', fieldLocation: '' });
  const [fieldLocationCoords, setFieldLocationCoords] = useState(null);
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerMarker, setPickerMarker] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerCenter, setPickerCenter] = useState(null);
  const [pickerLocating, setPickerLocating] = useState(false);
  const { isLoaded: mapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'fieldLocation') {
      setFieldLocationCoords(null);
      setLocateError('');
    }
    setError('');
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
            params: { lat: latitude, lng: longitude }
          });
          if (res.data.success) {
            setForm(prev => ({ ...prev, fieldLocation: res.data.address }));
            setFieldLocationCoords({ lat: latitude, lng: longitude });
          } else {
            setLocateError('Could not find an address for your location.');
          }
        } catch (err) {
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

  // When the field is typed by hand (not via the GPS button), resolve it to
  // coordinates once the farmer finishes typing, so the mini-map preview
  // still works for a manually typed address.
  const handleFieldLocationBlur = async () => {
    if (fieldLocationCoords || !form.fieldLocation.trim()) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/geocode`, {
        params: { address: form.fieldLocation.trim() }
      });
      if (res.data.success) {
        setFieldLocationCoords(res.data.coords);
      }
    } catch (err) {
      // Silently ignore — the map preview just won't show for this address.
    }
  };

  const openMapPicker = () => {
    setPickerError('');
    setPickerMarker(fieldLocationCoords || null);
    setPickerCenter(null);
    setShowMapPicker(true);
    if (navigator.geolocation) {
      setPickerLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickerCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          setPickerLocating(false);
        },
        () => {
          setPickerLocating(false);
        }
      );
    }
  };

  const handleMapPickClick = (e) => {
    setPickerMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  };

  const handleConfirmPickedLocation = async () => {
    if (!pickerMarker) return;
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/reverse-geocode`, {
        params: { lat: pickerMarker.lat, lng: pickerMarker.lng }
      });
      if (res.data.success) {
        setForm(prev => ({ ...prev, fieldLocation: res.data.address }));
        setFieldLocationCoords(pickerMarker);
        setShowMapPicker(false);
        setPickerMarker(null);
      } else {
        setPickerError('Could not find an address for this point.');
      }
    } catch (err) {
      setPickerError('Could not find an address for this point.');
    } finally {
      setPickerLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, phone: form.phone, password: form.password, fieldLocation: form.fieldLocation, fieldLocationCoords };

      const res = await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      if (res.data.success) {
        localStorage.setItem('fc_token', res.data.token);
        localStorage.setItem('fc_user', JSON.stringify(res.data.user));
        onSuccess(res.data.user);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 1000,
        width: '100%', maxWidth: '420px',
        background: '#111113',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🌾</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Farm Copilot</span>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
            {isLogin
              ? 'Log in to receive weather alerts on your email & phone.'
              : 'Sign up to get farm alerts on your email & phone number.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {!isLogin && (
            <div>
              <label style={labelStyle}>Phone Number (with country code)</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                Include country code e.g. +91 for India
              </p>
            </div>
          )}

          {!isLogin && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Field Location</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                name="fieldLocation"
                type="text"
                value={form.fieldLocation}
                onChange={handleChange}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; handleFieldLocationBlur(); }}
              />
              {locateError && (
                <p style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{locateError}</p>
              )}
              {fieldLocationCoords && mapLoaded && (
                <div style={{ marginTop: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={fieldLocationCoords}
                    zoom={14}
                    options={{ disableDefaultUI: true, gestureHandling: 'none', clickableIcons: false }}
                  >
                    <Marker position={fieldLocationCoords} />
                  </GoogleMap>
                </div>
              )}
              <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                Your farm's location — used to find nearby equipment and match you with nearby machine owners. This is set once and used going forward.
              </p>
            </div>
          )}

          <div>
            <label style={labelStyle}>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#f87171',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: '4px',
            }}
          >
            {loading ? '⏳ Please wait…' : (isLogin ? 'Log in' : 'Create Account')}
          </button>
        </form>

        {/* Toggle */}
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#555', fontSize: '13px' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setForm({ name: '', email: '', phone: '', password: '', fieldLocation: '' }); setFieldLocationCoords(null); setLocateError(''); }}
            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>

      {/* Map Picker Overlay */}
      {showMapPicker && (
        <>
          <div
            onClick={() => setShowMapPicker(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1099,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 1100,
            width: '92%', maxWidth: '520px',
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
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
                  center={pickerMarker || fieldLocationCoords || pickerCenter || { lat: 20.5937, lng: 78.9629 }}
                  zoom={(pickerMarker || fieldLocationCoords || pickerCenter) ? 15 : 5}
                  onClick={handleMapPickClick}
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
            {pickerError && (
              <p style={{ fontSize: '11px', color: '#f87171', marginTop: '8px' }}>{pickerError}</p>
            )}
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
                  border: 'none', borderRadius: '10px',
                  color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: (!pickerMarker || pickerLoading) ? 'not-allowed' : 'pointer',
                }}
              >
                {pickerLoading ? 'Fetching address…' : 'Confirm Location'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
