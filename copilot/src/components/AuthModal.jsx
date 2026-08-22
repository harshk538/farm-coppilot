import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function AuthModal({ mode, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, phone: form.phone, password: form.password };

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
            onClick={() => { setIsLogin(!isLogin); setError(''); setForm({ name: '', email: '', phone: '', password: '' }); }}
            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </>
  );
}
