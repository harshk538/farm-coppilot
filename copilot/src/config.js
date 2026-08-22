export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168.') && !window.location.hostname.includes('127.0.0.1')
    ? 'https://farm-copilot-backend.onrender.com'
    : `http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:5005`);