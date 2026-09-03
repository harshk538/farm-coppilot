import axios from 'axios';

// Turns a typed address into real map coordinates using Google Geocoding.
// Returns null if it can't be resolved (no API key, bad address, network error).
//
// biasCoords (optional): a {lat,lng} to bias results toward. India has many
// places that share the same name (e.g. multiple "Somanahalli" villages), so
// without a bias, Google can resolve a typed address to the wrong same-named
// place far away. Passing the farmer's own known location as bias makes it
// prefer the nearby match instead.
export const geocodeAddress = async (fullAddressText, biasCoords = null) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !fullAddressText) return null;
  try {
    const params = { address: fullAddressText, key: apiKey };

    if (biasCoords && typeof biasCoords.lat === 'number' && typeof biasCoords.lng === 'number') {
      // Bias toward a ~30km box around the reference point.
      const radiusKm = 30;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((biasCoords.lat * Math.PI) / 180));
      const sw = `${biasCoords.lat - latDelta},${biasCoords.lng - lngDelta}`;
      const ne = `${biasCoords.lat + latDelta},${biasCoords.lng + lngDelta}`;
      params.bounds = `${sw}|${ne}`;
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', { params });
    const result = response.data?.results?.[0];
    if (result?.geometry?.location) {
      return { lat: result.geometry.location.lat, lng: result.geometry.location.lng };
    }
  } catch (err) {
    console.error('Geocode error:', err.response?.data || err.message);
  }
  return null;
};

// Turns real GPS coordinates into a human-readable address using Google's
// reverse geocoding — used for the signup form's "Use Current Location" button.
// Returns null if it can't be resolved.
export const reverseGeocode = async (lat, lng) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof lat !== 'number' || typeof lng !== 'number') return null;
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${lat},${lng}`, key: apiKey }
    });
    const result = response.data?.results?.[0];
    return result?.formatted_address || null;
  } catch (err) {
    console.error('Reverse geocode error:', err.response?.data || err.message);
    return null;
  }
};

// Straight-line distance between two {lat,lng} points, in kilometers (Haversine formula).
export const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
