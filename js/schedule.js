import { normalizeText, formatDate } from './utils.js';
import { loadJson } from './dataLoader.js';

export async function setupSchedulePage() {
  const searchInput = document.getElementById('scheduleSearch');
  const daySelect = document.getElementById('scheduleDay');
  const viewSelect = document.getElementById('scheduleView');
  const container = document.getElementById('scheduleContainer');
  const emptyState = document.getElementById('scheduleEmpty');
  if (!searchInput || !daySelect || !viewSelect || !container || !emptyState) return;

  const loadSchedules = async () => {
    const schedules = await loadJson('../data/schedules.json');
    const query = normalizeText(searchInput.value);
    const day = daySelect.value;
    const view = viewSelect.value;

    const filtered = schedules.filter((schedule) => {
      const matchesSearch = [schedule.subject, schedule.instructor, schedule.roomNumber, schedule.department]
        .some((value) => normalizeText(value).includes(query));
      const matchesDay = day === 'all' || schedule.day === day;
      return matchesSearch && matchesDay;
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');

    if (view === 'daily') {
      const grouped = filtered.reduce((group, item) => {
        group[item.day] = group[item.day] || [];
        group[item.day].push(item);
        return group;
      }, {});

      Object.entries(grouped).forEach(([dayName, items]) => {
        const section = document.createElement('section');
        section.innerHTML = `<h3>${dayName}</h3>`;
        items.sort((a, b) => a.start.localeCompare(b.start)).forEach((schedule) => {
          const item = document.createElement('div');
          item.className = 'feature-card';
          item.innerHTML = `<h4>${schedule.subject}</h4><p>${schedule.start} - ${schedule.end} • ${schedule.roomNumber}</p><p>${schedule.instructor}</p><p style="color:var(--muted);">${schedule.department}</p>`;
          section.appendChild(item);
        });
        container.appendChild(section);
      });
    } else {
      const table = document.createElement('table');
      table.innerHTML = `<thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th><th>Instructor</th><th>Department</th></tr></thead>`;
      const body = document.createElement('tbody');
      filtered.sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start)).forEach((schedule) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${schedule.day}</td><td>${schedule.start} - ${schedule.end}</td><td>${schedule.subject}</td><td>${schedule.roomNumber}</td><td>${schedule.instructor}</td><td>${schedule.department}</td>`;
        body.appendChild(row);
      });
      table.appendChild(body);
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      wrapper.appendChild(table);
      container.appendChild(wrapper);
    }
  };

  searchInput.addEventListener('input', loadSchedules);
  daySelect.addEventListener('change', loadSchedules);
  viewSelect.addEventListener('change', loadSchedules);
  loadSchedules();
}
