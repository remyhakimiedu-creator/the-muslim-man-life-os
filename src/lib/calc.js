import { addDays, daysBetween, formatDM, mondayOf } from './dates';

export const MUSCLE_GROUPS = ['Shoulders', 'Upper Chest', 'Back/Lats', 'Arms', 'Legs', 'Core'];

export const round1 = (n) => Math.round(n * 10) / 10;
export const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/** Epley estimate: 1RM = w × (1 + reps/30). A single rep is its own 1RM. */
export function epley1RM(kg, reps) {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

export const setVolume = (s) => (Number(s.kg) || 0) * (Number(s.reps) || 0);
export const totalVolume = (sets) => sets.reduce((acc, s) => acc + setVolume(s), 0);

/** Best previous numbers for one exercise across finished sessions. */
export function bestsFor(sessions, exId) {
  const best = { kg: 0, e1rm: 0, reps: 0, last: null };
  let lastAt = -Infinity;
  for (const session of sessions) {
    for (const s of session.sets) {
      if (s.exId !== exId) continue;
      if (s.kg > best.kg) best.kg = s.kg;
      const e = epley1RM(s.kg, s.reps);
      if (e > best.e1rm) best.e1rm = e;
      if (s.reps > best.reps) best.reps = s.reps;
      // "last" = heaviest set of the most recent session containing this lift
      if (session.startedAt > lastAt) {
        lastAt = session.startedAt;
        best.last = { kg: s.kg, reps: s.reps, date: session.date };
      } else if (session.startedAt === lastAt && best.last && s.kg > best.last.kg) {
        best.last = { kg: s.kg, reps: s.reps, date: session.date };
      }
    }
  }
  return best;
}

/**
 * A set is a personal record when its estimated 1RM beats every earlier set of
 * the same lift. Bodyweight work (0 kg) falls back to most reps.
 * `earlierSets` are the sets already logged in the current session.
 */
export function isPR(set, bests, earlierSets = []) {
  if (!(set.reps > 0)) return false;
  const sessionBest = earlierSets.reduce(
    (acc, s) => ({
      e1rm: Math.max(acc.e1rm, epley1RM(s.kg, s.reps)),
      reps: Math.max(acc.reps, s.reps),
    }),
    { e1rm: 0, reps: 0 },
  );
  if (set.kg > 0) {
    const prev = Math.max(bests.e1rm, sessionBest.e1rm);
    return prev > 0 && epley1RM(set.kg, set.reps) > prev + 1e-9;
  }
  const prevReps = Math.max(bests.reps, sessionBest.reps);
  return prevReps > 0 && set.reps > prevReps;
}

/** Sessions whose date falls in the last `days` days, today included. */
export function sessionsInLastDays(sessions, todayKey, days) {
  return sessions.filter((s) => {
    const d = daysBetween(s.date, todayKey);
    return d >= 0 && d < days;
  });
}

/** The routine day that follows the most recently finished session. */
export function nextDayIndex(routine, sessions) {
  if (!routine.length) return 0;
  let last = null;
  for (const s of sessions) if (!last || s.startedAt > last.startedAt) last = s;
  if (!last) return 0;
  const idx = routine.findIndex((d) => d.id === last.dayId);
  return idx === -1 ? 0 : (idx + 1) % routine.length;
}

export function lastSessionOfDay(sessions, dayId) {
  let last = null;
  for (const s of sessions) {
    if (s.dayId === dayId && (!last || s.startedAt > last.startedAt)) last = s;
  }
  return last;
}

/**
 * One point per week (Mon–Sun), oldest first: total volume across all lifts and
 * the best estimated 1RM for `exId` that week (null when the lift wasn't trained).
 */
export function weeklySeries(sessions, exId, todayKey, weeks = 6) {
  const thisMonday = mondayOf(todayKey);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    let volume = 0;
    let e1rm = 0;
    let count = 0;
    for (const s of sessions) {
      if (s.date < start || s.date > end) continue;
      count++;
      for (const set of s.sets) {
        volume += setVolume(set);
        if (set.exId === exId) e1rm = Math.max(e1rm, epley1RM(set.kg, set.reps));
      }
    }
    out.push({
      label: formatDM(start),
      start,
      sessions: count,
      volume: Math.round(volume),
      e1rm: e1rm > 0 ? round1(e1rm) : null,
    });
  }
  return out;
}

/** Average working sets per week for each muscle group over the last `weeks` weeks. */
export function muscleBalance(sessions, todayKey, weeks = 4) {
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0]));
  for (const s of sessionsInLastDays(sessions, todayKey, weeks * 7)) {
    for (const set of s.sets) {
      if (set.group in totals) totals[set.group] += 1;
    }
  }
  return MUSCLE_GROUPS.map((g) => ({ group: g, setsPerWeek: round1(totals[g] / weeks) }));
}

/**
 * How far a measurement has moved from where it started toward its goal, as a
 * percentage. Works in either direction (cutting weight or adding shoulders).
 */
export function progressToward(start, current, goal) {
  if (![start, current, goal].every(Number.isFinite)) return 0;
  if (start === goal) return current === goal ? 100 : 0;
  return clampPct(((current - start) / (goal - start)) * 100);
}

export const vTaperRatio = (shoulders, waist) =>
  shoulders > 0 && waist > 0 ? shoulders / waist : 0;

/** Latest and earliest entries that actually carry a value for `field`. */
export function fieldRange(measurements, field) {
  const withValue = measurements
    .filter((m) => Number.isFinite(m[field]) && m[field] > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!withValue.length) return { first: null, latest: null };
  return { first: withValue[0], latest: withValue[withValue.length - 1] };
}

export function average(nums) {
  const valid = nums.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}
