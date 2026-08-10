import { loadJson } from './dataLoader.js';
import { normalizeText } from './utils.js';
import { showToast } from './notifications.js';
import { isBuildingOpenNow } from './availability.js';

let map;
let buildingMarkers = [];
let buildingsData = [];
let deepQueryApplied = false;

const BUILDING_FLOOR_HEIGHT = 3.5;

const TYPE_COLORS = {
  light: {
    academic: '#6366f1',
    services: '#0ea5e9',
    facility: '#16a34a',
    safety: '#f59e0b',
  },
  dark: {
    academic: '#818cf8',
    services: '#38bdf8',
    facility: '#2ee6ae',
    safety: '#fbbf24',
  },
};

const THEME_STYLE_URLS = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

const THEME_PALETTES = {
  light: {
    background: '#f2f5fa',
    landcover: '#dff0e2',
    park: '#dff0e2',
    water: '#d8e8f8',
    waterway: '#b9cfe8',
    boundary: '#c3cee0',
    roadCase: '#ffffff',
    roadFill: '#cdd9ea',
    roadPath: '#e6edf6',
    rail: '#cdd9ea',
    building: '#ffffff',
    buildingTop: '#e9eff8',
    aeroway: '#ffffff',
    label: '#4b5a73',
    halo: '#f2f5fa',
  },
  dark: {
    background: '#0b1220',
    landcover: '#0d1a2b',
    park: '#0f2033',
    water: '#12273d',
    waterway: '#16324c',
    boundary: '#2c3d5c',
    roadCase: '#0d1524',
    roadFill: '#22304a',
    roadPath: '#1c2940',
    rail: '#22304a',
    building: '#182338',
    buildingTop: '#1c2942',
    aeroway: '#0d1524',
    label: '#8fa3bd',
    halo: '#0b1220',
  },
};

function isDarkTheme() {
  return document.body.classList.contains('theme-dark');
}

async function fetchThemedStyle(theme) {
  const response = await fetch(THEME_STYLE_URLS[theme]);
  if (!response.ok) throw new Error(`Style request failed: ${response.status}`);
  const style = await response.json();
  return applyThemePalette(style, theme);
}

function applyThemePalette(style, theme) {
  const palette = THEME_PALETTES[theme];
  if (!style || !Array.isArray(style.layers)) return style;

  style.layers.forEach((layer) => {
    const id = layer.id || '';
    const paint = layer.paint || {};

    if (layer.type === 'background') {
      paint['background-color'] = palette.background;
    } else if (id.startsWith('park_') || id === 'landcover') {
      if (paint['fill-color']) paint['fill-color'] = id === 'park_national_park' || id === 'park_nature_reserve' ? palette.park : palette.landcover;
      if (paint['fill-opacity'] !== undefined) paint['fill-opacity'] = 0.85;
    } else if (id.startsWith('landuse')) {
      if (paint['fill-color']) paint['fill-color'] = palette.landcover;
      if (paint['fill-opacity'] !== undefined) paint['fill-opacity'] = 0.6;
    } else if (id === 'water' || id === 'water_shadow') {
      if (paint['fill-color']) paint['fill-color'] = palette.water;
    } else if (id === 'waterway') {
      if (paint['line-color']) paint['line-color'] = palette.waterway;
    } else if (id.startsWith('boundary_')) {
      if (paint['line-color']) paint['line-color'] = palette.boundary;
    } else if (id.startsWith('road_') || id.startsWith('tunnel_') || id.startsWith('bridge_')) {
      if (id.endsWith('_case') || id.endsWith('_case_ramp') || id.endsWith('_case_noramp') || id === 'road_path' || id === 'bridge_path' || id === 'tunnel_path') {
        if (paint['line-color']) paint['line-color'] = id.includes('path') ? palette.roadPath : palette.roadCase;
      } else if (id.endsWith('_fill') || id.endsWith('_fill_ramp') || id.endsWith('_fill_noramp')) {
        if (paint['line-color']) paint['line-color'] = palette.roadFill;
      }
    } else if (id === 'rail' || id === 'rail_dash' || id === 'tunnel_rail' || id === 'tunnel_rail_dash') {
      if (paint['line-color']) paint['line-color'] = palette.rail;
    } else if (id === 'building') {
      if (paint['fill-color']) paint['fill-color'] = palette.building;
      if (paint['fill-outline-color']) paint['fill-outline-color'] = palette.roadCase;
    } else if (id === 'building-top') {
      if (paint['fill-color']) paint['fill-color'] = palette.buildingTop;
      if (paint['fill-outline-color']) paint['fill-outline-color'] = palette.roadCase;
    } else if (id.startsWith('aeroway')) {
      if (paint['line-color']) paint['line-color'] = palette.aeroway;
    }

    if (layer.type === 'symbol' && paint['text-color']) {
      paint['text-color'] = palette.label;
      if (paint['text-halo-color']) paint['text-halo-color'] = palette.halo;
    }
  });

  return style;
}

function typeColor(type) {
  const palette = TYPE_COLORS[isDarkTheme() ? 'dark' : 'light'];
  return palette[type] || '#0ea5e9';
}

function styleForTheme(theme) {
  return fetchThemedStyle(theme).then((style) => ({ theme, style })).catch(() => ({ theme, style: THEME_STYLE_URLS[theme] }));
}

export async function initializeMap() {
  const mapContainer = document.getElementById('campusMap');
  if (!mapContainer) return;
  if (!window.maplibregl) return;

  buildingsData = await loadJson('../data/buildings.json');
  const firstBuilding = buildingsData[0];
  const isMini = mapContainer.classList.contains('campus-map--mini');
  const initialTheme = isDarkTheme() ? 'dark' : 'light';
  const initialStyle = await styleForTheme(initialTheme);

  map = new maplibregl.Map({
    container: mapContainer,
    style: initialStyle.style,
    center: [firstBuilding.longitude, firstBuilding.latitude],
    zoom: isMini ? 15 : 15.5,
    pitch: isMini ? 52 : 56,
    bearing: 14,
    attributionControl: { compact: true },
    maxPitch: 85,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

  handleMapLoad({ isMini });
  setupThemeSync(isMini);
}

function handleMapLoad({ isMini }) {
  map.on('load', () => {
    addExtrusionLayers();
    if (!isMini) createFilters();
    renderMarkers(buildingsData);
  });
}

function setupThemeSync(isMini) {
  const observer = new MutationObserver(() => {
    const theme = isDarkTheme() ? 'dark' : 'light';
    const current = map.getStyle();
    const currentIsDark = current && current.layers && current.layers.some((layer) => layer.id === 'background' && layer.paint && layer.paint['background-color'] === THEME_PALETTES.dark.background);
    const wantsDark = theme === 'dark';
    if (!current || currentIsDark === wantsDark) return;

    styleForTheme(theme).then(({ style }) => {
      const prevCenter = map.getCenter();
      const prevZoom = map.getZoom();
      const prevPitch = map.getPitch();
      const prevBearing = map.getBearing();
      map.setStyle(style);
      map.once('styledata', () => {
        if (map.getStyle().layers.some((layer) => layer.id === 'campus-buildings-base')) return;
        map.jumpTo({ center: prevCenter, zoom: prevZoom, pitch: prevPitch, bearing: prevBearing });
        addExtrusionLayers();
        renderMarkers(buildingsData);
      });
    });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function addExtrusionLayers() {
  map.addSource('campus-buildings', { type: 'geojson', data: buildFootprintGeoJSON(buildingsData) });

  map.addLayer({
    id: 'campus-buildings-base',
    type: 'fill',
    source: 'campus-buildings',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.35,
    },
  });

  map.addLayer({
    id: 'campus-buildings-3d',
    type: 'fill-extrusion',
    source: 'campus-buildings',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-opacity': 0.82,
    },
  });
}

function buildFootprintGeoJSON(buildings) {
  return {
    type: 'FeatureCollection',
    features: buildings.map((building) => {
      const sizeMeters = 16 + building.floorCount * 3;
      const latDelta = sizeMeters / 111320;
      const lngDelta = sizeMeters / (111320 * Math.cos((building.latitude * Math.PI) / 180));
      const lat = building.latitude;
      const lng = building.longitude;
      return {
        type: 'Feature',
        properties: {
          id: building.id,
          name: building.name,
          color: typeColor(building.type),
          height: building.floorCount * BUILDING_FLOOR_HEIGHT,
          base: 0,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng - lngDelta / 2, lat - latDelta / 2],
            [lng + lngDelta / 2, lat - latDelta / 2],
            [lng + lngDelta / 2, lat + latDelta / 2],
            [lng - lngDelta / 2, lat + latDelta / 2],
            [lng - lngDelta / 2, lat - latDelta / 2],
          ]],
        },
      };
    }),
  };
}

function updateExtrusions(buildings) {
  if (!map || !map.getSource('campus-buildings')) return;
  map.getSource('campus-buildings').setData(buildFootprintGeoJSON(buildings));
}

function renderMarkers(buildings) {
  if (!map) return;
  buildingMarkers.forEach((marker) => marker.remove());
  buildingMarkers = [];

  buildings.forEach((building) => {
    const element = document.createElement('div');
    element.className = `map-marker marker-${building.type}`;
    element.innerHTML = `<span>${building.name[0]}</span>`;

    const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
      .setLngLat([building.longitude, building.latitude])
      .setPopup(
        new maplibregl.Popup({ offset: 18, maxWidth: '330px' }).setHTML(createBuildingPopup(building))
      )
      .addTo(map);
    buildingMarkers.push(marker);
  });
}

function createBuildingPopup(building) {
  const state = isBuildingOpenNow(building);
  const statusLine = state
    ? `<p><span class="availability-badge ${state.open ? 'availability-badge--open' : 'availability-badge--closed'}">${state.open ? '● ' : '◌ '}${state.label}</span></p>`
    : '';
  return `<div style="max-width: 300px;">
    <h3>${building.name}</h3>
    ${statusLine}
    <p>${building.description}</p>
    <p><strong>Departments:</strong> ${building.departments.join(', ')}</p>
    <p><strong>Facilities:</strong> ${building.facilities.join(', ')}</p>
    <p><strong>Offices:</strong> ${building.offices.join(', ')}</p>
    <p><strong>Floor count:</strong> ${building.floorCount}</p>
    <p><strong>Office hours:</strong> ${building.officeHours}</p>
  </div>`;
}

function createFilters() {
  const searchInput = document.getElementById('mapSearch');
  const departmentFilter = document.getElementById('departmentFilter');
  if (!searchInput || !departmentFilter) return;

  const departments = Array.from(new Set(buildingsData.flatMap((building) => building.departments)));
  departments.sort().forEach((label) => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    departmentFilter.appendChild(option);
  });

  searchInput.addEventListener('input', applyFilters);
  departmentFilter.addEventListener('change', applyFilters);
}

function applyFilters() {
  const searchTerm = normalizeText(document.getElementById('mapSearch').value || '');
  const selectedDepartment = document.getElementById('departmentFilter').value;

  const filtered = buildingsData.filter((building) => {
    const matchesName = normalizeText(building.name).includes(searchTerm);
    const matchesDepartments = selectedDepartment === 'all' || building.departments.some((dept) => dept === selectedDepartment);
    return matchesName && matchesDepartments;
  });

  if (filtered.length === 0) {
    showToast('No buildings found', 'Try changing the filter or search term.', 'warning');
  }
  renderMarkers(filtered);
  updateExtrusions(filtered);
}

export function setupBuildingDirectory() {
  const listContainer = document.getElementById('buildingList');
  const emptyState = document.getElementById('buildingEmpty');
  const searchInput = document.getElementById('buildingSearch');
  const categorySelect = document.getElementById('buildingFilter');
  const sortSelect = document.getElementById('buildingSort');
  if (!listContainer || !searchInput || !categorySelect || !sortSelect) return;

  const loadAndRender = async () => {
    const buildings = await loadJson('../data/buildings.json');
    if (!deepQueryApplied) {
      const deepQuery = new URLSearchParams(window.location.search).get('q');
      if (deepQuery) searchInput.value = deepQuery;
      deepQueryApplied = true;
    }
    const query = normalizeText(searchInput.value);
    const category = categorySelect.value;
    const sort = sortSelect.value;

    const filtered = buildings.filter((building) => {
      const matchesName = normalizeText(building.name).includes(query) || normalizeText(building.description).includes(query);
      const matchesCategory = category === 'all' || building.type === category;
      return matchesName && matchesCategory;
    });

    const sorted = filtered.sort((a, b) => {
      if (sort === 'floor') return a.floorCount - b.floorCount;
      return a.name.localeCompare(b.name);
    });

    listContainer.innerHTML = '';
    if (sorted.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    sorted.forEach((building) => {
      const state = isBuildingOpenNow(building);
      const badge = state
        ? `<span class="availability-badge ${state.open ? 'availability-badge--open' : 'availability-badge--closed'}">${state.open ? '● Open now' : '◌ Closed'}</span>`
        : '';
      const card = document.createElement('article');
      card.className = 'feature-card';
      card.innerHTML = `<div style="display:flex;gap:1rem;align-items:center;justify-content:space-between;"><div style="display:flex;gap:1rem;align-items:center;"><div style="width:68px;height:68px;border-radius:18px;background:var(--surface-strong);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--primary);">${building.name[0]}</div><div><h3>${building.name}</h3><p>${building.type} • ${building.floorCount} floors</p></div></div>${badge}</div><p style="margin:1rem 0 0;color:var(--muted);">${building.description}</p><p style="margin:0.75rem 0 0;font-size:0.95rem;color:var(--muted);"><strong>Departments:</strong> ${building.departments.join(', ')}</p><p style="margin:0.4rem 0 0;font-size:0.9rem;color:var(--muted);"><strong>Hours:</strong> ${building.officeHours}</p>`;
      listContainer.appendChild(card);
    });
  };

  searchInput.addEventListener('input', loadAndRender);
  categorySelect.addEventListener('change', loadAndRender);
  sortSelect.addEventListener('change', loadAndRender);
  loadAndRender();
}