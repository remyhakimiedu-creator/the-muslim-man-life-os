import { useEffect, useState } from 'react';
import { dayKey } from '../lib/dates';

/**
 * The current time, refreshed on an interval and immediately whenever the app
 * comes back to the foreground (timers are frozen while an iPhone is locked).
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pageshow', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return now;
}

/** Today's date key in Malaysia time; rolls over by itself at midnight. */
export function useToday() {
  return dayKey(new Date(useNow(20000)));
}
