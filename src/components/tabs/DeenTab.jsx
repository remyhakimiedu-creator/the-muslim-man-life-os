import { BookOpen, ChevronDown, CircleCheck, Circle, Shield } from 'lucide-react';
import { useState } from 'react';
import { AL_MURU_AH_PILLARS, CORE_HADITHS } from '../../data/lifeOsData';
import { addDays } from '../../lib/dates';
import { useStore } from '../../store/context';
import { sound } from '../../utils/sound';
import { Card, CardHeader } from '../ui';

function PillarsCard({ today }) {
  const { state, dispatch } = useStore();
  const ticked = state.muruah[today] || {};
  const done = AL_MURU_AH_PILLARS.filter((p) => ticked[p.pillar]).length;

  // Last 7 days as a quiet streak strip (today on the right).
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6);
    return { key, count: Object.keys(state.muruah[key] || {}).length };
  });

  return (
    <Card className="space-y-3" data-testid="pillars-card">
      <CardHeader
        icon={Shield}
        title={
          <>
            <span className="font-arabic text-gold" lang="ar">
              الْمُرُوءَة
            </span>{' '}
            · Al-Muru&apos;ah
          </>
        }
        right={
          <span className="tabular shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[12px] font-bold text-accent" data-testid="pillars-count">
            {done}/{AL_MURU_AH_PILLARS.length}
          </span>
        }
      />
      <p className="text-[13px] leading-relaxed text-ivory/85">
        Anchored by <strong className="font-semibold text-accent">Taqwa</strong>, guided by{' '}
        <strong className="font-semibold text-gold">Hikmah</strong>, strengthened by{' '}
        <strong className="font-semibold text-sysblue">Hilm</strong>, and shown through good character. Tick each one you
        honoured today.
      </p>

      <div className="flex items-end justify-between gap-1.5" aria-label="Pillars honoured over the last 7 days">
        {week.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end overflow-hidden rounded-md bg-white/8">
              <div
                className={`w-full rounded-md ${d.key === today ? 'bg-accent' : 'bg-accent/50'}`}
                style={{ height: `${(d.count / AL_MURU_AH_PILLARS.length) * 100}%` }}
              />
            </div>
            <span className={`tabular text-[10px] ${d.key === today ? 'font-bold text-white' : 'text-mute'}`}>{d.key.slice(8)}</span>
          </div>
        ))}
      </div>

      <ul className="space-y-1.5">
        {AL_MURU_AH_PILLARS.map((item) => {
          const on = Boolean(ticked[item.pillar]);
          return (
            <li key={item.pillar}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => {
                  sound.playTap();
                  dispatch({ type: 'TOGGLE_MURUAH', date: today, pillar: item.pillar });
                }}
                data-testid={`pillar-${item.pillar}`}
                className={`ios-press flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                  on ? 'border-accent/40 bg-accent/15' : 'border-white/5 bg-elevated/70'
                }`}
              >
                {on ? (
                  <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-mute" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold text-white">
                      {item.pillar}{' '}
                      <span className="font-arabic text-[16px] font-normal text-gold" lang="ar">
                        {item.arabic}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-mute">{item.meaning}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ivory/85">{item.daily}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-snug text-mute">
        A personal self-review aid. These qualities are well established in Islamic teaching; arranging them as seven
        pillars is this app’s own framing, not a ruling or a formal classification by the scholars.
      </p>
    </Card>
  );
}

function HadithItem({ hadith }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl bg-elevated/60 p-3">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-semibold text-gold">{hadith.lesson}</span>
        <span className="shrink-0 text-mute">{hadith.source}</span>
      </div>
      <p className="mt-2 text-right font-arabic text-[19px] leading-[1.9] text-white" dir="rtl" lang="ar">
        {hadith.arabic}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ivory/90">{hadith.english}</p>

      {open && (
        <div className="fade-up mt-2.5 space-y-2 border-t border-white/10 pt-2.5 text-[13px] leading-relaxed">
          <p className="italic text-mute">{hadith.transliteration}</p>
          <p className="italic text-accent/90" lang="ms">
            {hadith.malay}
          </p>
          <p className="text-ivory/90">
            <strong className="font-semibold text-accent">Apply today: </strong>
            {hadith.application}
          </p>
          <p className="text-ivory/90">
            <strong className="font-semibold text-sysblue">Reflect: </strong>
            {hadith.reflection}
          </p>
          <p className="text-[12px] text-mute">Grading: {hadith.grading}</p>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          sound.playTap();
          setOpen((v) => !v);
        }}
        className="ios-press mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-black/30 text-[12px] font-semibold text-mute"
      >
        {open ? 'Show less' : 'Malay, application & reflection'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
    </li>
  );
}

export function DeenTab({ today }) {
  return (
    <>
      <PillarsCard today={today} />
      <Card className="space-y-3">
        <CardHeader icon={BookOpen} iconClass="text-accent" title="Core Hadith & Leadership Principles" />
        <ul className="space-y-2">
          {CORE_HADITHS.map((h) => (
            <HadithItem key={h.id} hadith={h} />
          ))}
        </ul>
        <p className="text-[11px] leading-snug text-mute">
          Texts and references are given as narrated in the cited collections. For rulings or deeper explanation, ask a
          qualified teacher.
        </p>
      </Card>
    </>
  );
}
