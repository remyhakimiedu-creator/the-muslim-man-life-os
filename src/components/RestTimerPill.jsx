import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { formatDuration } from '../lib/dates';
import { fractionLeft, remainingSeconds } from '../lib/timer';
import { useStore } from '../store/context';
import { sound } from '../utils/sound';

const RING = 34;
const STROKE = 4;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Floating rest countdown. It never counts ticks: every render works out the
 * time left from the stored end timestamp, so a locked screen can't skew it.
 */
export function RestTimerPill() {
  const { state, dispatch } = useStore();
  const { timer } = state;
  const tick = useNow(250);
  // The tick can be a fraction of a second older than a timer that has just
  // started. Clamp to the start so a 2:00 rest never flashes 2:01.
  const now = timer ? Math.max(tick, timer.endsAt - timer.durationMs) : tick;
  const [doneFlash, setDoneFlash] = useState(false);

  const left = timer ? remainingSeconds(timer.endsAt, now) : 0;

  // Watch for the end of the countdown. The check runs on a short interval and
  // again the instant the app returns to the foreground after a screen lock.
  useEffect(() => {
    if (!timer) return undefined;
    let handled = false;
    const check = () => {
      if (handled || remainingSeconds(timer.endsAt) > 0) return;
      handled = true;
      // Only chime if it finished just now, not for a timer left over from hours ago.
      const fresh = Date.now() - timer.endsAt < 60000;
      dispatch({ type: 'CLEAR_TIMER' });
      if (fresh) {
        sound.playRestChime();
        setDoneFlash(true);
      }
    };
    const id = setInterval(check, 200);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
    };
  }, [timer, dispatch]);

  // The "rest over" confirmation hides itself after a moment.
  useEffect(() => {
    if (!doneFlash) return undefined;
    const id = setTimeout(() => setDoneFlash(false), 2600);
    return () => clearTimeout(id);
  }, [doneFlash]);

  if (!timer && !doneFlash) return null;

  const wrapper =
    'pill-in fixed left-1/2 z-40 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 rounded-full border bg-card/95 shadow-2xl backdrop-blur-xl';
  const position = { bottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 66px)' };

  if (!timer) {
    return (
      <div className={`${wrapper} border-accent/50 px-4 py-2.5`} style={position} role="status" data-testid="rest-done">
        <div className="flex items-center justify-center gap-2 text-[15px] font-bold text-accent">
          <Check className="h-4 w-4" /> Rest over — next set
        </div>
      </div>
    );
  }

  const adjust = (delta) => {
    sound.playTap();
    dispatch({ type: 'ADJUST_TIMER', delta, now: Date.now() });
  };

  return (
    <div
      className={`${wrapper} border-rest/45 py-1.5 pl-2 pr-1.5`}
      style={position}
      role="timer"
      aria-label={`Rest timer, ${left} seconds left`}
      data-testid="rest-timer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="-rotate-90" aria-hidden="true">
            <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="#FF9F0A" strokeOpacity="0.2" strokeWidth={STROKE} />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="#FF9F0A"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - fractionLeft(timer, now))}
            />
          </svg>
          <div className="leading-none">
            <p className="tabular text-[19px] font-bold text-rest" data-testid="rest-remaining">
              {formatDuration(left)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-mute">Rest</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => adjust(-15)} className="ios-press tabular h-9 rounded-full bg-elevated px-3 text-[13px] font-semibold text-white">
            −15s
          </button>
          <button type="button" onClick={() => adjust(15)} className="ios-press tabular h-9 rounded-full bg-elevated px-3 text-[13px] font-semibold text-white">
            +15s
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              dispatch({ type: 'CLEAR_TIMER' });
            }}
            aria-label="Skip rest"
            className="ios-press flex h-9 w-9 items-center justify-center rounded-full bg-danger/20 text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
