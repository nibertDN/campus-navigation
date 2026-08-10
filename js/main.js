import { setupGlobalSearch } from './search.js';
import { setupBuildingDirectory, initializeMap } from './map.js';
import { setupSchedulePage } from './schedule.js';
import { setupQRPage, applySettings as applyQRSettings } from './qr.js';
import { setupLostFoundPage } from './lostfound.js';
import { setupProfilePage, renderAccountSidebar } from './profile.js';
import { setupSettingsPage, applyTheme, loadSavedSettings } from './settings.js';
import { showToast } from './notifications.js';
import { storage } from './storage.js';
import { setupHomePage, setupAnnouncementsPage, setupEventsPage } from './feed.js';
import { getRoomUsage } from './availability.js';

let animationEngine = null;

const currentPage = window.location.pathname.split('/').pop();
const settings = loadSavedSettings();
applyTheme(settings.theme);
applyQRSettings(settings);

async function initializeAnimations() {
  const revealFallback = () => {
    document.querySelectorAll('.animation-ready').forEach((el) => el.classList.remove('animation-ready'));
  };

  try {
    const module = await import('https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm');
    animationEngine = module.animate;
  } catch (error) {
    console.warn('Animation setup skipped:', error);
    revealFallback();
    return;
  }

  const safetyTimer = window.setTimeout(revealFallback, 1800);

  const navLinks = document.querySelectorAll('.main-nav .nav-link');
  if (navLinks.length) {
    animationEngine(navLinks, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.96, 1],
      duration: 700,
      delay: (el, index) => index * 70,
      easing: 'easeOutExpo',
      complete: () => {
        navLinks.forEach((link) => link.classList.add('is-animated'));
      }
    });

    navLinks.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        animationEngine(link, {
          scale: 1.03,
          translateY: -2,
          duration: 180,
          easing: 'easeOutQuad'
        });
      });
      link.addEventListener('mouseleave', () => {
        animationEngine(link, {
          scale: 1,
          translateY: 0,
          duration: 220,
          easing: 'easeOutQuad'
        });
      });
    });
  }

  const heroCopy = document.querySelector('.hero-copy');
  const heroVisual = document.querySelector('.hero-visual');
  if (heroCopy || heroVisual) {
    animationEngine([heroCopy, heroVisual].filter(Boolean), {
      opacity: [0, 1],
      translateX: (el) => (el.classList.contains('hero-visual') ? [24, 0] : [-24, 0]),
      duration: 800,
      easing: 'easeOutExpo',
      delay: (el) => (el.classList.contains('hero-visual') ? 120 : 0)
    });
  }

  document.querySelectorAll('.feature-card, .stat-item, .mini-card').forEach((card, index) => {
    card.classList.add('animation-ready');
    animationEngine(card, {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      delay: index * 90,
      easing: 'easeOutExpo'
    });
  });

  document.querySelectorAll('.button, .icon-btn').forEach((control) => {
    control.addEventListener('mouseenter', () => {
      animationEngine(control, {
        scale: 1.03,
        duration: 180,
        easing: 'easeOutQuad'
      });
    });
    control.addEventListener('mouseleave', () => {
      animationEngine(control, {
        scale: 1,
        duration: 220,
        easing: 'easeOutQuad'
      });
    });
  });
}

function renderLucideIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons(); } catch (e) { console.warn('lucide.createIcons error', e); }
    return;
  }

  // fallback: simple emoji replacements when Lucide isn't available
  const emojiMap = {
    info: 'ℹ️',
    house: '🏠',
    map: '🗺️',
    building: '🏛️',
    calendar: '📅',
    'qr-code': '📱',
    search: '🔍',
    phone: '📞',
    x: '✖️'
  };
  document.querySelectorAll('i[data-lucide]').forEach((el) => {
    if (el.children.length === 0 && !el.textContent.trim()) {
      const name = el.getAttribute('data-lucide');
      if (emojiMap[name]) el.textContent = emojiMap[name];
    }
  });
}

function initializePage() {
  if (currentPage === 'index.html' || currentPage === '') {
    initializeMap();
  }
  if (currentPage === 'map.html') {
    initializeMap();
  }
  if (currentPage === 'buildings.html') {
    setupBuildingDirectory();
  }
  if (currentPage === 'classrooms.html') {
    setupClassroomPage();
  }
  if (currentPage === 'schedule.html') {
    setupSchedulePage();
  }
  if (currentPage === 'qr.html') {
    setupQRPage();
  }
  if (currentPage === 'lostfound.html') {
    setupLostFoundPage();
  }
  if (currentPage === 'profile.html') {
    setupProfilePage();
  }
  if (currentPage === 'settings.html') {
    setupSettingsPage();
  }
  if (currentPage === 'events.html') {
    setupEventsPage();
  }
  if (currentPage === 'announcements.html') {
    setupAnnouncementsPage();
  }
  if (currentPage === 'index.html' || currentPage === '') {
    setupHomePage();
  }
  if (currentPage === 'emergency.html') {
    // no extra initialization required
  }

  setupThemeToggle();
  initializeSearch();
  loadPersistentSettings();
  renderLucideIcons();
  renderAccountSidebar();
  setupNavTintRotation();
  void initializeAnimations();
}

const NAV_TINT_CLASSES = Array.from({ length: 8 }, (_, index) => `nav-link--tint-${index + 1}`);

function setupNavTintRotation() {
  const navLinks = Array.from(document.querySelectorAll('.main-nav .nav-link'));
  if (navLinks.length < 2) return;

  const tintCount = Math.min(NAV_TINT_CLASSES.length, navLinks.length);
  const tintFor = (link) => NAV_TINT_CLASSES.find((cls) => link.classList.contains(cls)) || NAV_TINT_CLASSES[0];

  const applyTints = () => {
    navLinks.forEach((link, index) => {
      link.classList.remove(...NAV_TINT_CLASSES);
      link.classList.add(NAV_TINT_CLASSES[index % tintCount]);
    });
  };

  applyTints();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.setInterval(() => {
    const rotated = navLinks.map((_, index) => tintFor(navLinks[(index + 1) % navLinks.length]));
    navLinks.forEach((link, index) => {
      link.classList.remove(...NAV_TINT_CLASSES);
      link.classList.add(rotated[index]);
    });
  }, 3 * 60 * 1000);
}

async function initializeSearch() {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;

  const [buildings, rooms, schedules, announcements, events] = await Promise.all([
    fetch(currentPage.startsWith('index.html') || currentPage === '' ? './data/buildings.json' : '../data/buildings.json').then((r) => r.json()),
    fetch(currentPage.startsWith('index.html') || currentPage === '' ? './data/rooms.json' : '../data/rooms.json').then((r) => r.json()),
    fetch(currentPage.startsWith('index.html') || currentPage === '' ? './data/schedules.json' : '../data/schedules.json').then((r) => r.json()),
    fetch(currentPage.startsWith('index.html') || currentPage === '' ? './data/announcements.json' : '../data/announcements.json').then((r) => r.json()),
    fetch(currentPage.startsWith('index.html') || currentPage === '' ? './data/events.json' : '../data/events.json').then((r) => r.json()),
  ]);

  const pageUrl = (page, query) => {
    const base = currentPage.startsWith('index.html') || currentPage === '' ? `./pages/${page}` : `./${page}`;
    return query ? `${base}?q=${encodeURIComponent(query)}` : base;
  };

  setupGlobalSearch([
    {
      type: 'Building',
      items: buildings,
      fields: ['name', 'description', 'departments', 'facilities'],
      titleExtractor: (item) => item.name,
      subtitleExtractor: (item) => item.description,
      link: (item) => pageUrl('buildings.html', item.name),
    },
    {
      type: 'Room',
      items: rooms,
      fields: ['roomNumber', 'buildingName', 'department', 'equipment'],
      titleExtractor: (item) => `${item.buildingName} ${item.roomNumber}`,
      subtitleExtractor: (item) => `${item.department} • Capacity ${item.capacity}`,
      link: (item) => pageUrl('classrooms.html', `${item.buildingName} ${item.roomNumber}`),
    },
    {
      type: 'Schedule',
      items: schedules,
      fields: ['subject', 'instructor', 'roomNumber', 'buildingId', 'department'],
      titleExtractor: (item) => item.subject,
      subtitleExtractor: (item) => `${item.day} • ${item.start} - ${item.end} • Room ${item.roomNumber}`,
      link: (item) => pageUrl('schedule.html', item.subject),
    },
    {
      type: 'Announcement',
      items: announcements,
      fields: ['title', 'description'],
      titleExtractor: (item) => item.title,
      subtitleExtractor: (item) => item.description,
      link: (item) => pageUrl('announcements.html', item.title),
    },
    {
      type: 'Event',
      items: events,
      fields: ['title', 'description', 'location'],
      titleExtractor: (item) => item.title,
      subtitleExtractor: (item) => `${item.category} • ${item.date} ${item.time} • ${item.location}`,
      link: (item) => pageUrl('events.html', item.title),
    },
  ]);
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  themeToggle.addEventListener('click', () => {
    const currentTheme = storage.get('campusSettings', {}).theme || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const updated = { ...storage.get('campusSettings', {}), theme: nextTheme };
    storage.set('campusSettings', updated);
    applyTheme(nextTheme);
    // re-create icons so any runtime attributes/classes are applied
    renderLucideIcons();
    showToast('Theme updated', `Switched to ${nextTheme} mode.`, 'info');
  });
}

function loadPersistentSettings() {
  const fontSize = settings.fontSize || 'medium';
  document.documentElement.style.fontSize = fontSize === 'large' ? '18px' : fontSize === 'small' ? '14px' : '16px';
}

function setupClassroomPage() {
  const searchInput = document.getElementById('roomSearch');
  const buildingSelect = document.getElementById('roomBuilding');
  const departmentSelect = document.getElementById('roomDepartment');
  const tbody = document.getElementById('roomTableBody');
  const emptyState = document.getElementById('roomEmpty');
  if (!searchInput || !buildingSelect || !departmentSelect || !tbody || !emptyState) return;

  Promise.all([
    fetch('../data/rooms.json').then((response) => response.json()),
    fetch('../data/schedules.json').then((response) => response.json()),
  ])
    .then(([rooms, schedules]) => {
      const deepQuery = new URLSearchParams(window.location.search).get('q');
      if (deepQuery) searchInput.value = deepQuery;

      const buildings = [...new Set(rooms.map((room) => room.buildingName))].sort();
      const departments = [...new Set(rooms.map((room) => room.department))].sort();
      buildings.forEach((building) => buildingSelect.appendChild(new Option(building, building)));
      departments.forEach((department) => departmentSelect.appendChild(new Option(department, department)));

      const render = () => {
        const query = searchInput.value.trim().toLowerCase();
        const tokens = query.split(/\s+/).filter(Boolean);
        const building = buildingSelect.value;
        const department = departmentSelect.value;
        const filtered = rooms.filter((room) => {
          const searchable = [room.roomNumber, room.buildingName, room.department, room.availability, ...(room.equipment || [])]
            .map((value) => String(value).toLowerCase());
          const matchesSearch = tokens.length === 0 || tokens.every((token) => searchable.some((value) => value.includes(token)));
          const matchesBuilding = building === 'all' || room.buildingName === building;
          const matchesDepartment = department === 'all' || room.department === department;
          return matchesSearch && matchesBuilding && matchesDepartment;
        });

        tbody.innerHTML = '';
        if (filtered.length === 0) {
          emptyState.classList.remove('hidden');
          return;
        }
        emptyState.classList.add('hidden');
        filtered.forEach((room) => {
          const usage = getRoomUsage(room, schedules);
          const statusCell = usage.inUse
            ? `<span class="availability-badge availability-badge--busy">In use <small>until ${usage.until}</small></span>`
            : `<span class="availability-badge availability-badge--open">Available now</span>`;
          const row = document.createElement('tr');
          row.innerHTML = `<td>${room.roomNumber}</td><td>${room.buildingName}</td><td>${room.department}</td><td>${room.capacity}</td><td>${room.floor}</td><td>${room.equipment.join(', ')}</td><td>${statusCell}</td>`;
          tbody.appendChild(row);
        });
      };

      [searchInput, buildingSelect, departmentSelect].forEach((control) => control.addEventListener('input', render));
      render();
    });
}

window.addEventListener('DOMContentLoaded', () => initializePage());
