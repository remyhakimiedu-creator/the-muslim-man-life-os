import { dayKey, klParts } from './dates';

export const PRAYER_ORDER = ['Subuh', 'Syuruk', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];
export const FARDHU = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];

// Field names used by api.waktusolat.app (v2), which republishes JAKIM e-Solat data.
const API_FIELD = {
  Subuh: 'fajr',
  Syuruk: 'syuruk',
  Zohor: 'dhuhr',
  Asar: 'asr',
  Maghrib: 'maghrib',
  Isyak: 'isha',
};

export const prayerApiUrl = (zone) => `https://api.waktusolat.app/v2/solat/${zone}`;

const toMs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000; // API sends Unix seconds
};

/**
 * Wrong prayer times are worse than no prayer times. Reject anything that is
 * out of order or outside the range Malaysia ever sees.
 */
export function isPlausible(times) {
  const seq = PRAYER_ORDER.map((n) => times[n]);
  if (seq.some((t) => !Number.isFinite(t))) return false;
  for (let i = 1; i < seq.length; i++) if (seq[i] <= seq[i - 1]) return false;
  const hour = (ms) => {
    const p = klParts(new Date(ms));
    return p.hour + p.minute / 60;
  };
  const within = (name, lo, hi) => hour(times[name]) >= lo && hour(times[name]) <= hi;
  return (
    within('Subuh', 4.5, 6.75) &&
    within('Syuruk', 6, 7.75) &&
    within('Zohor', 12, 14) &&
    within('Asar', 15, 17.25) &&
    within('Maghrib', 18, 20) &&
    within('Isyak', 19.25, 21.25)
  );
}

/**
 * Turn one month of API data into { 'YYYY-MM-DD': { times, hijri } }.
 * Returns null when the payload isn't the shape we expect.
 */
export function parseMonth(json) {
  if (!json || !Array.isArray(json.prayers)) return null;
  const days = {};
  for (const row of json.prayers) {
    const times = {};
    for (const name of PRAYER_ORDER) times[name] = toMs(row?.[API_FIELD[name]]);
    if (!isPlausible(times)) continue;
    // Key each row by its own Subuh timestamp rather than trusting day/month fields.
    days[dayKey(new Date(times.Subuh))] = { times, hijri: row.hijri || null };
  }
  return Object.keys(days).length ? { zone: json.zone || null, days } : null;
}

/** The next prayer (or Syuruk) still ahead today, else null once Isyak has passed. */
export function nextPrayer(times, now = Date.now()) {
  for (const name of PRAYER_ORDER) {
    if (times[name] > now) return { name, at: times[name] };
  }
  return null;
}

/** The fardhu prayer whose time has most recently begun (Syuruk ends Subuh). */
export function currentPrayer(times, now = Date.now()) {
  if (now < times.Subuh) return null;
  if (now < times.Syuruk) return 'Subuh';
  if (now < times.Zohor) return null;
  if (now < times.Asar) return 'Zohor';
  if (now < times.Maghrib) return 'Asar';
  if (now < times.Isyak) return 'Maghrib';
  return 'Isyak';
}

const HIJRI_MONTHS = [
  'Muharam',
  'Safar',
  'Rabiulawal',
  'Rabiulakhir',
  'Jamadilawal',
  'Jamadilakhir',
  'Rejab',
  'Syaaban',
  'Ramadan',
  'Syawal',
  'Zulkaedah',
  'Zulhijah',
];

/** '1448-06-06' -> '6 Jamadilakhir 1448H'. The date comes from JAKIM, not from a formula. */
export function formatHijri(hijri) {
  if (typeof hijri !== 'string') return '';
  const [y, m, d] = hijri.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return '';
  return `${d} ${HIJRI_MONTHS[m - 1]} ${y}H`;
}

// WMO weather interpretation codes, as returned by Open-Meteo.
export function describeWeather(code) {
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code === 1) return { label: 'Mostly clear', icon: 'sun' };
  if (code === 2) return { label: 'Partly cloudy', icon: 'cloud-sun' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'drizzle' };
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rain' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rain' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Cloudy', icon: 'cloud' };
}

/** Pull the fields we show out of an Open-Meteo response; null if it isn't one. */
export function parseWeather(json) {
  const c = json?.current;
  if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code)) return null;
  return {
    temp: c.temperature_2m,
    feels: Number.isFinite(c.apparent_temperature) ? c.apparent_temperature : null,
    humidity: Number.isFinite(c.relative_humidity_2m) ? c.relative_humidity_2m : null,
    code: c.weather_code,
  };
}

export const weatherApiUrl = (lat, lng) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code' +
  '&timezone=Asia%2FKuala_Lumpur';
