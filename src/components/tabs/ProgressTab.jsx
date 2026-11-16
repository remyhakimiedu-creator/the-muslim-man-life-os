import { Activity, Award, History, Info, Plus, Ruler, Trash2, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fieldRange, muscleBalance, progressToward, round1, totalVolume, vTaperRatio, weeklySeries } from '../../lib/calc';
import { formatDMY, formatDuration } from '../../lib/dates';
import { useStore } from '../../store/context';
import { hasSampleData, uid } from '../../store/state';
import { sound } from '../../utils/sound';
import { BottomSheet, ConfirmModal } from '../overlays';
import { BalanceRadar, OverloadChart } from '../ProgressCharts';
import { Card, CardHeader, ProgressRing } from '../ui';

const FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'kg', max: 300 },
  { key: 'bodyFat', label: 'Body fat', unit: '%', max: 60 },
  { key: 'chest', label: 'Chest', unit: 'cm', max: 200 },
  { key: 'shoulders', label: 'Shoulders', unit: 'cm', max: 200 },
  { key: 'waist', label: 'Waist', unit: 'cm', max: 200 },
  { key: 'biceps', label: 'Flexed biceps', unit: 'cm', max: 80 },
];

const signed = (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;

// ---------------------------------------------------------------------------

function SampleBanner({ onClear }) {
  return (
    <div className="ios-card flex items-center gap-3 border-gold/35 bg-gold/10 p-3" data-testid="sample-banner">
      <Info className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-ivory/90">
        Charts include <strong className="font-semibold text-white">sample data</strong>. Clear it before you track for real.
      </p>
      <button type="button" onClick={onClear} className="ios-press h-9 shrink-0 rounded-full bg-gold px-3 text-[12px] font-bold text-black">
        Clear
      </button>
    </div>
  );
}

function RecompRings() {
  const { state } = useStore();
  const { measurements, settings } = state;

  const weight = fieldRange(measurements, 'weight');
  const fat = fieldRange(measurements, 'bodyFat');
  const taper = useMemo(() => {
    const rows = measurements.filter((m) => m.shoulders > 0 && m.waist > 0);
    if (!rows.length) return { first: null, latest: null };
    return {
      first: vTaperRatio(rows[0].shoulders, rows[0].waist),
      latest: vTaperRatio(rows.at(-1).shoulders, rows.at(-1).waist),
      shoulders: rows.at(-1).shoulders,
      waist: rows.at(-1).waist,
    };
  }, [measurements]);

  const rings = [
    {
      key: 'weight',
      label: 'Weight',
      color: '#10B981',
      value: weight.latest ? weight.latest.weight.toFixed(1) : '—',
      unit: 'kg',
      pct: weight.latest ? progressToward(weight.first.weight, weight.latest.weight, settings.weightGoal) : 0,
      goal: `Goal ${settings.weightGoal} kg`,
      note: weight.latest
        ? Math.abs(weight.latest.weight - settings.weightGoal) < 0.05
          ? 'On target'
          : `${Math.abs(weight.latest.weight - settings.weightGoal).toFixed(1)} kg to go`
        : 'Log your weight',
    },
    {
      key: 'bodyFat',
      label: 'Body fat',
      color: '#FF9F0A',
      value: fat.latest ? fat.latest.bodyFat.toFixed(1) : '—',
      unit: '%',
      pct: fat.latest ? progressToward(fat.first.bodyFat, fat.latest.bodyFat, settings.bodyFatGoal) : 0,
      goal: `Goal ${settings.bodyFatGoal}%`,
      note: fat.latest
        ? fat.first === fat.latest
          ? 'First entry'
          : `${signed(fat.latest.bodyFat - fat.first.bodyFat)} pts since start`
        : 'Optional',
    },
    {
      key: 'taper',
      label: 'V-taper',
      color: '#0A84FF',
      value: taper.latest ? taper.latest.toFixed(2) : '—',
      unit: 'ratio',
      pct: taper.latest ? progressToward(taper.first, taper.latest, settings.vTaperGoal) : 0,
      goal: `Goal ${settings.vTaperGoal.toFixed(2)}`,
      note: taper.latest ? `${taper.shoulders} ÷ ${taper.waist} cm` : 'Needs shoulders + waist',
    },
  ];

  return (
    <Card className="space-y-3" data-testid="recomp-rings">
      <CardHeader icon={Award} iconClass="text-accent" title="Body Recomposition" />
      <div className="grid grid-cols-3 gap-2">
        {rings.map((ring) => (
          <div key={ring.key} className="flex min-w-0 flex-col items-center text-center">
            <ProgressRing size={94} stroke={9} pct={ring.pct} color={ring.color} label={`${ring.label} progress to goal`}>
              <span className="tabular text-[19px] font-bold leading-none text-white" data-testid={`ring-${ring.key}`}>
                {ring.value}
              </span>
              <span className="mt-0.5 text-[11px] text-mute">{ring.unit}</span>
            </ProgressRing>
            <p className="mt-2 text-[13px] font-semibold text-white">{ring.label}</p>
            <p className="tabular text-[11px] font-medium" style={{ color: ring.color }}>
              {ring.goal}
            </p>
            <p className="tabular w-full truncate text-[11px] text-mute">{ring.note}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-mute">
        Each ring fills as you move from your first entry toward the goal. V-taper is shoulder ÷ waist circumference.
      </p>
    </Card>
  );
}

function OverloadCard({ today }) {
  const { state } = useStore();
  const { sessions, routine } = state;

  // Offer every lift in the routine plus any lift that only exists in history.
  const lifts = useMemo(() => {
    const map = new Map();
    for (const day of routine) for (const ex of day.exercises) map.set(ex.id, ex.name);
    for (const s of sessions) for (const set of s.sets) if (!map.has(set.exId)) map.set(set.exId, set.name);
    return [...map].map(([id, name]) => ({ id, name }));
  }, [routine, sessions]);

  const [picked, setPicked] = useState(null);
  const exId = lifts.some((l) => l.id === picked) ? picked : lifts[0]?.id;
  const exName = lifts.find((l) => l.id === exId)?.name ?? '';

  const { series, partialLast } = useMemo(() => {
    const all = weeklySeries(sessions, exId, today, 8);
    const firstUsed = all.findIndex((w) => w.sessions > 0);
    if (firstUsed === -1) return { series: [], partialLast: false };
    // The week in progress only joins the chart once it has a session in it;
    // an empty Monday would otherwise read as a collapse to zero.
    const thisWeekStarted = all.at(-1).sessions > 0;
    const weeks = thisWeekStarted ? all : all.slice(0, -1);
    return { series: weeks.slice(Math.min(firstUsed, Math.max(0, weeks.length - 2))), partialLast: thisWeekStarted };
  }, [sessions, exId, today]);

  const full = (partialLast ? series.slice(0, -1) : series).filter((w) => w.sessions > 0);
  const volumeChange = full.length >= 2 && full[0].volume > 0 ? ((full.at(-1).volume - full[0].volume) / full[0].volume) * 100 : null;
  const lifted = series.filter((w) => w.e1rm != null);
  const e1rmChange = lifted.length >= 2 ? lifted.at(-1).e1rm - lifted[0].e1rm : null;

  return (
    <Card className="space-y-3" data-testid="overload-card">
      <CardHeader icon={TrendingUp} iconClass="text-sysblue" title="Progressive Overload" />

      <label className="block">
        <span className="sr-only">Lift to chart</span>
        <select
          value={exId ?? ''}
          onChange={(e) => setPicked(e.target.value)}
          className="h-11 w-full rounded-xl border border-white/10 bg-elevated px-3 text-white"
          data-testid="lift-select"
        >
          {lifts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {series.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-mute">Finish a workout and your weekly trend appears here.</p>
      ) : (
        <>
          <div className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <span className="flex items-center gap-1.5 text-ivory">
              <span className="h-2 w-2 rounded-full bg-sysblue" /> Weekly volume
              {volumeChange != null && <strong className="font-semibold text-sysblue">{signed(volumeChange, 0)}%</strong>}
            </span>
            <span className="flex items-center gap-1.5 text-ivory">
              <span className="h-2 w-2 rounded-full bg-accent" /> Est. 1RM
              {e1rmChange != null && <strong className="font-semibold text-accent">{signed(e1rmChange)} kg</strong>}
            </span>
          </div>
          <OverloadChart series={series} exerciseName={exName} partialLast={partialLast} />
          <p className="text-[11px] leading-snug text-mute">
            {partialLast && 'Dashed = this week, still in progress. '}1RM is an Epley estimate from your best set each
            week, not a tested max.
          </p>
        </>
      )}
    </Card>
  );
}

function BalanceCard({ today }) {
  const { state } = useStore();
  const balance = useMemo(() => muscleBalance(state.sessions, today, 4), [state.sessions, today]);
  const empty = balance.every((b) => b.setsPerWeek === 0);
  const lowest = [...balance].sort((a, b) => a.setsPerWeek - b.setsPerWeek)[0];

  return (
    <Card className="space-y-2" data-testid="balance-card">
      <CardHeader icon={Activity} iconClass="text-accent" title="Muscle Balance" right={<span className="shrink-0 text-[11px] text-mute">sets / week · 4 wks</span>} />
      {empty ? (
        <p className="py-8 text-center text-[13px] text-mute">No sets logged in the last four weeks.</p>
      ) : (
        <>
          <BalanceRadar balance={balance} />
          <p className="text-[11px] leading-snug text-mute">
            Gold dashed ring = 10 sets a week, a common research-based floor for growth per muscle group. Lowest right now:{' '}
            <strong className="font-semibold text-ivory">
              {lowest.group} ({lowest.setsPerWeek})
            </strong>
            .
          </p>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MeasurementSheet({ open, onClose, today }) {
  const { state, dispatch } = useStore();
  const [date, setDate] = useState(today);
  const existing = state.measurements.find((m) => m.date === date && !m.sample);
  const latest = state.measurements.at(-1);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');

  const valueOf = (key) => (key in draft ? draft[key] : existing?.[key] != null ? String(existing[key]) : '');

  const save = () => {
    const entry = { id: existing?.id ?? uid(), date };
    let filled = 0;
    for (const f of FIELDS) {
      const raw = valueOf(f.key).trim();
      if (raw === '') {
        entry[f.key] = null;
        continue;
      }
      const n = Number.parseFloat(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0 || n > f.max) {
        setError(`${f.label} should be between 0 and ${f.max} ${f.unit}.`);
        return;
      }
      entry[f.key] = round1(n);
      filled++;
    }
    if (!filled) {
      setError('Enter at least one measurement.');
      return;
    }
    if (date > today) {
      setError('The date can’t be in the future.');
      return;
    }
    sound.playTap();
    dispatch({ type: 'LOG_MEASUREMENT', entry });
    setDraft({});
    setError('');
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Log measurements"
      subtitle="Fill in only what you measured today."
      testId="measure-sheet"
      footer={
        <button type="button" onClick={save} className="ios-press h-12 w-full rounded-2xl bg-accent text-[15px] font-bold text-black" data-testid="save-measurement">
          Save
        </button>
      }
    >
      <div className="space-y-2.5">
        {/* The native picker sits invisibly on top, so the date always reads DD/MM/YYYY. */}
        <label className="relative flex h-12 items-center justify-between gap-3 rounded-2xl bg-elevated px-3">
          <span className="text-[14px] text-ivory">Date</span>
          <span className="tabular font-semibold text-white" data-testid="measure-date-label">
            {formatDMY(date)}
          </span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value || today);
              setDraft({});
            }}
            aria-label="Measurement date"
            data-testid="measure-date"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {FIELDS.map((f) => (
            <label key={f.key} className="block rounded-2xl bg-elevated px-3 py-2">
              <span className="block text-[12px] text-mute">
                {f.label} ({f.unit})
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max={f.max}
                value={valueOf(f.key)}
                placeholder={latest?.[f.key] != null ? String(latest[f.key]) : '—'}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                data-testid={`measure-${f.key}`}
                className="tabular w-full bg-transparent text-[20px] font-bold text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <p className="text-[12px] leading-snug text-mute">
          For a fair trend, measure at the same time of day — ideally in the morning before eating. Tape readings and
          body-fat estimates vary, so watch the trend over weeks, not single entries.
        </p>
      </div>
    </BottomSheet>
  );
}

function MeasurementsCard({ today }) {
  const { state, dispatch } = useStore();
  const { measurements } = state;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const latest = measurements.at(-1);
  const recent = [...measurements].reverse().slice(0, 6);

  return (
    <Card className="space-y-3" data-testid="measurements-card">
      <CardHeader
        icon={Ruler}
        iconClass="text-gold"
        title="Body Measurements"
        right={
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setSheetOpen(true);
            }}
            className="ios-press flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-[13px] font-bold text-black"
            data-testid="log-measurement"
          >
            <Plus className="h-4 w-4" /> Log
          </button>
        }
      />

      {!latest ? (
        <p className="py-4 text-center text-[13px] text-mute">No measurements yet. Tap Log to add your first.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {FIELDS.map((f) => {
              const { first, latest: last } = fieldRange(measurements, f.key);
              const delta = first && last && first !== last ? last[f.key] - first[f.key] : null;
              return (
                <div key={f.key} className="min-w-0 rounded-2xl bg-elevated/80 px-2 py-2 text-center">
                  <p className="truncate text-[11px] text-mute">{f.label}</p>
                  <p className="tabular truncate text-[16px] font-bold text-white">
                    {last ? last[f.key] : '—'}
                    <span className="text-[11px] font-medium text-mute"> {f.unit}</span>
                  </p>
                  <p className="tabular truncate text-[11px] text-mute">{delta != null ? signed(delta) : ' '}</p>
                </div>
              );
            })}
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-mute">History</p>
            <ul className="space-y-1.5">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl bg-elevated/50 py-1.5 pl-3 pr-1" data-testid="measurement-row">
                  <div className="min-w-0 flex-1">
                    <p className="tabular flex items-center gap-1.5 text-[13px] font-semibold text-white">
                      {formatDMY(m.date)}
                      {m.sample && <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">Sample</span>}
                    </p>
                    <p className="tabular truncate text-[12px] text-mute">
                      {[
                        m.weight != null && `${m.weight} kg`,
                        m.bodyFat != null && `${m.bodyFat}%`,
                        m.waist != null && `waist ${m.waist}`,
                        m.shoulders != null && `shoulders ${m.shoulders}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(m)}
                    aria-label={`Delete entry from ${formatDMY(m.date)}`}
                    className="ios-press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mute"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Remounting on open resets the form */}
      {sheetOpen && <MeasurementSheet open onClose={() => setSheetOpen(false)} today={today} />}

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete this entry?"
        message={toDelete ? `Measurements from ${formatDMY(toDelete.date)} will be removed.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          dispatch({ type: 'DELETE_MEASUREMENT', id: toDelete.id });
          setToDelete(null);
        }}
      />
    </Card>
  );
}

function RecentSessions() {
  const { state, dispatch } = useStore();
  const [toDelete, setToDelete] = useState(null);
  const recent = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);

  return (
    <Card className="space-y-3" data-testid="recent-sessions">
      <CardHeader icon={History} iconClass="text-mute" title="Recent Sessions" right={<span className="tabular shrink-0 text-[11px] text-mute">{state.sessions.length} total</span>} />
      {recent.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-mute">No sessions yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl bg-elevated/50 py-1.5 pl-3 pr-1" data-testid="session-row">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-white">
                  <span className="truncate">{s.dayName}</span>
                  {s.sample && <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">Sample</span>}
                </p>
                <p className="tabular truncate text-[12px] text-mute">
                  {formatDMY(s.date)} · {s.sets.length} sets · {Math.round(totalVolume(s.sets)).toLocaleString('en-MY')} kg ·{' '}
                  {formatDuration((s.endedAt - s.startedAt) / 1000)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToDelete(s)}
                aria-label={`Delete ${s.dayName} from ${formatDMY(s.date)}`}
                className="ios-press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mute"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete this session?"
        message={toDelete ? `${toDelete.dayName} on ${formatDMY(toDelete.date)} and its ${toDelete.sets.length} sets will be removed.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          dispatch({ type: 'DELETE_SESSION', id: toDelete.id });
          setToDelete(null);
        }}
      />
    </Card>
  );
}

export function ProgressTab({ today }) {
  const { state, dispatch } = useStore();
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <>
      {hasSampleData(state) && <SampleBanner onClear={() => setClearOpen(true)} />}
      <RecompRings />
      <OverloadCard today={today} />
      <BalanceCard today={today} />
      <MeasurementsCard today={today} />
      <RecentSessions />
      <ConfirmModal
        open={clearOpen}
        title="Clear sample data?"
        message="The sample sessions, measurements and protein entries will be removed. Anything you logged yourself stays."
        confirmLabel="Clear"
        destructive
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          dispatch({ type: 'CLEAR_SAMPLE' });
          setClearOpen(false);
        }}
      />
    </>
  );
}
