import { useEffect, useMemo, useState } from 'react';
import { parseMonth, parseWeather, prayerApiUrl, weatherApiUrl } from '../lib/prayer';

const readJSON = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — live data still shows */
  }
};

/** Re-run a fetch when the phone comes back online. */
function useOnlineTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener('online', bump);
    return () => window.removeEventListener('online', bump);
  }, []);
  return tick;
}

// ---- prayer times -----------------------------------------------------------

const PT_PREFIX = 'mlos_pt_';
const ptKey = (zone, today) => `${PT_PREFIX}${zone}_${today.slice(0, 7)}`;

/**
 * Today's prayer times for a JAKIM zone.
 * The whole month is saved on the phone, so every remaining day of the month
 * works with no connection. Status: loading | live | saved | unavailable.
 */
export function usePrayerTimes(zone, today) {
  const scope = `${zone}|${today}`;
  const online = useOnlineTick();
  const [live, setLive] = useState(null);

  const saved = useMemo(() => {
    const cached = readJSON(ptKey(zone, today));
    const day = cached ? parseMonth(cached.json)?.days[today] : null;
    return day ? { day, fetchedAt: cached.fetchedAt } : null;
  }, [zone, today]);

  useEffect(() => {
    let cancelled = false;
    fetch(prayerApiUrl(zone))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const day = parseMonth(json)?.days[today];
        if (!day) throw new Error('No valid times for today in the response');
        const fetchedAt = Date.now();
        writeJSON(ptKey(zone, today), { json, fetchedAt });
        // Drop earlier months so the cache never grows.
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k?.startsWith(PT_PREFIX) && !k.endsWith(today.slice(0, 7))) localStorage.removeItem(k);
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setLive({ scope, day, fetchedAt });
      })
      .catch(() => {
        if (!cancelled) setLive({ scope, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [zone, today, scope, online]);

  if (live?.scope === scope && live.day) return { status: 'live', ...live.day, fetchedAt: live.fetchedAt };
  if (saved) return { status: 'saved', ...saved.day, fetchedAt: saved.fetchedAt };
  if (live?.scope === scope && live.failed) return { status: 'unavailable', times: null, hijri: null, fetchedAt: null };
  return { status: 'loading', times: null, hijri: null, fetchedAt: null };
}

// ---- weather ----------------------------------------------------------------

const WX_KEY = 'mlos_weather';
const WX_REFRESH_MS = 20 * 60000;
const WX_STALE_MS = 3 * 3600000; // older than this is misleading, so hide it

/** Current conditions from Open-Meteo. Status: loading | live | saved | unavailable. */
export function useWeather(place, lat, lng, now) {
  const online = useOnlineTick();
  const [live, setLive] = useState(null);
  // One refresh slot per 20 minutes while the app stays open.
  const slot = Math.floor(now / WX_REFRESH_MS);

  // Tiny value, read on each render so a stale copy ages out as time passes.
  const cached = readJSON(WX_KEY);
  const saved = cached?.place === place && cached.weather ? cached : null;

  useEffect(() => {
    let cancelled = false;
    fetch(weatherApiUrl(lat, lng))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const weather = parseWeather(json);
        if (!weather) throw new Error('Unexpected weather response');
        const entry = { place, weather, fetchedAt: Date.now() };
        writeJSON(WX_KEY, entry);
        if (!cancelled) setLive(entry);
      })
      .catch(() => {
        if (!cancelled) setLive({ place, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [place, lat, lng, slot, online]);

  if (live?.place === place && live.weather) return { status: 'live', ...live };
  if (saved && now - saved.fetchedAt < WX_STALE_MS) return { status: 'saved', ...saved };
  if (live?.place === place && live.failed) return { status: 'unavailable', weather: null };
  return { status: 'loading', weather: null };
}
