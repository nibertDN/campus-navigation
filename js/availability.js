// Availability engine: computes "open now" state for buildings from
// officeHours strings and live in-use state for rooms from schedules.

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function toMinutes(hour, minute, period) {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return h * 60 + minute;
}

function parseScheduleTime(time24) {
  const [h, m] = time24.split(':').map(Number);
  return h * 60 + m;
}

export function clockLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Building open state from officeHours like
 * "Mon-Fri 8:00 AM - 6:00 PM", "Daily 7:00 AM - 10:00 PM", "24/7".
 * Returns { open, label, opensAt, closesAt } or null when unparseable.
 */
export function isBuildingOpenNow(building, now = new Date()) {
  const raw = (building.officeHours || '').trim();
  if (!raw) return null;

  if (/^24\/?7/i.test(raw)) {
    return { open: true, label: 'Open 24/7', opensAt: 0, closesAt: 1440 };
  }

  const dayPart = raw.match(/^([A-Za-z]{3,5})(?:-([A-Za-z]{3}))?/i);
  if (!dayPart) return null;

  const timeMatch = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return null;

  const isDaily = /^daily/i.test(dayPart[1]);
  const days = new Set();
  if (isDaily) {
    for (let i = 0; i < 7; i += 1) days.add(i);
  } else {
    const dayAbbr = dayPart[1].slice(0, 3);
    const startDay = DAY_INDEX[dayAbbr];
    if (startDay === undefined) return null;
    const endDay = dayPart[2] ? (DAY_INDEX[dayPart[2]] ?? startDay) : startDay;
    for (let i = startDay; i <= endDay; i += 1) days.add(i % 7);
  }

  const opensAt = toMinutes(Number(timeMatch[1]), Number(timeMatch[2]), timeMatch[3].toUpperCase());
  const closesAt = toMinutes(Number(timeMatch[4]), Number(timeMatch[5]), timeMatch[6].toUpperCase());

  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Overnight schedules (e.g. 10:00 PM - 2:00 AM) wrap around midnight.
  const wrapsOvernight = closesAt <= opensAt;
  const inWindow = wrapsOvernight
    ? nowMinutes >= opensAt || nowMinutes < closesAt
    : nowMinutes >= opensAt && nowMinutes < closesAt;

  const open = days.has(nowDay) && inWindow;
  return {
    open,
    label: open
      ? `Open now • until ${clockLabel(closesAt)}`
      : `Closed • opens ${clockLabel(opensAt)}`,
    opensAt,
    closesAt,
  };
}

/**
 * Live room status from the weekly schedule.
 * Returns { inUse, subject, until } for a classroom.
 */
export function getRoomUsage(room, schedules, now = new Date()) {
  if (!room || !schedules) return { inUse: false };
  const day = WEEKDAYS_FULL[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hit = schedules.find((entry) =>
    entry.buildingId === room.buildingId &&
    entry.roomNumber === room.roomNumber &&
    entry.day === day &&
    parseScheduleTime(entry.start) <= nowMinutes &&
    nowMinutes < parseScheduleTime(entry.end)
  );

  if (hit) {
    return { inUse: true, subject: hit.subject, until: hit.end };
  }
  return { inUse: false };
}

export function isRoomAvailable(room, schedules) {
  return !getRoomUsage(room, schedules).inUse;
}

export { WEEKDAYS_FULL };