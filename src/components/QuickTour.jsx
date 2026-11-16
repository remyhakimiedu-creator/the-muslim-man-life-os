import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { sound } from '../utils/sound';

const STEPS = [
  {
    title: 'Your day on one screen',
    body: 'Today shows your solat times, Qibla, training and protein rings. Tap a prayer to tick it off — it resets every morning.',
  },
  {
    title: 'Train one card at a time',
    body: 'Workout shows a single exercise. Log a set and the rest timer starts by itself, and stays accurate even if your screen locks.',
  },
  {
    title: 'These numbers are samples',
    body: 'Four weeks of sample history fill the charts. Open the gear icon → Data → Clear sample data before you log for real.',
  },
];

/** Dismissible first-run tour: three swipeable cards at the top of the screen. */
export function QuickTour({ onDone }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);

  const goTo = (i) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  };

  const last = index === STEPS.length - 1;

  return (
    <section
      className="ios-card overflow-hidden border-gold/40 bg-gradient-to-br from-card to-[#16221c]"
      aria-label="Quick tour"
      data-testid="quick-tour"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
          Quick tour · {index + 1} of {STEPS.length}
        </p>
        <button type="button" onClick={onDone} aria-label="Dismiss tour" className="ios-press -mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-mute">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) setIndex(Math.max(0, Math.min(STEPS.length - 1, i)));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {STEPS.map((step) => (
          <div key={step.title} className="w-full shrink-0 snap-center px-4 pb-1">
            <h2 className="text-[16px] font-bold text-white">{step.title}</h2>
            <p className="mt-1 text-[13px] leading-snug text-ivory/80">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((step, i) => (
            <span key={step.title} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-4 bg-gold' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            if (last) onDone();
            else goTo(index + 1);
          }}
          className="ios-press h-9 rounded-full bg-accent px-4 text-[13px] font-bold text-black"
        >
          {last ? 'Got it' : 'Next'}
        </button>
      </div>
    </section>
  );
}
