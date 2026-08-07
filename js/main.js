import { setupGlobalSearch } from './search.js';
import { setupBuildingDirectory, initializeMap } from './map.js';
import { setupSchedulePage } from './schedule.js';
import { setupQRPage, applySettings as applyQRSettings } from './qr.js';
import { setupLostFoundPage } from './lostfound.js';
import { setupProfilePage } from './profile.js';
import { setupSettingsPage, applyTheme, loadSavedSettings } from './settings.js';
import { showToast } from './notifications.js';
import { storage } from './storage.js';

let animationEngine = null;

const currentPage = window.location.pathname.split('/').pop();
const settings = loadSavedSettings();
applyTheme(settings.theme);
applyQRSettings(settings);

async function initializeAnimations() {
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm');
    animationEngine = module.animate;
  } catch (error) {
    console.warn('Animation setup skipped:', error);
    return;
  }

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
    setupEventPage();
  }
  if (currentPage === 'announcements.html') {
    setupAnnouncementsPage();
  }
  if (currentPage === 'emergency.html') {
    // no extra initialization required
  }

  setupThemeToggle();
  initializeSearch();
  loadPersistentSettings();
  renderLucideIcons();
  void initializeAnimations();
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

  setupGlobalSearch([
    {
      type: 'Building',
      items: buildings,
      fields: ['name', 'description', 'departments', 'facilities'],
      titleExtractor: (item) => item.name,
      subtitleExtractor: (item) => item.description,
      link: (item) => currentPage.startsWith('index.html') || currentPage === '' ? `./pages/buildings.html` : `./buildings.html`,
    },
    {
      type: 'Room',
      items: rooms,
      fields: ['roomNumber', 'buildingName', 'department', 'equipment'],
      titleExtractor: (item) => `${item.buildingName} ${item.roomNumber}`,
      subtitleExtractor: (item) => `${item.department} • Capacity ${item.capacity}`,
      link: (item) => currentPage.startsWith('index.html') || currentPage === '' ? `./pages/classrooms.html` : `./classrooms.html`,
    },
    {
      type: 'Schedule',
      items: schedules,
      fields: ['subject', 'instructor', 'roomNumber', 'department'],
      titleExtractor: (item) => item.subject,
      subtitleExtractor: (item) => `${item.day} • ${item.roomNumber}`,
      link: (item) => currentPage.startsWith('index.html') || currentPage === '' ? `./pages/schedule.html` : `./schedule.html`,
    },
    {
      type: 'Announcement',
      items: announcements,
      fields: ['title', 'description'],
      titleExtractor: (item) => item.title,
      subtitleExtractor: (item) => item.description,
      link: (item) => currentPage.startsWith('index.html') || currentPage === '' ? `./pages/announcements.html` : `./announcements.html`,
    },
    {
      type: 'Event',
      items: events,
      fields: ['title', 'description', 'location'],
      titleExtractor: (item) => item.title,
      subtitleExtractor: (item) => item.location,
      link: (item) => currentPage.startsWith('index.html') || currentPage === '' ? `./pages/events.html` : `./events.html`,
    },
  ]);

  // wire search clear button and focus-expand behavior
  try {
    const searchWidget = searchInput.closest('.search-widget');
    const clearBtn = searchWidget ? searchWidget.querySelector('.search-clear') : null;
    if (clearBtn) {
      const toggleClear = () => {
        clearBtn.hidden = !searchInput.value.trim();
      };
      toggleClear();
      searchInput.addEventListener('input', toggleClear);
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchInput.value = '';
        toggleClear();
        searchInput.focus();
        // if there is a search handler, dispatch an input event
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // expand on focus for desktop
      searchInput.addEventListener('focus', () => {
        if (window.innerWidth > 980) searchWidget.classList.add('focus-expand');
      });
      searchInput.addEventListener('blur', () => {
        if (window.innerWidth > 980 && !searchInput.value) searchWidget.classList.remove('focus-expand');
      });
    }
  } catch (err) {
    // ignore wiring errors
    console.warn('Search widget wiring failed', err);
  }
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

async function loadEvents() {
  const response = await fetch('../data/events.json');
  return response.ok ? response.json() : [];
}

async function loadAnnouncements() {
  const response = await fetch('../data/announcements.json');
  return response.ok ? response.json() : [];
}

function setupEventPage() {
  const container = document.getElementById('eventCards');
  const emptyState = document.getElementById('eventEmpty');
  if (!container || !emptyState) return;
  loadEvents().then((events) => {
    container.innerHTML = '';
    if (!events.length) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    events.forEach((event) => {
      const card = document.createElement('article');
      card.className = 'feature-card';
      card.innerHTML = `<span class="eyebrow">${event.category}</span><h3>${event.title}</h3><p>${event.date} • ${event.time}</p><p style="margin:0.75rem 0;color:var(--muted);">${event.location}</p><p>${event.description}</p>`;
      container.appendChild(card);
    });
  });
}

function setupAnnouncementsPage() {
  const container = document.getElementById('announcementFeed');
  const emptyState = document.getElementById('announcementEmpty');
  if (!container || !emptyState) return;
  loadAnnouncements().then((announcements) => {
    container.innerHTML = '';
    if (!announcements.length) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    announcements.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'feature-card';
      card.innerHTML = `<p style="color:var(--muted);font-size:0.95rem;">${item.date}</p><h3>${item.title}</h3><p>${item.description}</p>`;
      container.appendChild(card);
    });
  });
}

function setupClassroomPage() {
  const searchInput = document.getElementById('roomSearch');
  const buildingSelect = document.getElementById('roomBuilding');
  const departmentSelect = document.getElementById('roomDepartment');
  const tbody = document.getElementById('roomTableBody');
  const emptyState = document.getElementById('roomEmpty');
  if (!searchInput || !buildingSelect || !departmentSelect || !tbody || !emptyState) return;

  fetch('../data/rooms.json')
    .then((response) => response.json())
    .then((rooms) => {
      const buildings = [...new Set(rooms.map((room) => room.buildingName))].sort();
      const departments = [...new Set(rooms.map((room) => room.department))].sort();
      buildings.forEach((building) => buildingSelect.appendChild(new Option(building, building)));
      departments.forEach((department) => departmentSelect.appendChild(new Option(department, department)));

      const render = () => {
        const query = searchInput.value.toLowerCase();
        const building = buildingSelect.value;
        const department = departmentSelect.value;
        const filtered = rooms.filter((room) => {
          const matchesSearch = [room.roomNumber, room.buildingName, room.department, room.availability, ...(room.equipment || [])]
            .some((value) => String(value).toLowerCase().includes(query));
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
          const row = document.createElement('tr');
          row.innerHTML = `<td>${room.roomNumber}</td><td>${room.buildingName}</td><td>${room.department}</td><td>${room.capacity}</td><td>${room.floor}</td><td>${room.equipment.join(', ')}</td><td>${room.availability}</td>`;
          tbody.appendChild(row);
        });
      };

      [searchInput, buildingSelect, departmentSelect].forEach((control) => control.addEventListener('input', render));
      render();
    });
}

window.addEventListener('DOMContentLoaded', () => initializePage());
