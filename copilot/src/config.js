const isLocal = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.includes('ngrok'));

export const API_BASE_URL = isLocal
  ? ''
  : 'https://farm-copilot-backend.onrender.com';