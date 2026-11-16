import {
  ChevronRight,
  CircleCheck,
  Circle,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Dumbbell,
  MapPin,
  Navigation,
  Play,
  Sun,
  Sunrise,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AL_MURU_AH_PILLARS, CORE_HADITHS, calculateQibla, compassPoint } from '../../data/lifeOsData';
import { useCompass } from '../../hooks/useCompass';
import { usePrayerTimes, useWeather } from '../../hooks/useLiveData';
import { useNow } from '../../hooks/useNow';
import {
  average,
  clampPct,
  lastSessionOfDay,
  nextDayIndex,
  sessionsInLastDays,
  totalVolume,
} from '../../lib/calc';
import {
  addDays,
  daysBetween,
  formatClock,
  formatCountdown,
  formatDMY,
  weekdayName,
  weekdayOf,
} from '../../lib/dates';
import { FARDHU, PRAYER_ORDER, currentPrayer, describeWeather, formatHijri, nextPrayer } from '../../lib/prayer';
import { useStore } from '../../store/context';
import { uid } from '../../store/state';
import { sound } from '../../utils/sound';
import { ActivityRings, Card, CardHeader } from '../ui';

const WEATHER_ICONS = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
};

const kg = (n) => Math.round(n).toLocaleString('en-MY');

/** Rough session length: ~45 s under the bar per set plus the programmed rest. */
const estimateMinutes = (day) =>
  Math.round(day.exercises.reduce((acc, e) => acc + e.sets * (45 + e.restSec), 0) / 300) * 5;

// ---------------------------------------------------------------------------

function WeatherStrip({ district, now }) {
  const wx = useWeather(district.name, district.lat, district.lng, now);
  const clock = (
    <span className="tabular shrink-0 text-[12px] font-medium text-mute">{formatClock(now)} MYT</span>
  );

  if (!wx.weather) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-mute">
          {wx.status === 'loading' ? (
            <>Checking {district.name} weather…</>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Weather needs a connection</span>
            </>
          )}
        </span>
        {clock}
      </div>
    );
  }

  const { label, icon } = describeWeather(wx.weather.code);
  const Icon = WEATHER_ICONS[icon] || Cloud;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-3" data-testid="weather">
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ivory/90">
        <Icon className="h-4 w-4 shrink-0 text-rest" aria-hidden="true" />
        <span className="tabular font-semibold text-white">{Math.round(wx.weather.temp)}°C</span>
        <span className="truncate text-mute">
          {label}
          {wx.weather.feels != null && ` · feels ${Math.round(wx.weather.feels)}°`}
          {wx.status === 'saved' && ` · as of ${formatClock(wx.fetchedAt)}`}
        </span>
      </span>
      {clock}
    </div>
  );
}

function ReadinessCard({ today, now, district }) {
  const { state, dispatch } = useStore();
  const { sessions, active, routine, settings, protein } = state;

  const todaysSessions = sessions.filter((s) => s.date === today);
  const volumeToday =
    todaysSessions.reduce((acc, s) => acc + totalVolume(s.sets), 0) + (active ? totalVolume(active.sets) : 0);

  // Compare against the last time this same session was done.
  const dayId = active?.dayId ?? todaysSessions.at(-1)?.dayId ?? routine[nextDayIndex(routine, sessions)]?.id;
  const reference = lastSessionOfDay(
    sessions.filter((s) => s.date !== today),
    dayId,
  );
  const volumeTarget = reference ? totalVolume(reference.sets) : 0;
  const volumePct = volumeTarget > 0 ? (volumeToday / volumeTarget) * 100 : volumeToday > 0 ? 100 : 0;

  const proteinToday = protein[today] || 0;
  const proteinPct = (proteinToday / settings.proteinTarget) * 100;
  const weekAvg = average(
    Array.from({ length: 7 }, (_, i) => protein[addDays(today, -(i + 1))]).filter((v) => v != null),
  );

  const recent = sessionsInLastDays(sessions, today, 7).length;
  const consistencyPct = (recent / settings.weeklyTarget) * 100;

  const rings = [
    { label: 'Volume', pct: volumePct, color: '#0A84FF' },
    { label: 'Protein', pct: proteinPct, color: '#FF9F0A' },
    { label: 'Consistency', pct: consistencyPct, color: '#10B981' },
  ];

  const addProtein = (grams) => {
    sound.playTap();
    dispatch({ type: 'ADD_PROTEIN', date: today, grams });
  };

  return (
    <Card className="space-y-3" data-testid="readiness">
      <CardHeader
        title="Daily Readiness"
        right={
          <span className="tabular shrink-0 text-[12px] font-medium text-accent">
            {weekdayName(today).slice(0, 3)} {formatDMY(today)}
          </span>
        }
      />

      <div className="flex items-center gap-4">
        <ActivityRings rings={rings} />
        <dl className="min-w-0 flex-1 space-y-2">
          <div>
            <dt className="flex items-center justify-between text-[12px] font-semibold text-sysblue">
              <span>Volume</span>
              <span className="tabular">{Math.round(clampPct(volumePct))}%</span>
            </dt>
            <dd className="tabular truncate text-[13px] text-white" data-testid="ring-volume">
              {kg(volumeToday)}
              <span className="text-mute">{volumeTarget > 0 ? ` / ${kg(volumeTarget)} kg` : ' kg'}</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between text-[12px] font-semibold text-rest">
              <span>Protein</span>
              <span className="tabular">{Math.round(clampPct(proteinPct))}%</span>
            </dt>
            <dd className="tabular truncate text-[13px] text-white" data-testid="ring-protein">
              {proteinToday}
              <span className="text-mute"> / {settings.proteinTarget} g</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between text-[12px] font-semibold text-accent">
              <span>Consistency</span>
              <span className="tabular">{Math.round(clampPct(consistencyPct))}%</span>
            </dt>
            <dd className="tabular truncate text-[13px] text-white">
              {recent}
              <span className="text-mute"> / {settings.weeklyTarget} sessions · 7 days</span>
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-mute">
          <span>Log protein</span>
          {weekAvg > 0 && <span className="tabular">7-day average {Math.round(weekAvg)} g</span>}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[10, 25, 40].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => addProtein(g)}
              className="ios-press tabular h-10 rounded-xl bg-rest/15 text-[14px] font-semibold text-rest"
            >
              +{g} g
            </button>
          ))}
          <button
            type="button"
            onClick={() => addProtein(-10)}
            disabled={proteinToday === 0}
            aria-label="Remove 10 grams of protein"
            className="ios-press tabular h-10 rounded-xl bg-elevated text-[14px] font-semibold text-ivory disabled:opacity-35"
          >
            −10 g
          </button>
        </div>
      </div>

      <WeatherStrip district={district} now={now} />
    </Card>
  );
}

function QuickStartCard({ today, now, onOpenWorkout }) {
  const { state, dispatch } = useStore();
  const { routine, sessions, active } = state;

  if (active) {
    return (
      <button
        type="button"
        onClick={onOpenWorkout}
        className="ios-card ios-press flex w-full items-center justify-between gap-3 border-accent/40 bg-accent/10 p-4 text-left"
        data-testid="resume-workout"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Session in progress</p>
          <p className="truncate text-[17px] font-bold text-white">{active.dayName}</p>
          <p className="tabular text-[13px] text-mute">
            {Math.max(0, Math.floor((now - active.startedAt) / 60000))} min · {active.sets.length} sets · {kg(totalVolume(active.sets))} kg
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-accent" />
      </button>
    );
  }

  const day = routine[nextDayIndex(routine, sessions)];
  if (!day || !day.exercises.length) return null;
  const last = lastSessionOfDay(sessions, day.id);
  const doneToday = sessions.some((s) => s.date === today);
  const ago = last ? daysBetween(last.date, today) : null;

  return (
    <Card className="space-y-3" data-testid="quick-start">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mute">
            {doneToday ? 'Trained today · next up' : 'Next workout'}
          </p>
          <h2 className="truncate text-[19px] font-bold tracking-tight text-white">{day.name}</h2>
          <p className="truncate text-[13px] text-mute">{day.focus}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Dumbbell className="h-5 w-5 text-accent" aria-hidden="true" />
        </div>
      </div>
      <p className="tabular text-[12px] text-mute">
        {day.exercises.length} exercises · about {estimateMinutes(day)} min
        {ago != null && ` · last done ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}`}
      </p>
      <button
        type="button"
        onClick={() => {
          sound.playTap();
          dispatch({ type: 'START_SESSION', dayId: day.id, id: uid(), now: Date.now() });
          onOpenWorkout();
        }}
        className="ios-press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-bold text-black"
      >
        <Play className="h-4 w-4 fill-current" /> Start {day.name}
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function QiblaDial({ bearing, heading }) {
  // With a live heading the needle shows where to turn; without one, north is up.
  const rotation = heading == null ? bearing : (bearing - heading + 360) % 360;
  const off = heading == null ? null : Math.min(rotation, 360 - rotation);
  const aligned = off != null && off <= 4;
  const tone = aligned ? '#10B981' : '#D4AF37';

  return (
    <div className="relative h-[76px] w-[76px] shrink-0" aria-hidden="true">
      <svg viewBox="0 0 76 76" className="h-full w-full">
        <circle cx="38" cy="38" r="35" fill="#000" stroke={tone} strokeOpacity={aligned ? 0.9 : 0.4} strokeWidth="2" />
        {[0, 90, 180, 270].map((deg) => (
          <line key={deg} x1="38" y1="6" x2="38" y2="11" stroke="#98989F" strokeWidth="1.5" transform={`rotate(${deg - (heading ?? 0)} 38 38)`} />
        ))}
        <text
          x="38"
          y="20"
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill="#98989F"
          transform={`rotate(${-(heading ?? 0)} 38 38)`}
        >
          N
        </text>
        <g transform={`rotate(${rotation} 38 38)`} style={{ transition: 'transform 180ms ease-out' }}>
          <path d="M38 9 L44 38 L38 33 L32 38 Z" fill={tone} />
          <circle cx="38" cy="38" r="3" fill={tone} />
        </g>
      </svg>
    </div>
  );
}

function QiblaBlock({ district }) {
  const compass = useCompass();
  const [gps, setGps] = useState(null); // { lat, lng } — used on the device only, never stored
  const [gpsError, setGpsError] = useState('');

  const qibla = useMemo(
    () => (gps ? calculateQibla(gps.lat, gps.lng) : calculateQibla(district.lat, district.lng)),
    [gps, district],
  );

  const locate = () => {
    sound.playTap();
    setGpsError('');
    if (!('geolocation' in navigator)) {
      setGpsError('This device has no location service.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(`Location not shared — using ${district.name}.`),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const turn =
    compass.heading == null
      ? null
      : (() => {
          const diff = (qibla.bearing - compass.heading + 540) % 360 - 180;
          if (Math.abs(diff) <= 4) return 'Facing Qibla';
          return `Turn ${Math.round(Math.abs(diff))}° ${diff > 0 ? 'right' : 'left'}`;
        })();

  const compassNote = {
    waiting: 'Waiting for the compass… move the phone in a figure of eight.',
    denied: 'Motion access was declined. Allow it in Settings → Safari → Motion & Orientation.',
    unsupported: 'This device has no compass sensor.',
  }[compass.status];

  return (
    <div className="rounded-2xl bg-elevated/70 p-3" data-testid="qibla">
      <div className="flex items-center gap-3">
        <QiblaDial bearing={qibla.bearing} heading={compass.heading} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-mute">Qibla from {gps ? 'your location' : district.name}</p>
          <p className="tabular text-[20px] font-bold leading-tight text-gold" data-testid="qibla-bearing">
            {qibla.bearing.toFixed(1)}° {compassPoint(qibla.bearing)}
          </p>
          <p className="tabular text-[12px] text-mute">
            {qibla.distanceKm.toLocaleString('en-MY')} km to Makkah
            {turn && <span className={turn === 'Facing Qibla' ? 'font-semibold text-accent' : 'text-ivory'}> · {turn}</span>}
          </p>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            compass.start();
          }}
          className="ios-press flex h-10 items-center justify-center gap-1.5 rounded-xl bg-black/40 text-[13px] font-semibold text-white"
        >
          <Navigation className="h-3.5 w-3.5" /> {compass.status === 'active' ? 'Compass on' : 'Use compass'}
        </button>
        <button
          type="button"
          onClick={locate}
          className="ios-press flex h-10 items-center justify-center gap-1.5 rounded-xl bg-sysblue text-[13px] font-semibold text-white"
        >
          <MapPin className="h-3.5 w-3.5" /> {gps ? 'GPS on' : 'Use GPS'}
        </button>
      </div>
      {(compassNote || gpsError) && <p className="mt-2 text-[12px] leading-snug text-rest">{compassNote || gpsError}</p>}
      <p className="mt-2 text-[11px] leading-snug text-mute">
        Bearing is measured from true north. Hold the phone flat, away from metal and magnetic cases, and confirm
        against your mosque or an official falak reference.
      </p>
    </div>
  );
}

function PrayerCard({ today, now, district }) {
  const { state, dispatch } = useStore();
  const pt = usePrayerTimes(district.zone, today);
  const ticked = state.prayers[today] || {};
  const done = FARDHU.filter((p) => ticked[p]).length;
  const isFriday = weekdayOf(today) === 5;

  const upcoming = pt.times ? nextPrayer(pt.times, now) : null;
  const current = pt.times ? currentPrayer(pt.times, now) : null;

  const source = {
    live: `JAKIM e-Solat via waktusolat.app · updated ${formatClock(pt.fetchedAt || now)}`,
    saved: `Saved copy from ${formatClock(pt.fetchedAt || now)} — will refresh when online`,
    loading: 'Fetching today’s times…',
    unavailable: 'Times unavailable offline. Check e-solat.gov.my or your local mosque.',
  }[pt.status];

  return (
    <Card className="space-y-3" data-testid="prayer-card">
      <CardHeader
        icon={Compass}
        title="Waktu Solat & Qibla"
        right={
          <span className="tabular shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[12px] font-bold text-accent" data-testid="fardhu-count">
            {done}/5
          </span>
        }
      />

      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="truncate text-mute" data-testid="hijri-line">
          {pt.hijri ? `${district.zone} · ${formatHijri(pt.hijri)}` : `${district.name} · ${district.zone}`}
        </span>
        {upcoming && (
          <span className="tabular shrink-0 font-semibold text-gold" data-testid="next-prayer">
            {upcoming.name} in {formatCountdown(upcoming.at - now)}
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {PRAYER_ORDER.map((name) => {
          const isSyuruk = name === 'Syuruk';
          const isDone = Boolean(ticked[name]);
          const isCurrent = current === name;
          const label = name === 'Zohor' && isFriday ? 'Zohor · Jumaat' : name;
          const time = pt.times ? formatClock(pt.times[name]) : '--:--';

          if (isSyuruk) {
            return (
              <li key={name} className="flex h-11 items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 text-mute">
                <span className="flex items-center gap-2.5 text-[14px]">
                  <Sunrise className="h-4 w-4 text-rest" aria-hidden="true" />
                  {label}
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[11px]">Sunrise</span>
                </span>
                <span className="tabular text-[14px] font-semibold">{time}</span>
              </li>
            );
          }
          return (
            <li key={name}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                onClick={() => {
                  sound.playTap();
                  dispatch({ type: 'TOGGLE_PRAYER', date: today, name });
                }}
                data-testid={`prayer-${name}`}
                className={`ios-press flex h-11 w-full items-center justify-between rounded-xl border px-3 ${
                  isDone
                    ? 'border-accent/40 bg-accent/15'
                    : isCurrent
                      ? 'border-gold/50 bg-gold/10'
                      : 'border-white/5 bg-elevated/60'
                }`}
              >
                <span className="flex items-center gap-2.5 text-[14px] font-medium text-white">
                  {isDone ? (
                    <CircleCheck className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
                  ) : (
                    <Circle className="h-[18px] w-[18px] text-mute" aria-hidden="true" />
                  )}
                  {label}
                  {isCurrent && !isDone && <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-gold">Now</span>}
                </span>
                <span className="tabular text-[15px] font-semibold text-white">{time}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className={`text-[11px] leading-snug ${pt.status === 'unavailable' ? 'text-rest' : 'text-mute'}`} data-testid="prayer-source">
        {source}
      </p>

      <QiblaBlock district={district} />
    </Card>
  );
}

function HadithOfTheDay({ today, onOpenDeen }) {
  const { state } = useStore();
  // Rotate through the collection by date, so everyone sees the same one each day.
  const hadith = CORE_HADITHS[daysBetween('2026-01-01', today) % CORE_HADITHS.length] || CORE_HADITHS[0];
  const pillarsDone = Object.keys(state.muruah[today] || {}).length;

  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-gold">{hadith.lesson}</span>
        <span className="shrink-0 text-[11px] text-mute">{hadith.source}</span>
      </div>
      <p className="text-right font-arabic text-[20px] leading-[1.9] text-white" dir="rtl" lang="ar">
        {hadith.arabic}
      </p>
      <p className="text-[13px] leading-relaxed text-ivory/90">{hadith.english}</p>
      <p className="text-[13px] italic leading-relaxed text-accent/90" lang="ms">
        {hadith.malay}
      </p>
      <button
        type="button"
        onClick={onOpenDeen}
        className="ios-press flex h-10 w-full items-center justify-between rounded-xl bg-elevated/70 px-3 text-[13px] font-medium text-white"
      >
        <span>
          Al-Muru&apos;ah today{' '}
          <span className="tabular text-mute">
            {pillarsDone}/{AL_MURU_AH_PILLARS.length}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-mute" />
      </button>
    </Card>
  );
}

export function TodayTab({ today, district, onOpenWorkout, onOpenDeen }) {
  const now = useNow(15000);
  return (
    <>
      <ReadinessCard today={today} now={now} district={district} />
      <QuickStartCard today={today} now={now} onOpenWorkout={onOpenWorkout} />
      <PrayerCard today={today} now={now} district={district} />
      <HadithOfTheDay today={today} onOpenDeen={onOpenDeen} />
    </>
  );
}
