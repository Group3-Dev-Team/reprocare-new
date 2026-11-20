import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Interactive OpenStreetMap map (Leaflet) for ReproCare's own records.
 * Markers use real stored coordinates only. Click a marker to select it; selection is highlighted and synced with the list.
 * Google Places results are NOT shown here: Google's terms require them on a Google map (see GooglePlacesMap).
 *
 * props: points [{ id, name, latitude, longitude, subtitle, href, demo }], selectedId, onSelect, onPick (lat,lng), center, zoom, height
 */
const KENYA_CENTER = [0.2, 37.9];

function markerIcon(selected, demo) {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin ${selected ? 'is-selected' : ''}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

function escapeHtml(text = '') {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function MapView({ points = [], selectedId, onSelect, onPick, center, zoom = 6, height = 460, fitToPoints = true, label = 'Map of facilities' }) {
  const element = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const markers = useRef({});
  const pickMarker = useRef(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    map.current = L.map(element.current, { scrollWheelZoom: false }).setView(center || KENYA_CENTER, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on('focus', () => map.current.scrollWheelZoom.enable());
    map.current.on('blur', () => map.current.scrollWheelZoom.disable());
    // Links inside popups navigate within the app instead of reloading the page.
    map.current.on('popupopen', (e) => {
      const link = e.popup.getElement()?.querySelector('[data-href]');
      link?.addEventListener('click', (ev) => {
        ev.preventDefault();
        navigateRef.current(link.dataset.href);
      });
    });
    return () => map.current.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onPick) return undefined;
    const handler = (e) => {
      if (pickMarker.current) pickMarker.current.setLatLng(e.latlng);
      else pickMarker.current = L.circleMarker(e.latlng, { radius: 9, color: '#ec4f9c', weight: 3, fillOpacity: 0.25 }).addTo(map.current);
      onPick(e.latlng.lat, e.latlng.lng);
    };
    map.current.on('click', handler);
    return () => map.current.off('click', handler);
  }, [onPick]);

  useEffect(() => {
    layer.current.clearLayers();
    markers.current = {};
    const valid = points.filter((p) => p.latitude != null && p.longitude != null);
    valid.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude], { icon: markerIcon(p.id === selectedId, p.demo), title: p.name, keyboard: true, alt: p.name });
      const link = p.href ? `<a href="#" data-href="${p.href}">View details</a>` : '';
      marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br/><span>${escapeHtml(p.subtitle || '')}</span><br/>${link}`);
      marker.on('click', () => onSelect?.(p.id));
      marker.addTo(layer.current);
      markers.current[p.id] = marker;
    });
    if (fitToPoints && valid.length) {
      map.current.fitBounds(L.latLngBounds(valid.map((p) => [p.latitude, p.longitude])).pad(0.15), { maxZoom: 13 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    Object.entries(markers.current).forEach(([id, marker]) => {
      const point = points.find((p) => String(p.id) === id);
      marker.setIcon(markerIcon(id === String(selectedId), point?.demo));
      if (id === String(selectedId)) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    });
    const selected = markers.current[selectedId];
    if (selected && !map.current.getBounds().contains(selected.getLatLng())) map.current.panTo(selected.getLatLng());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (center) map.current.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return <div ref={element} className="map" style={{ height }} role="region" aria-label={label} tabIndex={0} />;
}
