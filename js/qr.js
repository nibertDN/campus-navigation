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
  const simulateButton = document.getElementById('simulateScanButton');
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

  if (simulateButton) {
    simulateButton.addEventListener('click', () => {
      const selected = rooms.find((room) => room.qrCodeKey === roomFilter.value);
      if (!selected) {
        showToast('No room selected', 'Pick a classroom first.', 'warning');
        return;
      }
      simulateScan(selected, attendanceList, attendanceEmpty);
    });
  }

  loadAttendance(attendanceList, attendanceEmpty);
  renderQRPreview(rooms[0], qrPreview);
}

function renderQRPreview(room, previewElement) {
  if (!room || !previewElement) return;

  const previousCanvas = previewElement.querySelector('#qrSampleCanvas');
  if (previousCanvas) previousCanvas.remove();

  previewElement.innerHTML = `
    <strong>${room.buildingName} ${room.roomNumber}</strong>
    <p style="color:var(--muted);margin-top:0.5rem;">QR key: <code>${room.qrCodeKey}</code></p>
    <div id="qrSampleCanvas" style="background:#ffffff;border-radius:16px;padding:10px;display:inline-block;margin-top:0.9rem;box-shadow:0 8px 20px rgba(15,23,42,0.12);"></div>
    <p style="color:var(--muted);font-size:0.85rem;margin-top:0.9rem;">Scan this code with the camera to check in to this room.</p>
  `;

  const canvasHost = previewElement.querySelector('#qrSampleCanvas');
  if (window.QRCode && typeof QRCode === 'function') {
    new QRCode(canvasHost, {
      text: room.qrCodeKey,
      width: 168,
      height: 168,
      correctLevel: QRCode.CorrectLevel.M,
    });
    const canvas = canvasHost.querySelector('canvas');
    if (canvas && !canvasHost.querySelector('img')) {
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
    }
  } else {
    canvasHost.innerHTML = '<p style="padding:0.5rem;color:var(--muted);">QR library unavailable.</p>';
  }
}

function simulateScan(room, container, emptyState) {
  const ok = recordAttendance(room.qrCodeKey, container, emptyState);
  if (ok) {
    showToast('Check-in successful (simulated)', `Recorded attendance for ${room.qrCodeKey}.`, 'success');
  }
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
      return false;
    }
  }

  attendance.push({ room: roomKey, date, time, status: 'Checked in' });
  storage.set('campusAttendance', attendance);
  renderAttendance(container, emptyState);
  return true;
}

export function applySettings(settings) {
  if (!settings) return;
  scanIntervalMinutes = Number(settings.attendanceWindow || 60);
}
