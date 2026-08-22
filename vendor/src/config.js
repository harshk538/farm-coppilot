// Dynamic API base URL for vendor portal
const isLocal = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.'));

export const API_BASE_URL = isLocal
  ? `http://${window.location.hostname}:5005`
  : 'https://farm-copilot-backend.onrender.com';



