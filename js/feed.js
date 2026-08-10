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
          <span class="post-badge post-badge--${post.category.toLowerCase()}">${post.category}</span>
          <span class="post-date">${formatFeedDate(post.date)}</span>
        </div>
        <h4>${post.title}</h4>
        <p>${post.message}</p>
        <span class="post-source post-source--${post.source === 'You' ? 'you' : 'school'}">${post.source === 'You' ? 'Posted by you' : 'Posted by CCTCCampus'}</span>
      </div>
    </article>`;
}

function renderFeed(container, items) {
  if (!container) return;
  container.innerHTML = items.map(postCardHTML).join('');
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
   Home page: feed + composer + open now + upcoming events
   ------------------------------------------------------------ */

export async function setupHomePage() {
  const feedList = document.getElementById('homeFeedList');
  const openNowGrid = document.getElementById('openNowGrid');
  const openNowStats = document.getElementById('openNowStats');
  const eventMiniList = document.getElementById('eventMiniList');

  const [announcements, events, buildings, schedules, rooms] = await Promise.all([
    loadJson(dataPath('announcements.json')),
    loadJson(dataPath('events.json')),
    loadJson(dataPath('buildings.json')),
    loadJson(dataPath('schedules.json')),
    loadJson(dataPath('rooms.json')),
  ]);

  if (feedList) {
    const refresh = () => {
      const items = buildPostItems(announcements, storage.get(POSTS_KEY, []));
      const filter = getActiveFilter();
      renderFeed(feedList, items.filter((item) => filter === 'all' || item.category === filter));
    };
    setupComposer(refresh);
    setupFeedFilters(refresh);
    refresh();
  }

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
            <span class="event-mini-date">${formatFeedDate(event.date)} • ${event.time}</span>
            <strong>${event.title}</strong>
            <span class="event-mini-loc">${event.location}</span>
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
  const freeSamples = [];
  rooms.forEach((room) => {
    const state = roomStatus(room);
    if (state.buildingOpen && !state.inUse) {
      freeRooms += 1;
      if (freeSamples.length < 4) {
        freeSamples.push({
          label: `${room.buildingName} ${room.roomNumber}`,
          subject: room.department,
        });
      }
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
        (room) => room.buildingId === building.id && roomStatus(room).buildingOpen && !roomStatus(room).inUse
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
        <span class="post-badge post-badge--${event.category.toLowerCase()}">${event.category}</span>
      </div>
      <h3>${event.title}</h3>
      <p class="event-card-date">${formatFeedDate(event.date)} • ${event.time}</p>
      <p class="event-card-loc">${svgIcon('pin', 15)} ${event.location}</p>
      <p>${event.description}</p>
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