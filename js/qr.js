import { loadJson } from './dataLoader.js';
import { showToast } from './notifications.js';
import { storage } from './storage.js';

let attendance = [];
let scanIntervalMinutes = 60;
let html5QrcodeScanner;

export async function setupQRPage() {
  const roomFilter = document.getElementById('qrRoomFilter');
  const qrPreview = document.getElementById('qrPreview');
  const scanButton = document.getElementById('scanButton');
  const attendanceList = document.getElementById('attendanceList');
  const attendanceEmpty = document.getElementById('attendanceEmpty');

  if (!roomFilter || !qrPreview || !scanButton || !attendanceList || !attendanceEmpty) return;

  const rooms = await loadJson('../data/rooms.json');
  rooms.forEach((room) => {
    const option = document.createElement('option');
    option.value = room.qrCodeKey;
    option.textContent = `${room.buildingName} ${room.roomNumber}`;
    roomFilter.appendChild(option);
  });

  roomFilter.addEventListener('change', () => {
    const selected = rooms.find((room) => room.qrCodeKey === roomFilter.value);
    renderQRPreview(selected, qrPreview);
  });

  scanButton.addEventListener('click', () => startScanner(roomFilter.value, attendanceList, attendanceEmpty));
  loadAttendance(attendanceList, attendanceEmpty);
  renderQRPreview(rooms[0], qrPreview);
}

function renderQRPreview(room, previewElement) {
  if (!room || !previewElement) return;
  previewElement.innerHTML = `<div><strong>${room.buildingName} ${room.roomNumber}</strong><p style="color:var(--muted);margin-top:0.5rem;">QR key: ${room.qrCodeKey}</p></div>`;
}

function loadAttendance(container, emptyState) {
  attendance = storage.get('campusAttendance', []);
  renderAttendance(container, emptyState);
}

function renderAttendance(container, emptyState) {
  container.innerHTML = '';
  if (attendance.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  attendance.slice().reverse().forEach((record) => {
    const card = document.createElement('article');
    card.className = 'feature-card';
    card.innerHTML = `<h4>${record.room}</h4><p>${record.date} • ${record.time}</p><p style="color:var(--muted);">${record.status}</p>`;
    container.appendChild(card);
  });
}

function startScanner(qrKey, container, emptyState) {
  const scannerElement = document.getElementById('qrScanner');
  if (!scannerElement) return;

  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().catch(() => {});
  }

  html5QrcodeScanner = new Html5Qrcode('qrScanner');
  html5QrcodeScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, (decodedText) => {
    if (decodedText === qrKey) {
      recordAttendance(decodedText, container, emptyState);
      showToast('Check-in successful', `Recorded attendance for ${decodedText}.`, 'success');
      html5QrcodeScanner.stop();
    } else {
      showToast('QR mismatch', 'Scanned QR code does not match the selected room.', 'warning');
    }
  }, (error) => {
    console.warn('QR scan error', error);
  }).catch((error) => {
    showToast('Scanner unavailable', 'Please allow camera access or use another device.', 'danger');
    console.error(error);
  });
}

function recordAttendance(roomKey, container, emptyState) {
  const now = new Date();
  const date = now.toLocaleDateString('en-US');
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const existing = attendance.find((entry) => entry.room === roomKey && entry.date === date);

  if (existing) {
    const previousTime = new Date(`${date} ${existing.time}`);
    const diff = (now - previousTime) / (1000 * 60);
    if (diff < scanIntervalMinutes) {
      showToast('Duplicate check-in blocked', `Already checked in for ${roomKey} within ${scanIntervalMinutes} minutes.`, 'warning');
      return;
    }
  }

  attendance.push({ room: roomKey, date, time, status: 'Checked in' });
  storage.set('campusAttendance', attendance);
  renderAttendance(container, emptyState);
}

export function applySettings(settings) {
  if (!settings) return;
  scanIntervalMinutes = Number(settings.attendanceWindow || 60);
}
