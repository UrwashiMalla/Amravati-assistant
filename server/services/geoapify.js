const { GEOAPIFY_API_KEY } = require('../config/env');

const AMRAVATI = { lat: 20.9374, lon: 77.7796 };

async function searchPlacesGeoapify(query) {
  const apiKey = GEOAPIFY_API_KEY;
  if (!apiKey) return [];

  const text = `${query}, Amravati, Maharashtra, India`;
  const params = new URLSearchParams({
    text,
    apiKey,
    limit: '5',
    bias: `proximity:${AMRAVATI.lon},${AMRAVATI.lat}`,
  });

  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Geoapify]', res.status, errText.slice(0, 200));
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f) => {
      const p = f.properties || {};
      const lat = f.geometry?.coordinates?.[1] ?? p.lat;
      const lng = f.geometry?.coordinates?.[0] ?? p.lon;
      return {
        name: p.name || p.address_line1 || query,
        rating: null,
        reviews: 0,
        address: p.formatted || p.address_line2 || '',
        lat,
        lng,
      };
    });
  } catch (err) {
    console.warn('[Geoapify]', err.message);
    return [];
  }
}

module.exports = { searchPlacesGeoapify };
