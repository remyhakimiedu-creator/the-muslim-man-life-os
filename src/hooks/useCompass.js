import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Device compass heading in degrees from north.
 * iOS needs a tap before it will share motion data, so nothing starts until
 * `start()` is called from a button. Status: idle | waiting | active | denied | unsupported.
 */
export function useCompass() {
  const [heading, setHeading] = useState(null);
  const [status, setStatus] = useState('idle');
  const handlerRef = useRef(null);

  const stop = useCallback(() => {
    if (!handlerRef.current) return;
    window.removeEventListener('deviceorientationabsolute', handlerRef.current, true);
    window.removeEventListener('deviceorientation', handlerRef.current, true);
    handlerRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
      setStatus('unsupported');
      return;
    }
    try {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const answer = await window.DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') {
          setStatus('denied');
          return;
        }
      }
    } catch {
      setStatus('denied');
      return;
    }
    if (handlerRef.current) return;

    const handler = (e) => {
      let value = null;
      if (typeof e.webkitCompassHeading === 'number') {
        value = e.webkitCompassHeading; // iOS: already a compass heading
      } else if (e.absolute && typeof e.alpha === 'number') {
        value = (360 - e.alpha) % 360; // Android: alpha runs counter-clockwise
      }
      if (value === null || Number.isNaN(value)) return;
      setHeading(Math.round(value));
      setStatus('active');
    };
    handlerRef.current = handler;
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    setStatus((s) => (s === 'active' ? s : 'waiting'));
  }, []);

  useEffect(() => stop, [stop]);

  return { heading, status, start };
}
