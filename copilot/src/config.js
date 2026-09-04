const isNativeApp = typeof window !== 'undefined' &&
  window.Capacitor &&
  typeof window.Capacitor.isNativePlatform === 'function' &&
  window.Capacitor.isNativePlatform();

const isLocal = !isNativeApp && typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.includes('ngrok'));

export const API_BASE_URL = isLocal
  ? ''
  : 'https://farm-copilot-backend-t18x.onrender.com';
