/** Leaflet + OpenStreetMap helpers */

const AMRAVATI_CENTER = [20.9374, 77.7796];
const mapInstances = new WeakMap();

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getTileLayer() {
  if (isDarkTheme()) {
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    });
  }
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  });
}

/**
 * @param {HTMLElement} container
 * @param {Array<{name:string,address?:string,lat:number,lng:number,rating?:number,field?:string}>} markers
 */
export function renderPlacesMap(container, markers) {
  if (!window.L || !container) return null;

  const valid = (markers || []).filter(
    (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)
  );
  if (!valid.length) return null;

  if (mapInstances.has(container)) {
    mapInstances.get(container).remove();
    mapInstances.delete(container);
  }

  container.innerHTML = '';

  const map = L.map(container, {
    scrollWheelZoom: false,
    attributionControl: true,
  });

  getTileLayer().addTo(map);

  const group = L.featureGroup();

  valid.forEach((place) => {
    const marker = L.marker([place.lat, place.lng]);
    const label = place.field
      ? `<span class="map-popup-tag">${escapeHtml(place.field)}</span><br>`
      : '';
    const rating =
      place.rating != null
        ? `<br>⭐ ${place.rating}/5`
        : '';
    marker.bindPopup(
      `${label}<b>${escapeHtml(place.name)}</b>${rating}<br><small>${escapeHtml(place.address || place.venue || '')}</small>`
    );
    marker.addTo(map);
    group.addLayer(marker);
  });

  if (valid.length === 1) {
    map.setView([valid[0].lat, valid[0].lng], 14);
  } else {
    map.fitBounds(group.getBounds().pad(0.12));
  }

  mapInstances.set(container, map);

  setTimeout(() => map.invalidateSize(), 100);

  return map;
}

export function refreshAllMaps() {
  document.querySelectorAll('.place-map').forEach((el) => {
    const data = el.dataset.markers;
    if (!data) return;
    try {
      const markers = JSON.parse(data);
      renderPlacesMap(el, markers);
    } catch (_) {}
  });
}

window.addEventListener('themeChanged', () => {
  refreshAllMaps();
});

export { AMRAVATI_CENTER };
