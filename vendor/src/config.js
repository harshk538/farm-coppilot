// Dynamic API base URL for vendor portal
export const API_BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? ''
  : `http://${typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'}:5005`;

