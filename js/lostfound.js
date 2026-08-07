import { normalizeText, formatDate } from './utils.js';
import { storage } from './storage.js';
import { showToast } from './notifications.js';

let reports = [];

export function setupLostFoundPage() {
  const form = document.getElementById('lostFoundForm');
  const searchInput = document.getElementById('reportSearch');
  const statusSelect = document.getElementById('reportStatus');
  const sortSelect = document.getElementById('reportSort');
  const listContainer = document.getElementById('reportList');
  const emptyState = document.getElementById('reportEmpty');

  if (!form || !searchInput || !statusSelect || !sortSelect || !listContainer || !emptyState) return;
  reports = storage.get('campusLostFound', []);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const type = document.getElementById('reportType').value;
    const title = document.getElementById('reportTitle').value.trim();
    const category = document.getElementById('reportCategory').value;
    const location = document.getElementById('reportLocation').value.trim();
    const date = document.getElementById('reportDate').value;
    const description = document.getElementById('reportDescription').value.trim();
    const contact = document.getElementById('reportContact').value.trim();

    const report = {
      id: `F${Date.now()}`,
      type,
      title,
      category,
      location,
      date,
      description,
      contact,
    };

    reports.push(report);
    storage.set('campusLostFound', reports);
    showToast('Report submitted', 'Your lost or found report has been stored locally.', 'success');
    form.reset();
    renderReports(listContainer, emptyState, searchInput, statusSelect, sortSelect);
  });

  [searchInput, statusSelect, sortSelect].forEach((control) => control.addEventListener('input', () => renderReports(listContainer, emptyState, searchInput, statusSelect, sortSelect)));
  renderReports(listContainer, emptyState, searchInput, statusSelect, sortSelect);
}

function renderReports(container, emptyState, searchInput, statusSelect, sortSelect) {
  const query = normalizeText(searchInput.value);
  const selectedStatus = statusSelect.value;
  const sortValue = sortSelect.value;

  const filtered = reports.filter((report) => {
    const matchesSearch = [report.title, report.location, report.description, report.category]
      .some((value) => normalizeText(value).includes(query));
    const matchesStatus = selectedStatus === 'all' || report.type === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const sorted = filtered.sort((a, b) => {
    if (sortValue === 'title') return a.title.localeCompare(b.title);
    return new Date(b.date) - new Date(a.date);
  });

  container.innerHTML = '';
  if (sorted.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  sorted.forEach((report) => {
    const card = document.createElement('article');
    card.className = 'feature-card';
    card.innerHTML = `<h3>${report.title}</h3><p style="margin:0.5rem 0;color:var(--muted);">${report.type.toUpperCase()} • ${report.category} • ${formatDate(report.date)}</p><p>${report.description}</p><p style="margin-top:0.75rem;font-weight:700;">Location: ${report.location}</p><p style="margin-top:0.5rem;color:var(--muted);">Contact: ${report.contact}</p>`;
    container.appendChild(card);
  });
}
