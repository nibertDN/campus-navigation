import { storage } from './storage.js';
import { showToast } from './notifications.js';

const defaultSettings = {
  theme: 'light',
  fontSize: 'medium',
  notifications: 'enabled',
  mapZoom: '14',
  mapStyle: 'default',
  attendanceWindow: '60',
};

export function setupSettingsPage() {
  const themePreference = document.getElementById('themePreference');
  const fontSizePreference = document.getElementById('fontSizePreference');
  const notificationToggle = document.getElementById('notificationToggle');
  const mapZoomPreference = document.getElementById('mapZoomPreference');
  const mapStylePreference = document.getElementById('mapStylePreference');
  const attendanceWindow = document.getElementById('attendanceWindow');
  const saveButton = document.getElementById('saveSettingsButton');
  const summary = document.getElementById('settingsSummary');

  if (!themePreference || !fontSizePreference || !notificationToggle || !mapZoomPreference || !mapStylePreference || !attendanceWindow || !saveButton || !summary) return;

  const settings = { ...defaultSettings, ...storage.get('campusSettings', {}) };
  populateSettings(settings, summary);

  saveButton.addEventListener('click', () => {
    const updated = {
      theme: themePreference.value,
      fontSize: fontSizePreference.value,
      notifications: notificationToggle.value,
      mapZoom: mapZoomPreference.value,
      mapStyle: mapStylePreference.value,
      attendanceWindow: attendanceWindow.value,
    };
    storage.set('campusSettings', updated);
    populateSettings(updated, summary);
    showToast('Settings saved', 'Your site preferences are stored locally.', 'success');
    applyTheme(updated.theme);
  });
}

export function applyTheme(theme) {
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.body.classList.toggle('theme-light', theme !== 'dark');
}

function populateSettings(settings, summary) {
  document.getElementById('themePreference').value = settings.theme;
  document.getElementById('fontSizePreference').value = settings.fontSize;
  document.getElementById('notificationToggle').value = settings.notifications;
  document.getElementById('mapZoomPreference').value = settings.mapZoom;
  document.getElementById('mapStylePreference').value = settings.mapStyle;
  document.getElementById('attendanceWindow').value = settings.attendanceWindow;
  summary.textContent = `Theme: ${settings.theme}, Font size: ${settings.fontSize}, Notifications: ${settings.notifications}.`;
}

export function loadSavedSettings() {
  return { ...defaultSettings, ...storage.get('campusSettings', {}) };
}
