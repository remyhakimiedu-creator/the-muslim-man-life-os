import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE } from '../data/defaultRoutine';
import { MUSCLE_GROUPS, sessionsInLastDays } from '../lib/calc';
import { daysBetween, weekdayOf } from '../lib/dates';
import { remainingSeconds } from '../lib/timer';
import { reducer } from './reducer';
import { buildSampleHistory } from './seed';
import { createDefaultState, hasSampleData, normalizeState } from './state';
import { STORAGE_KEY, loadState, parseBackup, saveState, serializeBackup } from './storage';

const NOW = Date.UTC(2026, 10, 16, 6, 0); // Mon 16 Nov 2026, 14:00 in Johor
const TODAY = '2026-11-16';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

const set = (over = {}) => ({
  id: `set-${Math.random()}`,
  exId: 'ex1',
  name: 'Incline Dumbbell Press',
  group: 'Upper Chest',
  kg: 26,
  reps: 10,
  rpe: 8,
  at: NOW,
  ...over,
});

describe('default routine', () => {
  it('is a 4-day split with unique ids and valid muscle groups', () => {
    expect(DEFAULT_ROUTINE).toHaveLength(4);
    const ids = DEFAULT_ROUTINE.flatMap((d) => d.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const day of DEFAULT_ROUTINE) {
      for (const ex of day.exercises) expect(MUSCLE_GROUPS).toContain(ex.group);
    }
  });

  it('fits inside 90 minutes per session', () => {
    for (const day of DEFAULT_ROUTINE) {
      // 45 s under the bar per set plus the full rest after every set
      const seconds = day.exercises.reduce((acc, e) => acc + e.sets * (45 + e.restSec), 0);
      expect(seconds / 60).toBeLessThan(90);
    }
  });
});

describe('sample history', () => {
  const sample = buildSampleHistory(DEFAULT_ROUTINE, TODAY);

  it('covers four weeks, four sessions a week, ending before today', () => {
    expect(sample.sessions).toHaveLength(16);
    for (const s of sample.sessions) {
      expect(s.sample).toBe(true);
      expect(s.date < TODAY).toBe(true);
      expect(daysBetween(s.date, TODAY)).toBeLessThanOrEqual(28);
      expect([1, 2, 4, 5]).toContain(weekdayOf(s.date));
      expect(s.endedAt).toBeGreaterThan(s.startedAt);
      expect((s.endedAt - s.startedAt) / 60000).toBeLessThan(90);
    }
  });

  it('shows progressive overload, peaking in the final week', () => {
    const loads = sample.sessions
      .filter((s) => s.dayId === 'day1')
      .map((s) => s.sets.find((x) => x.exId === 'ex1').kg);
    expect(loads).toHaveLength(4);
    expect(loads[3]).toBe(26);
    for (let i = 1; i < loads.length; i++) expect(loads[i]).toBeGreaterThanOrEqual(loads[i - 1]);
    expect(loads[0]).toBeLessThan(loads[3]);
  });

  it('is deterministic', () => {
    expect(buildSampleHistory(DEFAULT_ROUTINE, TODAY)).toEqual(sample);
  });

  it('includes weekly measurements and past protein, but nothing for today', () => {
    expect(sample.measurements).toHaveLength(5);
    expect(sample.measurements.at(-1)).toMatchObject({ weight: 71.4, waist: 77, shoulders: 118 });
    expect(sample.protein[TODAY]).toBeUndefined();
    expect(Object.keys(sample.protein)).toHaveLength(28);
  });
});

describe('reducer', () => {
  const base = createDefaultState(NOW);

  it('starts with sample data and a believable rolling week', () => {
    expect(hasSampleData(base)).toBe(true);
    // Monday, before training: Tue, Thu and Fri count; last Monday has rolled off.
    expect(sessionsInLastDays(base.sessions, TODAY, 7)).toHaveLength(3);
    expect(sessionsInLastDays(base.sessions, '2026-11-15', 7)).toHaveLength(4);
    expect(base.routine[0].exercises[0].sampleKg).toBeUndefined();
  });

  it('runs a whole session: start, log, delete, finish', () => {
    let s = reducer(base, { type: 'START_SESSION', dayId: 'day1', id: 'live', now: NOW });
    expect(s.active).toMatchObject({ id: 'live', dayId: 'day1', date: TODAY, exIdx: 0, sets: [] });

    // a second start is ignored while one is running
    expect(reducer(s, { type: 'START_SESSION', dayId: 'day2', id: 'x', now: NOW })).toBe(s);

    s = reducer(s, { type: 'LOG_SET', set: set({ id: 'a' }) });
    s = reducer(s, { type: 'LOG_SET', set: set({ id: 'b', reps: 9 }) });
    s = reducer(s, { type: 'DELETE_SET', id: 'a' });
    expect(s.active.sets.map((x) => x.id)).toEqual(['b']);

    s = reducer(s, { type: 'START_TIMER', seconds: 120, now: NOW });
    s = reducer(s, { type: 'FINISH_SESSION', now: NOW + 3_600_000 });
    expect(s.active).toBeNull();
    expect(s.timer).toBeNull();
    const saved = s.sessions.at(-1);
    expect(saved).toMatchObject({ id: 'live', date: TODAY, endedAt: NOW + 3_600_000 });
    expect(saved.exIdx).toBeUndefined();
    expect(saved.sample).toBeUndefined();
  });

  it('does not save an empty session', () => {
    let s = reducer(base, { type: 'START_SESSION', dayId: 'day1', id: 'live', now: NOW });
    s = reducer(s, { type: 'FINISH_SESSION', now: NOW });
    expect(s.sessions).toHaveLength(base.sessions.length);
  });

  it('starts, adjusts and clears the rest timer', () => {
    let s = reducer(base, { type: 'START_TIMER', seconds: 90, now: NOW });
    expect(remainingSeconds(s.timer.endsAt, NOW)).toBe(90);
    s = reducer(s, { type: 'ADJUST_TIMER', delta: 15, now: NOW });
    expect(remainingSeconds(s.timer.endsAt, NOW)).toBe(105);
    s = reducer(s, { type: 'ADJUST_TIMER', delta: -15, now: NOW });
    s = reducer(s, { type: 'ADJUST_TIMER', delta: -15, now: NOW });
    expect(remainingSeconds(s.timer.endsAt, NOW)).toBe(75);
    s = reducer(s, { type: 'CLEAR_TIMER' });
    expect(s.timer).toBeNull();
    expect(reducer(s, { type: 'ADJUST_TIMER', delta: 15, now: NOW })).toBe(s);
  });

  it('keeps daily logs separate per day', () => {
    let s = reducer(base, { type: 'TOGGLE_PRAYER', date: TODAY, name: 'Subuh' });
    s = reducer(s, { type: 'TOGGLE_PRAYER', date: TODAY, name: 'Zohor' });
    s = reducer(s, { type: 'TOGGLE_PRAYER', date: TODAY, name: 'Zohor' });
    expect(s.prayers[TODAY]).toEqual({ Subuh: true });
    expect(s.prayers['2026-11-17']).toBeUndefined(); // tomorrow starts clean

    s = reducer(s, { type: 'TOGGLE_MURUAH', date: TODAY, pillar: 'Hilm' });
    expect(s.muruah[TODAY]).toEqual({ Hilm: true });

    s = reducer(s, { type: 'ADD_PROTEIN', date: TODAY, grams: 40 });
    s = reducer(s, { type: 'ADD_PROTEIN', date: TODAY, grams: 25 });
    expect(s.protein[TODAY]).toBe(65);
    s = reducer(s, { type: 'ADD_PROTEIN', date: TODAY, grams: -500 });
    expect(s.protein[TODAY]).toBe(0);
  });

  it('keeps one measurement per day, sorted by date', () => {
    let s = reducer(base, { type: 'LOG_MEASUREMENT', entry: { id: 'm1', date: TODAY, weight: 71.1 } });
    s = reducer(s, { type: 'LOG_MEASUREMENT', entry: { id: 'm2', date: TODAY, weight: 71.0 } });
    expect(s.measurements.filter((m) => m.date === TODAY)).toHaveLength(1);
    expect(s.measurements.at(-1)).toMatchObject({ id: 'm2', weight: 71.0 });
    s = reducer(s, { type: 'DELETE_MEASUREMENT', id: 'm2' });
    expect(s.measurements.some((m) => m.id === 'm2')).toBe(false);
  });

  it('edits the routine', () => {
    const ex = { id: 'new1', name: 'Face Pull', muscle: 'Rear Delts', group: 'Shoulders', sets: 3, targetReps: '15-20', restSec: 60 };
    let s = reducer(base, { type: 'UPSERT_EXERCISE', dayId: 'day1', exercise: ex });
    expect(s.routine[0].exercises.at(-1)).toEqual(ex);

    s = reducer(s, { type: 'UPSERT_EXERCISE', dayId: 'day1', exercise: { ...ex, sets: 4 } });
    expect(s.routine[0].exercises.filter((e) => e.id === 'new1')).toHaveLength(1);
    expect(s.routine[0].exercises.at(-1).sets).toBe(4);

    const before = s.routine[0].exercises.map((e) => e.id);
    s = reducer(s, { type: 'MOVE_EXERCISE', dayId: 'day1', exId: 'new1', dir: -1 });
    const after = s.routine[0].exercises.map((e) => e.id);
    expect(after.at(-2)).toBe('new1');
    expect(after.at(-1)).toBe(before.at(-2));
    // moving past the end is a no-op
    const top = s.routine[0].exercises[0].id;
    expect(reducer(s, { type: 'MOVE_EXERCISE', dayId: 'day1', exId: top, dir: -1 }).routine[0]).toBe(s.routine[0]);

    s = reducer(s, { type: 'DELETE_EXERCISE', dayId: 'day1', exId: 'new1' });
    expect(s.routine[0].exercises.some((e) => e.id === 'new1')).toBe(false);
    expect(s.routine[1]).toBe(base.routine[1]); // other days untouched
  });

  it('clears sample data but keeps real data', () => {
    let s = reducer(base, { type: 'START_SESSION', dayId: 'day1', id: 'real', now: NOW });
    s = reducer(s, { type: 'LOG_SET', set: set() });
    s = reducer(s, { type: 'FINISH_SESSION', now: NOW + 1000 });
    s = reducer(s, { type: 'ADD_PROTEIN', date: TODAY, grams: 30 });
    s = reducer(s, { type: 'LOG_MEASUREMENT', entry: { id: 'mine', date: TODAY, weight: 71 } });
    s = reducer(s, { type: 'CLEAR_SAMPLE' });

    expect(hasSampleData(s)).toBe(false);
    expect(s.sessions.map((x) => x.id)).toEqual(['real']);
    expect(s.measurements.map((m) => m.id)).toEqual(['mine']);
    expect(s.protein).toEqual({ [TODAY]: 30 });
  });

  it('resets to defaults', () => {
    let s = reducer(base, { type: 'SET_SETTING', key: 'proteinTarget', value: 180 });
    s = reducer(s, { type: 'CLEAR_SAMPLE' });
    s = reducer(s, { type: 'RESET', now: NOW });
    expect(s).toEqual(createDefaultState(NOW));
  });
});

describe('localStorage', () => {
  it('writes and reads back the same state', () => {
    const storage = fakeStorage();
    let s = createDefaultState(NOW);
    s = reducer(s, { type: 'TOGGLE_PRAYER', date: TODAY, name: 'Asar' });
    s = reducer(s, { type: 'START_SESSION', dayId: 'day2', id: 'live', now: NOW });
    s = reducer(s, { type: 'LOG_SET', set: set({ id: 'a', exId: 'ex5', group: 'Legs', kg: 92.5, reps: 8 }) });
    s = reducer(s, { type: 'START_TIMER', seconds: 150, now: NOW });

    expect(saveState(s, storage)).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(loadState(NOW, storage)).toEqual(s);
  });

  it('falls back to defaults on first run', () => {
    expect(loadState(NOW, fakeStorage())).toEqual(createDefaultState(NOW));
  });

  it('survives corrupt data and keeps a copy of it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{not json' });
    expect(loadState(NOW, storage)).toEqual(createDefaultState(NOW));
    expect(storage.data.get('mlos_state_corrupt')).toBe('{not json');
  });

  it('keeps working when storage throws (private mode, quota)', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    };
    expect(loadState(NOW, broken)).toEqual(createDefaultState(NOW));
    expect(saveState(createDefaultState(NOW), broken)).toBe(false);
  });
});

describe('backup', () => {
  const state = reducer(createDefaultState(NOW), { type: 'START_TIMER', seconds: 60, now: NOW });

  it('round-trips through export and import', () => {
    const restored = parseBackup(serializeBackup(state, NOW));
    expect(restored).toEqual({ ...state, timer: null });
  });

  it('rejects files that are not Life OS backups', () => {
    expect(() => parseBackup('hello')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"other","state":{}}')).toThrow(/not a Life OS backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'the-muslim-man-life-os', schema: 1, state: {} }))).toThrow(/no routine/);
    expect(() => parseBackup(JSON.stringify({ app: 'the-muslim-man-life-os', schema: 99, state: state }))).toThrow(/newer version/);
  });

  it('repairs damaged entries instead of crashing', () => {
    const messy = {
      routine: [
        { id: 'd', name: 'Push', exercises: [{ name: 'Bench', sets: 'lots', restSec: 99999, group: 'Chest' }, null, { id: 'no-name' }] },
        'junk',
      ],
      sessions: [
        { id: 's', date: '2026-11-10', dayId: 'd', startedAt: 5, sets: [{ exId: 'e', kg: '40', reps: '8' }, { kg: 10 }] },
        { id: 'bad-date', date: '10/11/2026', sets: [] },
        { id: 'empty', date: '2026-11-11', sets: [] },
      ],
      measurements: [{ date: '2026-11-10', weight: '71.2', waist: -4 }, { weight: 70 }],
      protein: { '2026-11-10': '140', nonsense: 5, '2026-11-11': -3 },
      prayers: { '2026-11-10': { Subuh: true, Zohor: 'yes' } },
      settings: { proteinTarget: '200', weeklyTarget: 5, muted: true, hacked: 1 },
      timer: { endsAt: 'soon' },
    };
    const s = normalizeState(messy);
    expect(s.routine).toHaveLength(1);
    expect(s.routine[0].exercises).toHaveLength(1);
    expect(s.routine[0].exercises[0]).toMatchObject({ name: 'Bench', sets: 3, restSec: 600, group: 'Arms' });
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].sets).toEqual([expect.objectContaining({ exId: 'e', kg: 40, reps: 8 })]);
    expect(s.measurements).toEqual([expect.objectContaining({ date: '2026-11-10', weight: 71.2, waist: null })]);
    expect(s.protein).toEqual({ '2026-11-10': 140 });
    expect(s.prayers).toEqual({ '2026-11-10': { Subuh: true } });
    expect(s.settings).toMatchObject({ proteinTarget: 150, weeklyTarget: 5, muted: true });
    expect(s.settings.hacked).toBeUndefined();
    expect(s.timer).toBeNull();
    expect(s.active).toBeNull();
  });
});
