import { DEFAULT_ROUTINE, DEFAULT_SETTINGS } from '../data/defaultRoutine';
import { MUSCLE_GROUPS } from '../lib/calc';
import { dayKey } from '../lib/dates';
import { buildSampleHistory } from './seed';

export const SCHEMA = 1;
export const APP_ID = 'the-muslim-man-life-os';

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const cleanRoutine = (routine) =>
  routine.map((day) => ({
    ...day,
    // sampleKg only exists to seed the demo history
    exercises: day.exercises.map(({ sampleKg: _sampleKg, ...ex }) => ex),
  }));

/** First-run state: default routine plus four weeks of flagged sample history. */
export function createDefaultState(now = Date.now()) {
  const sample = buildSampleHistory(DEFAULT_ROUTINE, dayKey(new Date(now)));
  return {
    schema: SCHEMA,
    settings: { ...DEFAULT_SETTINGS },
    routine: cleanRoutine(DEFAULT_ROUTINE),
    sessions: sample.sessions,
    active: null,
    timer: null,
    measurements: sample.measurements,
    protein: sample.protein,
    sampleProteinKeys: sample.sampleProteinKeys,
    prayers: {},
    muruah: {},
  };
}

export const hasSampleData = (state) =>
  state.sessions.some((s) => s.sample) ||
  state.measurements.some((m) => m.sample) ||
  state.sampleProteinKeys.length > 0;

// ---------------------------------------------------------------------------
// Normalising: everything read from disk or from an imported file goes through
// here, so a hand-edited or older backup can't crash the app.
// ---------------------------------------------------------------------------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v, fallback = '') => (typeof v === 'string' && v.trim() ? v : fallback);
const isKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function normExercise(ex) {
  if (!isObj(ex) || !str(ex.name)) return null;
  return {
    id: str(ex.id, uid()),
    name: ex.name.trim().slice(0, 60),
    muscle: str(ex.muscle, str(ex.group, 'General')).slice(0, 40),
    group: MUSCLE_GROUPS.includes(ex.group) ? ex.group : 'Arms',
    sets: Math.max(1, Math.min(10, Math.round(num(ex.sets, 3)))),
    targetReps: str(ex.targetReps, '8-12').slice(0, 12),
    restSec: Math.max(10, Math.min(600, Math.round(num(ex.restSec, 90)))),
  };
}

function normDay(day) {
  if (!isObj(day) || !Array.isArray(day.exercises)) return null;
  return {
    id: str(day.id, uid()),
    name: str(day.name, 'Session').slice(0, 30),
    focus: str(day.focus, '').slice(0, 60),
    exercises: day.exercises.map(normExercise).filter(Boolean),
  };
}

function normSet(s) {
  if (!isObj(s) || !str(s.exId)) return null;
  const set = {
    id: str(s.id, uid()),
    exId: s.exId,
    name: str(s.name, 'Exercise'),
    group: MUSCLE_GROUPS.includes(s.group) ? s.group : 'Arms',
    kg: Math.max(0, num(s.kg)),
    reps: Math.max(0, Math.round(num(s.reps))),
    rpe: s.rpe == null ? null : Math.max(1, Math.min(10, num(s.rpe, 8))),
    at: num(s.at, Date.now()),
  };
  if (s.pr) set.pr = true;
  return set;
}

function normSession(s) {
  if (!isObj(s) || !isKey(s.date) || !Array.isArray(s.sets)) return null;
  const startedAt = num(s.startedAt, Date.now());
  const out = {
    id: str(s.id, uid()),
    dayId: str(s.dayId, 'custom'),
    dayName: str(s.dayName, 'Session'),
    date: s.date,
    startedAt,
    endedAt: num(s.endedAt, startedAt),
    sets: s.sets.map(normSet).filter(Boolean),
  };
  if (s.sample) out.sample = true;
  return out;
}

function normMeasurement(m) {
  if (!isObj(m) || !isKey(m.date)) return null;
  const out = { id: str(m.id, uid()), date: m.date };
  for (const f of ['weight', 'bodyFat', 'chest', 'shoulders', 'waist', 'biceps']) {
    const v = Number(m[f]);
    out[f] = Number.isFinite(v) && v > 0 ? v : null;
  }
  if (m.sample) out.sample = true;
  return out;
}

function normDayMap(map, mapValue) {
  const out = {};
  if (!isObj(map)) return out;
  for (const [k, v] of Object.entries(map)) {
    if (!isKey(k)) continue;
    const value = mapValue(v);
    if (value !== undefined) out[k] = value;
  }
  return out;
}

const boolMap = (v) =>
  isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, on]) => on === true)) : undefined;

/** Returns a safe state, or throws with a message a person can act on. */
export function normalizeState(raw) {
  if (!isObj(raw)) throw new Error('That file is not a Life OS backup.');
  if (!Array.isArray(raw.routine)) throw new Error('The backup has no routine in it.');

  const routine = raw.routine.map(normDay).filter(Boolean);
  if (!routine.length) throw new Error('The backup has no routine in it.');

  const settings = { ...DEFAULT_SETTINGS };
  if (isObj(raw.settings)) {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const incoming = raw.settings[key];
      const expected = typeof DEFAULT_SETTINGS[key];
      if (DEFAULT_SETTINGS[key] === null) {
        if (incoming === null || typeof incoming === 'number') settings[key] = incoming;
      } else if (typeof incoming === expected && (expected !== 'number' || Number.isFinite(incoming))) {
        settings[key] = incoming;
      }
    }
  }

  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .map(normSession)
    .filter((s) => s && s.sets.length)
    .sort((a, b) => a.startedAt - b.startedAt);

  const measurements = (Array.isArray(raw.measurements) ? raw.measurements : [])
    .map(normMeasurement)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let active = null;
  if (isObj(raw.active) && isKey(raw.active.date) && Array.isArray(raw.active.sets)) {
    const day = routine.find((d) => d.id === raw.active.dayId);
    if (day) {
      active = {
        id: str(raw.active.id, uid()),
        dayId: day.id,
        dayName: str(raw.active.dayName, day.name),
        date: raw.active.date,
        startedAt: num(raw.active.startedAt, Date.now()),
        exIdx: Math.max(0, Math.round(num(raw.active.exIdx))),
        sets: raw.active.sets.map(normSet).filter(Boolean),
      };
    }
  }

  let timer = null;
  if (isObj(raw.timer) && num(raw.timer.endsAt) > 0 && num(raw.timer.durationMs) > 0) {
    timer = { endsAt: num(raw.timer.endsAt), durationMs: num(raw.timer.durationMs) };
  }

  const protein = normDayMap(raw.protein, (v) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : undefined,
  );

  return {
    schema: SCHEMA,
    settings,
    routine,
    sessions,
    active,
    timer,
    measurements,
    protein,
    sampleProteinKeys: (Array.isArray(raw.sampleProteinKeys) ? raw.sampleProteinKeys : []).filter(
      (k) => isKey(k) && k in protein,
    ),
    prayers: normDayMap(raw.prayers, boolMap),
    muruah: normDayMap(raw.muruah, boolMap),
  };
}
