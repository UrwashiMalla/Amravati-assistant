const geocodeCache = new Map();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AmravatiSahayak/1.0 (educational local guide; contact: local)';

async function geocodeWithNominatim(query) {
  const key = query.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'in',
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;

    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
    geocodeCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('[Nominatim]', err.message);
    return null;
  }
}

function osmLink(lat, lng, zoom = 15) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

function normalizePlace(place) {
  const lat = place.lat != null ? Number(place.lat) : null;
  const lng = place.lng != null ? Number(place.lng) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    name: place.name,
    rating: place.rating ?? null,
    reviews: place.reviews ?? 0,
    address: place.address || '',
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    osmUrl: hasCoords ? osmLink(lat, lng) : place.osmUrl || null,
    mapUrl: hasCoords ? osmLink(lat, lng) : place.mapUrl || null,
  };
}

async function enrichPlace(place) {
  let normalized = normalizePlace(place);

  if (normalized.lat != null && normalized.lng != null) {
    return normalized;
  }

  const query = `${place.name}, ${place.address || 'Amravati, Maharashtra'}`;
  const geo = await geocodeWithNominatim(query);
  if (!geo) return normalized;

  return normalizePlace({
    ...place,
    lat: geo.lat,
    lng: geo.lng,
    address: place.address || geo.displayName,
  });
}

async function enrichPlaces(places, maxGeocode = 4) {
  const enriched = [];
  let geocodeCount = 0;

  for (const place of places) {
    if (place.lat != null && place.lng != null) {
      enriched.push(normalizePlace(place));
      continue;
    }
    if (geocodeCount < maxGeocode) {
      geocodeCount += 1;
      enriched.push(await enrichPlace(place));
      await new Promise((r) => setTimeout(r, 250));
    } else {
      enriched.push(normalizePlace(place));
    }
  }

  return enriched;
}

module.exports = { geocodeWithNominatim, enrichPlace, enrichPlaces, osmLink, normalizePlace };
