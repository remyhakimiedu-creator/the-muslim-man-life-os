// All calendar logic runs on Malaysia time (UTC+8, no daylight saving), so the
// app behaves the same wherever the phone thinks it is.
export const TZ = 'Asia/Kuala_Lumpur';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function klParts(date = new Date()) {
  const out = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out; // { day, month, year, hour, minute }
}

const pad = (n) => String(n).padStart(2, '0');

/** Calendar day in Malaysia as YYYY-MM-DD. Used as the key for every daily log. */
export function dayKey(date = new Date()) {
  const p = klParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** A day key is a pure calendar date, so do arithmetic on it in UTC. */
function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key, n) {
  const d = new Date(keyToUTC(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(fromKey, toKey) {
  return Math.round((keyToUTC(toKey) - keyToUTC(fromKey)) / 86400000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key) {
  return new Date(keyToUTC(key)).getUTCDay();
}

export function mondayOf(key) {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

/** DD/MM/YYYY */
export function formatDMY(key) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** DD/MM */
export function formatDM(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekdayName = (key) => WEEKDAYS[weekdayOf(key)];

/** 24-hour clock in Malaysia time, e.g. 05:47 */
export function formatClock(dateOrMs) {
  const p = klParts(new Date(dateOrMs));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** 95 -> 1:35, 3725 -> 1:02:05 */
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "2h 05m" / "14m" — for countdowns where seconds are noise */
export function formatCountdown(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}
