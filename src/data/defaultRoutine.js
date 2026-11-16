// 4-day Upper/Lower split biased toward a V-taper: side delts, upper chest, lats.
// Each session is 4–5 lifts and fits comfortably inside 60–75 minutes.
// `group` feeds the muscle-balance radar; `sampleKg` only seeds the demo history.
export const DEFAULT_ROUTINE = [
  {
    id: 'day1',
    name: 'Upper A',
    focus: 'V-Taper Width & Incline',
    exercises: [
      { id: 'ex1', name: 'Incline Dumbbell Press', muscle: 'Upper Chest', group: 'Upper Chest', sets: 3, targetReps: '8-10', restSec: 120, sampleKg: 26 },
      { id: 'ex2', name: 'Weighted Pull-Ups / Lat Pulldown', muscle: 'Lats (Width)', group: 'Back/Lats', sets: 3, targetReps: '8-12', restSec: 120, sampleKg: 65 },
      { id: 'ex3', name: 'Cable Lateral Raises', muscle: 'Lateral Delts', group: 'Shoulders', sets: 4, targetReps: '12-15', restSec: 60, sampleKg: 10 },
      { id: 'ex14', name: 'Seated Cable Row', muscle: 'Mid Back', group: 'Back/Lats', sets: 3, targetReps: '10-12', restSec: 90, sampleKg: 55 },
      { id: 'ex4', name: 'Incline DB Curl + Tricep Pushdown', muscle: 'Arms', group: 'Arms', sets: 3, targetReps: '10-12', restSec: 90, sampleKg: 14 },
    ],
  },
  {
    id: 'day2',
    name: 'Lower A',
    focus: 'Quad & Core Foundation',
    exercises: [
      { id: 'ex5', name: 'Hack Squat / Barbell Squat', muscle: 'Quads', group: 'Legs', sets: 3, targetReps: '6-10', restSec: 150, sampleKg: 90 },
      { id: 'ex6', name: 'Romanian Deadlift (RDL)', muscle: 'Hamstrings', group: 'Legs', sets: 3, targetReps: '8-10', restSec: 120, sampleKg: 80 },
      { id: 'ex15', name: 'Leg Extension', muscle: 'Quads', group: 'Legs', sets: 3, targetReps: '12-15', restSec: 60, sampleKg: 50 },
      { id: 'ex7', name: 'Hanging Leg Raises', muscle: 'Core', group: 'Core', sets: 3, targetReps: '12-15', restSec: 60, sampleKg: 0 },
    ],
  },
  {
    id: 'day3',
    name: 'Upper B',
    focus: 'Shoulders, Back Thickness & Arms',
    exercises: [
      { id: 'ex8', name: 'Seated DB Overhead Press', muscle: 'Front/Side Delts', group: 'Shoulders', sets: 3, targetReps: '8-10', restSec: 120, sampleKg: 22 },
      { id: 'ex9', name: 'Chest-Supported T-Bar Row', muscle: 'Upper Back', group: 'Back/Lats', sets: 3, targetReps: '8-12', restSec: 90, sampleKg: 50 },
      { id: 'ex16', name: 'Low-Incline Machine Press', muscle: 'Upper Chest', group: 'Upper Chest', sets: 3, targetReps: '10-12', restSec: 90, sampleKg: 45 },
      { id: 'ex10', name: 'Dumbbell Lateral Raises', muscle: 'Lateral Delts', group: 'Shoulders', sets: 4, targetReps: '15-20', restSec: 60, sampleKg: 12 },
      { id: 'ex17', name: 'EZ-Bar Curl + Overhead Triceps Extension', muscle: 'Arms', group: 'Arms', sets: 3, targetReps: '10-12', restSec: 90, sampleKg: 25 },
    ],
  },
  {
    id: 'day4',
    name: 'Lower B',
    focus: 'Posterior Chain, Calves & Core',
    exercises: [
      { id: 'ex11', name: 'Bulgarian Split Squats', muscle: 'Quads/Glutes', group: 'Legs', sets: 3, targetReps: '8-10', restSec: 90, sampleKg: 20 },
      { id: 'ex12', name: 'Seated Leg Curl', muscle: 'Hamstrings', group: 'Legs', sets: 3, targetReps: '10-15', restSec: 60, sampleKg: 45 },
      { id: 'ex13', name: 'Standing Calf Raises', muscle: 'Calves', group: 'Legs', sets: 4, targetReps: '12-15', restSec: 60, sampleKg: 60 },
      { id: 'ex18', name: 'Cable Crunch', muscle: 'Core', group: 'Core', sets: 3, targetReps: '12-15', restSec: 60, sampleKg: 40 },
    ],
  },
];

export const DEFAULT_SETTINGS = {
  muted: false,
  district: 'Ulu Tiram',
  proteinTarget: 150, // g per day
  weightGoal: 70, // kg
  bodyFatGoal: 12, // %
  vTaperGoal: 1.6, // shoulders ÷ waist
  weeklyTarget: 4, // sessions per 7 days
  tourDone: false,
  lastBackupAt: null,
};

/** "8-12" -> [8, 12]; "10" -> [10, 10] */
export function parseRepRange(text) {
  const nums = String(text).match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return [8, 12];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return [lo, hi];
}
