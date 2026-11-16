import { dayKey } from '../lib/dates';
import { adjustTimer, startTimer } from '../lib/timer';
import { createDefaultState } from './state';

const mapDay = (state, dayId, fn) => ({
  ...state,
  routine: state.routine.map((d) => (d.id === dayId ? fn(d) : d)),
});

/**
 * Pure reducer. Anything non-deterministic (ids, the current time) arrives on
 * the action, so the same action always produces the same state.
 */
export function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    // ---- workout session -------------------------------------------------
    case 'START_SESSION': {
      if (state.active) return state;
      const day = state.routine.find((d) => d.id === action.dayId);
      if (!day || !day.exercises.length) return state;
      return {
        ...state,
        active: {
          id: action.id,
          dayId: day.id,
          dayName: day.name,
          date: dayKey(new Date(action.now)),
          startedAt: action.now,
          exIdx: 0,
          sets: [],
        },
      };
    }
    case 'SET_EX_IDX':
      if (!state.active) return state;
      return { ...state, active: { ...state.active, exIdx: Math.max(0, action.idx) } };
    case 'LOG_SET':
      if (!state.active) return state;
      return { ...state, active: { ...state.active, sets: [...state.active.sets, action.set] } };
    case 'DELETE_SET':
      if (!state.active) return state;
      return {
        ...state,
        active: { ...state.active, sets: state.active.sets.filter((s) => s.id !== action.id) },
      };
    case 'FINISH_SESSION': {
      if (!state.active) return state;
      const { exIdx: _exIdx, ...session } = state.active;
      const sessions = session.sets.length
        ? [...state.sessions, { ...session, endedAt: action.now }]
        : state.sessions;
      return { ...state, sessions, active: null, timer: null };
    }
    case 'DISCARD_SESSION':
      return { ...state, active: null, timer: null };
    case 'DELETE_SESSION':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.id) };

    // ---- rest timer ------------------------------------------------------
    case 'START_TIMER':
      return { ...state, timer: startTimer(action.seconds, action.now) };
    case 'ADJUST_TIMER':
      if (!state.timer) return state;
      return { ...state, timer: adjustTimer(state.timer, action.delta, action.now) };
    case 'CLEAR_TIMER':
      return state.timer ? { ...state, timer: null } : state;

    // ---- daily logs ------------------------------------------------------
    case 'ADD_PROTEIN': {
      const next = Math.max(0, Math.round((state.protein[action.date] || 0) + action.grams));
      return {
        ...state,
        protein: { ...state.protein, [action.date]: next },
        sampleProteinKeys: state.sampleProteinKeys.filter((k) => k !== action.date),
      };
    }
    case 'TOGGLE_PRAYER': {
      const day = state.prayers[action.date] || {};
      const next = { ...day };
      if (next[action.name]) delete next[action.name];
      else next[action.name] = true;
      return { ...state, prayers: { ...state.prayers, [action.date]: next } };
    }
    case 'TOGGLE_MURUAH': {
      const day = state.muruah[action.date] || {};
      const next = { ...day };
      if (next[action.pillar]) delete next[action.pillar];
      else next[action.pillar] = true;
      return { ...state, muruah: { ...state.muruah, [action.date]: next } };
    }

    // ---- body measurements ----------------------------------------------
    case 'LOG_MEASUREMENT': {
      // One entry per day: logging again on the same date replaces it.
      const others = state.measurements.filter((m) => m.date !== action.entry.date);
      const measurements = [...others, action.entry].sort((a, b) => (a.date < b.date ? -1 : 1));
      return { ...state, measurements };
    }
    case 'DELETE_MEASUREMENT':
      return { ...state, measurements: state.measurements.filter((m) => m.id !== action.id) };

    // ---- routine editor --------------------------------------------------
    case 'UPSERT_EXERCISE':
      return mapDay(state, action.dayId, (d) => {
        const exists = d.exercises.some((e) => e.id === action.exercise.id);
        return {
          ...d,
          exercises: exists
            ? d.exercises.map((e) => (e.id === action.exercise.id ? action.exercise : e))
            : [...d.exercises, action.exercise],
        };
      });
    case 'DELETE_EXERCISE':
      return mapDay(state, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.filter((e) => e.id !== action.exId),
      }));
    case 'MOVE_EXERCISE':
      return mapDay(state, action.dayId, (d) => {
        const from = d.exercises.findIndex((e) => e.id === action.exId);
        const to = from + action.dir;
        if (from === -1 || to < 0 || to >= d.exercises.length) return d;
        const exercises = [...d.exercises];
        [exercises[from], exercises[to]] = [exercises[to], exercises[from]];
        return { ...d, exercises };
      });
    case 'RENAME_DAY':
      return mapDay(state, action.dayId, (d) => ({
        ...d,
        name: action.name ?? d.name,
        focus: action.focus ?? d.focus,
      }));

    // ---- data management -------------------------------------------------
    case 'CLEAR_SAMPLE': {
      const protein = { ...state.protein };
      for (const k of state.sampleProteinKeys) delete protein[k];
      return {
        ...state,
        sessions: state.sessions.filter((s) => !s.sample),
        measurements: state.measurements.filter((m) => !m.sample),
        protein,
        sampleProteinKeys: [],
      };
    }
    case 'IMPORT':
      return action.state;
    case 'RESET':
      return createDefaultState(action.now);

    default:
      return state;
  }
}
