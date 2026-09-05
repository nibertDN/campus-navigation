// Campus feed: school announcements + user posts, "open now" availability,
// upcoming events. All graphics are inline SVG that inherit the active theme.
import { loadJson } from './dataLoader.js';
import { storage } from './storage.js';
import { showToast } from './notifications.js';
import { isBuildingOpenNow, getRoomUsage, WEEKDAYS_FULL } from './availability.js';

const POSTS_KEY = 'campusPosts';
const REGISTRATIONS_KEY = 'campusEventRegistrations';

const currentPage = window.location.pathname.split('/').pop();
const DATA_BASE = currentPage === 'index.html' || currentPage === '' ? './data/' : '../data/';

function dataPath(name) {
  return `${DATA_BASE}${name}`;
}

/* ------------------------------------------------------------
   Inline SVG graphic set (stroke = currentColor so themes work)
   ------------------------------------------------------------ */

const ICONS = {
  megaphone: '<path d="M3 11v-2a1 1 0 0 1 1-1h1.5l8-4.8a1 1 0 0 1 1.5.86v12.88a1 1 0 0 1-1.5.86L5.5 13H4a1 1 0 0 1-1-1z"/><path d="M17 8.5a4.2 4.2 0 0 1 0 7"/><path d="M19.5 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M12 14h.01M16 14h.01M8 14h.01M12 17h.01M8 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  building: '<path d="M4 21h16"/><path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16"/><path d="M15 9h3a1 1 0 0 1 1 1v11"/><path d="M9.5 8h.01M9.5 11h.01M9.5 14h.01M9.5 17h.01"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  users: '<path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M20 19v-1.5a4 4 0 0 0-3-3.86"/><path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  sliders: '<path d="M3 8h11M17 8h4M3 16h4M11 16h10"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
};

export function svgIcon(name, size = 20) {
  const body = ICONS[name] || ICONS.spark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */

const CATEGORY_ICON = {
  Academic: 'book',
  Event: 'calendar',
  Safety: 'shield',
  General: 'megaphone',
  default: 'megaphone',
};

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryIcon(name) {
  return CATEGORY_ICON[name] || CATEGORY_ICON.default;
}

export function formatFeedDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildPostItems(announcements, userPosts) {
  const school = (announcements || []).map((item) => ({
    id: item.id,
    date: item.date,
    category: item.category || 'General',
    title: item.title,
    message: item.description,
    source: 'CCTCCampus',
  }));
  const users = (userPosts || []).map((post) => ({
    id: post.id,
    date: post.date,
    category: post.category || 'General',
    title: post.title,
    message: post.message,
    source: 'You',
  }));
  return [...users, ...school].sort((a, b) => b.date.localeCompare(a.date) || (a.source === 'You' ? -1 : 1));
}

function postCardHTML(post) {
  return `
    <article class="post-card">
      <div class="post-icon">${svgIcon(categoryIcon(post.category), 22)}</div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-badge post-badge--${post.category.toLowerCase()}">${escapeHTML(post.category)}</span>
          <span class="post-date">${formatFeedDate(post.date)}</span>
        </div>
        <h4>${escapeHTML(post.title)}</h4>
        <p>${escapeHTML(post.message)}</p>
        <span class="post-source post-source--${post.source === 'You' ? 'you' : 'school'}">${post.source === 'You' ? 'Posted by you' : 'Posted by CCTCCampus'}</span>
      </div>
    </article>`;
}

function setupComposer(renderedCallback) {
  const form = document.getElementById('postForm');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('postTitle').value.trim();
    const message = document.getElementById('postMessage').value.trim();
    const category = document.getElementById('postCategory').value;

    if (!title || !message) {
      showToast('Missing details', 'Add a title and a message to publish a post.', 'warning');
      return;
    }

    const posts = storage.get(POSTS_KEY, []);
    posts.unshift({
      id: `P${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      category,
      title,
      message,
    });
    storage.set(POSTS_KEY, posts);
    form.reset();
    showToast('Announcement posted', `"${title}" is now live on the campus feed.`, 'success');
    renderedCallback();
  });
}

function setupFeedFilters(renderedCallback) {
  const filterBar = document.getElementById('feedFilters');
  if (!filterBar) return;
  const chips = filterBar.querySelectorAll('[data-filter]');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderedCallback(chip.dataset.filter);
    });
  });
}

function getActiveFilter() {
  const active = document.querySelector('#feedFilters [data-filter].active');
  return active ? active.dataset.filter : 'all';
}

/* ------------------------------------------------------------
   Home page: quick links dashboard + open now + upcoming events
   ------------------------------------------------------------ */

const FAVORITES_KEY = 'campusQuickFavorites';

const QUICK_LINKS = [
  { id: 'map', label: 'Campus Map', desc: 'Find buildings & facilities', href: 'pages/map.html', icon: 'pin' },
  { id: 'buildings', label: 'Buildings', desc: 'Browse departments & hours', href: 'pages/buildings.html', icon: 'building' },
  { id: 'classrooms', label: 'Classrooms', desc: 'Check rooms & availability', href: 'pages/classrooms.html', icon: 'list' },
  { id: 'schedule', label: 'Schedule', desc: 'View daily timetables', href: 'pages/schedule.html', icon: 'clock' },
  { id: 'qr', label: 'QR Check-in', desc: 'Scan & log attendance', href: 'pages/qr.html', icon: 'sliders' },
  { id: 'lostfound', label: 'Lost & Found', desc: 'Report or find items', href: 'pages/lostfound.html', icon: 'search' },
  { id: 'events', label: 'Events', desc: 'See what is happening', href: 'pages/events.html', icon: 'calendar' },
  { id: 'announcements', label: 'Announcements', desc: 'Read campus updates', href: 'pages/announcements.html', icon: 'megaphone' },
  { id: 'emergency', label: 'Emergency', desc: 'Safety contacts & info', href: 'pages/emergency.html', icon: 'shield' },
  { id: 'profile', label: 'Profile', desc: 'Your account & activity', href: 'pages/profile.html', icon: 'users' },
  { id: 'about', label: 'About', desc: 'Learn about this portal', href: 'pages/about.html', icon: 'book' },
  { id: 'settings', label: 'Settings', desc: 'Theme, font & preferences', href: 'pages/settings.html', icon: 'sliders' },
];

const STAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

function greetingForHour(hour) {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function renderQuickClock() {
  const clock = document.getElementById('quickClock');
  if (!clock) return;

  const update = () => {
    const now = new Date();
    clock.innerHTML = `
      <span class="quick-clock-greeting">${greetingForHour(now.getHours())}</span>
      <strong class="quick-clock-time">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
      <span class="quick-clock-date">${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>`;
  };

  update();
  window.setInterval(update, 30 * 1000);
}

function renderQuickLinksGrid() {
  const grid = document.getElementById('quickLinksGrid');
  if (!grid) return;

  const favorites = storage.get(FAVORITES_KEY, []);

  const ordered = [...QUICK_LINKS].sort((a, b) => {
    const aFav = favorites.includes(a.id) ? 0 : 1;
    const bFav = favorites.includes(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  grid.innerHTML = ordered
    .map((link) => {
      const isFav = favorites.includes(link.id);
      return `
        <div class="quick-card${isFav ? ' quick-card--fav' : ''}">
          <button type="button" class="quick-star" data-id="${link.id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Remove from shortcuts' : 'Add to shortcuts'}">${STAR_SVG}</button>
          <a class="quick-card-link" href="${link.href}">
            <span class="quick-card-icon">${svgIcon(link.icon, 22)}</span>
            <strong>${link.label}</strong>
            <span class="quick-card-desc">${link.desc}</span>
          </a>
        </div>`;
    })
    .join('');

  grid.querySelectorAll('.quick-star').forEach((star) => {
    star.addEventListener('click', () => {
      const id = star.dataset.id;
      const current = storage.get(FAVORITES_KEY, []);
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      storage.set(FAVORITES_KEY, next);
      renderQuickLinksGrid();
    });
  });
}

export function setupQuickLinks() {
  renderQuickClock();
  renderQuickLinksGrid();
}

export async function setupHomePage() {
  setupQuickLinks();

  const openNowGrid = document.getElementById('openNowGrid');
  const openNowStats = document.getElementById('openNowStats');
  const eventMiniList = document.getElementById('eventMiniList');

  const [events, buildings, schedules, rooms] = await Promise.all([
    loadJson(dataPath('events.json')),
    loadJson(dataPath('buildings.json')),
    loadJson(dataPath('schedules.json')),
    loadJson(dataPath('rooms.json')),
  ]);

  if (openNowGrid || openNowStats) {
    renderOpenNow(buildings, rooms, schedules, openNowGrid, openNowStats);
  }

  if (eventMiniList && events.length) {
    eventMiniList.innerHTML = events
      .slice(0, 3)
      .map(
        (event) => `
        <a class="event-mini" href="pages/events.html">
          <div class="event-mini-icon">${svgIcon('calendar', 22)}</div>
          <div class="event-mini-body">
            <span class="event-mini-date">${formatFeedDate(event.date)} • ${escapeHTML(event.time)}</span>
            <strong>${escapeHTML(event.title)}</strong>
            <span class="event-mini-loc">${escapeHTML(event.location)}</span>
          </div>
        </a>`
      )
      .join('');
  }
}

function renderOpenNow(buildings, rooms, schedules, grid, stats) {
  const now = new Date();
  const today = WEEKDAYS_FULL[now.getDay()];

  const statusByBuilding = new Map(
    buildings.map((building) => [building.id, isBuildingOpenNow(building, now)])
  );

  const roomStatus = (room) => {
    const buildingState = statusByBuilding.get(room.buildingId);
    const usage = getRoomUsage(room, schedules, now);
    const accessible = !buildingState || buildingState.open;
    return { buildingOpen: accessible, ...usage };
  };

  const openBuildings = buildings.filter((building) => statusByBuilding.get(building.id)?.open);
  const openCount = openBuildings.length;

  let freeRooms = 0;
  rooms.forEach((room) => {
    const state = roomStatus(room);
    if (state.buildingOpen && !state.inUse) {
      freeRooms += 1;
    }
  });

  if (stats) {
    stats.innerHTML = `
      <div class="stat-strip">
        <div class="stat-strip-item"><span>${openCount}</span><em>buildings open</em></div>
        <div class="stat-strip-item"><span>${freeRooms}</span><em>rooms free now</em></div>
        <div class="stat-strip-item"><span>${today}</span><em>today's schedule</em></div>
      </div>`;
  }

  if (grid) {
    const cards = openBuildings.slice(0, 6).map((building) => {
      const state = statusByBuilding.get(building.id);
      const roomCount = rooms.filter(
        (room) => room.buildingId === building.id && !roomStatus(room).inUse
      ).length;
      return `
        <a class="open-card" href="pages/buildings.html">
          <div class="open-card-head">
            <span class="open-card-icon">${svgIcon('building', 22)}</span>
            <span class="status-dot status-dot--open" aria-hidden="true"></span>
          </div>
          <strong>${building.name}</strong>
          <span class="open-card-label">${state.label}</span>
          <span class="open-card-rooms">${roomCount} rooms available</span>
        </a>`;
    }).join('');

    grid.innerHTML = cards || `
      <div class="empty-state">
        <p>No buildings are open right now — check the ${'<a href="pages/buildings.html">building directory</a>'} for office hours.</p>
      </div>`;
  }
}

/* ------------------------------------------------------------
   Announcements page: full feed with composer + filters
   ------------------------------------------------------------ */

export async function setupAnnouncementsPage() {
  const feedList = document.getElementById('announcementFeed');
  const emptyState = document.getElementById('announcementEmpty');
  const searchInput = document.getElementById('announcementSearch');
  if (!feedList || !emptyState) return;

  const announcements = await loadJson(dataPath('announcements.json'));
  const deepQuery = new URLSearchParams(window.location.search).get('q');
  if (deepQuery && searchInput) searchInput.value = deepQuery;

  const refresh = () => {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const items = buildPostItems(announcements, storage.get(POSTS_KEY, []));
    const filter = getActiveFilter();
    const filtered = items.filter(
      (item) =>
        (filter === 'all' || item.category === filter) &&
        (!query ||
          item.title.toLowerCase().includes(query) ||
          item.message.toLowerCase().includes(query))
    );
    feedList.innerHTML = filtered.map(postCardHTML).join('');
    emptyState.classList.toggle('hidden', filtered.length > 0);
  };

  setupComposer(refresh);
  setupFeedFilters(refresh);
  searchInput?.addEventListener('input', refresh);
  refresh();
}

/* ------------------------------------------------------------
   Events page: cards with register actions + toasts
   ------------------------------------------------------------ */

export async function setupEventsPage() {
  const container = document.getElementById('eventCards');
  const emptyState = document.getElementById('eventEmpty');
  const searchInput = document.getElementById('eventSearch');
  if (!container || !emptyState) return;

  const events = await loadJson(dataPath('events.json'));
  const registrations = storage.get(REGISTRATIONS_KEY, []);
  const deepQuery = new URLSearchParams(window.location.search).get('q');
  if (deepQuery && searchInput) searchInput.value = deepQuery;

  const render = () => {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filtered = events.filter(
      (event) =>
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query)
    );

    container.innerHTML = '';
    if (!filtered.length) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    filtered.forEach((event) => {
      const registered = registrations.includes(event.id);
      const card = document.createElement('article');
      card.className = 'feature-card event-card';
      card.innerHTML = `
      <div class="event-card-head">
        <span class="post-icon">${svgIcon('calendar', 22)}</span>
        <span class="post-badge post-badge--${event.category.toLowerCase()}">${escapeHTML(event.category)}</span>
      </div>
      <h3>${escapeHTML(event.title)}</h3>
      <p class="event-card-date">${formatFeedDate(event.date)} • ${escapeHTML(event.time)}</p>
      <p class="event-card-loc">${svgIcon('pin', 15)} ${escapeHTML(event.location)}</p>
      <p>${escapeHTML(event.description)}</p>
      <button type="button" class="button ${registered ? 'button-secondary' : 'button-primary'} event-register" data-id="${event.id}" ${registered ? 'disabled' : ''}>
        ${registered ? 'Registered ✓' : 'Register for this event'}
      </button>`;
      container.appendChild(card);
    });

    container.querySelectorAll('.event-register').forEach((button) => {
      button.addEventListener('click', () => {
        const eventId = button.dataset.id;
        const next = [...registrations, eventId];
        storage.set(REGISTRATIONS_KEY, next);
        button.classList.remove('button-primary');
        button.classList.add('button-secondary');
        button.disabled = true;
        button.textContent = 'Registered ✓';
        showToast('Registration confirmed', 'You are registered for this campus event.', 'success');
      });
    });
  };

  searchInput?.addEventListener('input', render);
  render();
}

/* ------------------------------------------------------------
   Shared export used by other pages
   ------------------------------------------------------------ */

export function loadUserPosts() {
  return storage.get(POSTS_KEY, []);
}