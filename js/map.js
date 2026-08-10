import { loadJson } from './dataLoader.js';
import { normalizeText } from './utils.js';
import { showToast } from './notifications.js';
import { isBuildingOpenNow } from './availability.js';

let map;
let buildingMarkers = [];
let buildingsData = [];
let deepQueryApplied = false;

export async function initializeMap() {
  const mapContainer = document.getElementById('campusMap');
  if (!mapContainer) return;

  buildingsData = await loadJson('../data/buildings.json');
  // Campus default center: Toledo City, Cebu (Wikipedia coordinates)
  const campusCenter = { latitude: 10.383333, longitude: 123.65 };
  const firstBuilding = buildingsData[0] || campusCenter;

  map = L.map(mapContainer).setView([firstBuilding.latitude, firstBuilding.longitude], 17);

  // Use a minimal/non-streety basemap (Carto Positron) for a cleaner campus look
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &amp; CARTO',
    maxZoom: 20,
  }).addTo(map);

  createFilters();
  renderMarkers(buildingsData);
}

function renderMarkers(buildings) {
  if (!map) return;
  buildingMarkers.forEach((marker) => marker.remove());
  buildingMarkers = [];

  buildings.forEach((building) => {
    const icon = L.divIcon({
      className: `map-marker marker-${building.type}`,
      html: `<span>${building.name[0]}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const marker = L.marker([building.latitude, building.longitude], { icon }).addTo(map);
    marker.bindPopup(createBuildingPopup(building));
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
