import { parseRepRange } from '../data/defaultRoutine';
import { addDays, weekdayOf } from '../lib/dates';

// Deterministic pseudo-random numbers so the demo history is identical every time.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mon, Tue, Thu, Fri -> routine day 1..4
const SCHEDULE = { 1: 0, 2: 1, 4: 2, 5: 3 };
const WEEK_FACTOR = [0.9, 0.935, 0.97, 1];

const roundLoad = (kg) => (kg < 20 ? Math.round(kg) : Math.round(kg / 2.5) * 2.5);

/** 17:15 Malaysia time on a given day key, as epoch ms. */
function sessionStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 9, 15);
}

/**
 * Four weeks of believable training, measurements and protein intake ending
 * yesterday, so the charts have something to show on first open. Every record
 * is flagged `sample: true` and can be wiped in one tap from Settings.
 */
export function buildSampleHistory(routine, todayKey) {
  const sessions = [];
  const protein = {};

  for (let back = 28; back >= 1; back--) {
    const date = addDays(todayKey, -back);
    const rand = mulberry32(hash(date));
    protein[date] = 118 + Math.round(rand() * 40);

    const day = routine[SCHEDULE[weekdayOf(date)]];
    if (!day) continue;

    const week = Math.min(3, Math.floor((28 - back) / 7));
    const startedAt = sessionStart(date);
    let clock = startedAt + 5 * 60000;
    const sets = [];

    for (const ex of day.exercises) {
      const [lo, hi] = parseRepRange(ex.targetReps);
      const top = ex.sampleKg ?? 20;
      const kg = week === 3 ? top : roundLoad(top * WEEK_FACTOR[week]);
      for (let i = 0; i < ex.sets; i++) {
        const fatigue = i + (rand() < 0.35 ? 1 : 0);
        const reps = Math.max(lo - 1, hi - fatigue - (3 - week > 1 ? 1 : 0));
        sets.push({
          id: `s-${date}-${ex.id}-${i}`,
          exId: ex.id,
          name: ex.name,
          group: ex.group,
          kg,
          reps,
          rpe: Math.min(9.5, 7.5 + i * 0.5),
          at: clock,
        });
        clock += (ex.restSec + 45) * 1000;
      }
    }

    sessions.push({
      id: `sample-${date}`,
      dayId: day.id,
      dayName: day.name,
      date,
      startedAt,
      endedAt: clock + 60000,
      sets,
      sample: true,
    });
  }

  const trend = [
    { weight: 73.2, bodyFat: 15.0, chest: 98.0, shoulders: 116.5, waist: 79.0, biceps: 36.0 },
    { weight: 72.8, bodyFat: 14.6, chest: 98.3, shoulders: 117.0, waist: 78.5, biceps: 36.2 },
    { weight: 72.3, bodyFat: 14.1, chest: 98.6, shoulders: 117.3, waist: 78.0, biceps: 36.4 },
    { weight: 71.9, bodyFat: 13.7, chest: 98.8, shoulders: 117.7, waist: 77.5, biceps: 36.6 },
    { weight: 71.4, bodyFat: 13.2, chest: 99.0, shoulders: 118.0, waist: 77.0, biceps: 36.8 },
  ];
  const measurements = trend.map((row, i) => {
    const date = addDays(todayKey, -29 + i * 7);
    return { id: `sample-m-${date}`, date, ...row, sample: true };
  });

  return { sessions, measurements, protein, sampleProteinKeys: Object.keys(protein) };
}
