import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateQibla, compassPoint, findDistrict, JOHOR_DISTRICTS } from '../data/lifeOsData';
import {
  bestsFor,
  epley1RM,
  isPR,
  muscleBalance,
  nextDayIndex,
  progressToward,
  sessionsInLastDays,
  totalVolume,
  vTaperRatio,
  weeklySeries,
} from './calc';
import {
  addDays,
  dayKey,
  daysBetween,
  formatClock,
  formatCountdown,
  formatDMY,
  formatDuration,
  mondayOf,
  weekdayOf,
} from './dates';
import {
  currentPrayer,
  describeWeather,
  formatHijri,
  isPlausible,
  nextPrayer,
  parseMonth,
  parseWeather,
  PRAYER_ORDER,
} from './prayer';
import { adjustTimer, fractionLeft, remainingSeconds, startTimer } from './timer';

// 16 Nov 2026 is a Monday.
const klTime = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 8, min);

describe('dates (Asia/Kuala_Lumpur)', () => {
  it('uses the Malaysian calendar day, not UTC', () => {
    // 23:30 UTC on the 15th is already 07:30 on the 16th in Johor
    expect(dayKey(new Date(Date.UTC(2026, 10, 15, 23, 30)))).toBe('2026-11-16');
    expect(dayKey(new Date(Date.UTC(2026, 10, 15, 15, 59)))).toBe('2026-11-15');
  });

  it('formats DD/MM/YYYY and a 24-hour clock', () => {
    expect(formatDMY('2026-11-06')).toBe('06/11/2026');
    expect(formatClock(klTime(2026, 11, 16, 5, 47))).toBe('05:47');
    expect(formatClock(klTime(2026, 11, 16, 0, 5))).toBe('00:05');
  });

  it('does day arithmetic across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-01', '2026-11-16')).toBe(15);
  });

  it('knows weekdays and week starts', () => {
    expect(weekdayOf('2026-11-16')).toBe(1);
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Sunday belongs to the week before
    expect(mondayOf('2026-11-18')).toBe('2026-11-16');
  });

  it('formats durations and countdowns', () => {
    expect(formatDuration(95)).toBe('1:35');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatCountdown(125 * 60000)).toBe('2h 05m');
    expect(formatCountdown(14 * 60000)).toBe('14m');
  });
});

describe('lifting maths', () => {
  it('estimates 1RM with the Epley formula', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley1RM(26, 10)).toBeCloseTo(34.67, 2);
    expect(epley1RM(80, 1)).toBe(80);
    expect(epley1RM(0, 12)).toBe(0);
    expect(epley1RM(50, 0)).toBe(0);
  });

  it('totals volume as kg × reps across sets', () => {
    expect(totalVolume([{ kg: 26, reps: 10 }, { kg: 26, reps: 9 }, { kg: 24, reps: 8 }])).toBe(686);
    expect(totalVolume([])).toBe(0);
  });

  const history = [
    {
      id: 'a', dayId: 'day1', date: '2026-11-09', startedAt: 1,
      sets: [
        { exId: 'ex1', group: 'Upper Chest', kg: 24, reps: 10 },
        { exId: 'ex7', group: 'Core', kg: 0, reps: 12 },
      ],
    },
    {
      id: 'b', dayId: 'day2', date: '2026-11-13', startedAt: 2,
      sets: [
        { exId: 'ex1', group: 'Upper Chest', kg: 26, reps: 8 },
        { exId: 'ex1', group: 'Upper Chest', kg: 22, reps: 12 },
      ],
    },
  ];

  it('finds previous bests and the latest top set', () => {
    const b = bestsFor(history, 'ex1');
    expect(b.kg).toBe(26);
    expect(b.e1rm).toBeCloseTo(26 * (1 + 8 / 30), 5);
    expect(b.last).toEqual({ kg: 26, reps: 8, date: '2026-11-13' });
    expect(bestsFor(history, 'nope')).toEqual({ kg: 0, e1rm: 0, reps: 0, last: null });
  });

  it('flags a PR only when estimated 1RM is beaten', () => {
    const b = bestsFor(history, 'ex1');
    expect(isPR({ kg: 26, reps: 8 }, b)).toBe(false); // equal is not a PR
    expect(isPR({ kg: 26, reps: 9 }, b)).toBe(true); // rep PR at the same load
    expect(isPR({ kg: 28, reps: 6 }, b)).toBe(true);
    expect(isPR({ kg: 20, reps: 10 }, b)).toBe(false);
  });

  it('does not fire twice in one session for the same number', () => {
    const b = bestsFor(history, 'ex1');
    const earlier = [{ kg: 26, reps: 9 }];
    expect(isPR({ kg: 26, reps: 9 }, b, earlier)).toBe(false);
    expect(isPR({ kg: 26, reps: 10 }, b, earlier)).toBe(true);
  });

  it('never calls the very first set of a new lift a PR', () => {
    expect(isPR({ kg: 40, reps: 10 }, bestsFor(history, 'brand-new'))).toBe(false);
  });

  it('uses reps for bodyweight work', () => {
    const b = bestsFor(history, 'ex7');
    expect(isPR({ kg: 0, reps: 12 }, b)).toBe(false);
    expect(isPR({ kg: 0, reps: 13 }, b)).toBe(true);
  });

  it('picks the next routine day after the most recent session', () => {
    const routine = [{ id: 'day1' }, { id: 'day2' }, { id: 'day3' }, { id: 'day4' }];
    expect(nextDayIndex(routine, history)).toBe(2);
    expect(nextDayIndex(routine, [])).toBe(0);
    expect(nextDayIndex(routine, [{ dayId: 'day4', startedAt: 9 }])).toBe(0);
    expect(nextDayIndex(routine, [{ dayId: 'deleted', startedAt: 9 }])).toBe(0);
  });

  it('counts sessions in a rolling window that includes today', () => {
    expect(sessionsInLastDays(history, '2026-11-16', 7)).toHaveLength(1); // 13th only
    expect(sessionsInLastDays(history, '2026-11-15', 7)).toHaveLength(2);
    expect(sessionsInLastDays(history, '2026-11-08', 7)).toHaveLength(0); // future ones excluded
  });

  it('builds one weekly point per week, oldest first', () => {
    const series = weeklySeries(history, 'ex1', '2026-11-16', 3);
    expect(series.map((w) => w.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(series[0]).toMatchObject({ volume: 0, e1rm: null, sessions: 0 });
    expect(series[1].volume).toBe(24 * 10 + 26 * 8 + 22 * 12);
    expect(series[1].e1rm).toBeCloseTo(32.9, 1);
    expect(series[2].sessions).toBe(0);
  });

  it('averages working sets per muscle group per week', () => {
    const balance = Object.fromEntries(
      muscleBalance(history, '2026-11-16', 4).map((r) => [r.group, r.setsPerWeek]),
    );
    expect(balance['Upper Chest']).toBe(0.8); // 3 sets over 4 weeks
    expect(balance.Core).toBe(0.3);
    expect(balance.Legs).toBe(0);
  });

  it('measures progress toward a goal in either direction', () => {
    expect(progressToward(73.2, 71.4, 70)).toBeCloseTo(56.25, 2); // cutting
    expect(progressToward(116.5, 118, 120)).toBeCloseTo(42.86, 2); // building
    expect(progressToward(73, 74, 70)).toBe(0); // moved the wrong way
    expect(progressToward(73, 69, 70)).toBe(100); // overshoot is capped
    expect(progressToward(70, 70, 70)).toBe(100);
  });

  it('computes the shoulder-to-waist ratio', () => {
    expect(vTaperRatio(118, 77)).toBeCloseTo(1.532, 3);
    expect(vTaperRatio(118, 0)).toBe(0);
  });
});

describe('rest timer', () => {
  const t0 = 1_800_000_000_000;

  it('counts down from an end timestamp', () => {
    const timer = startTimer(90, t0);
    expect(timer).toEqual({ endsAt: t0 + 90000, durationMs: 90000 });
    expect(remainingSeconds(timer.endsAt, t0)).toBe(90);
    expect(remainingSeconds(timer.endsAt, t0 + 1)).toBe(90);
    expect(remainingSeconds(timer.endsAt, t0 + 1000)).toBe(89);
  });

  it('stays correct after the page was frozen (screen lock)', () => {
    const timer = startTimer(120, t0);
    // No ticks happen for 73.4 seconds, then the page wakes up.
    expect(remainingSeconds(timer.endsAt, t0 + 73_400)).toBe(47);
    // Woke up long after it finished: zero, never negative.
    expect(remainingSeconds(timer.endsAt, t0 + 600_000)).toBe(0);
  });

  it('adds and removes 15 seconds, never dropping below one second', () => {
    const timer = startTimer(60, t0);
    const plus = adjustTimer(timer, 15, t0 + 10_000);
    expect(remainingSeconds(plus.endsAt, t0 + 10_000)).toBe(65);
    expect(plus.durationMs).toBe(75_000);

    const minus = adjustTimer(timer, -15, t0 + 10_000);
    expect(remainingSeconds(minus.endsAt, t0 + 10_000)).toBe(35);

    const floor = adjustTimer(timer, -15, t0 + 55_000);
    expect(remainingSeconds(floor.endsAt, t0 + 55_000)).toBe(1);
  });

  it('reports the fraction of the ring left', () => {
    const timer = startTimer(60, t0);
    expect(fractionLeft(timer, t0)).toBe(1);
    expect(fractionLeft(timer, t0 + 30_000)).toBe(0.5);
    expect(fractionLeft(timer, t0 + 90_000)).toBe(0);
  });
});

describe('prayer times', () => {
  const sec = (h, m, d = 16) => klTime(2026, 11, d, h, m) / 1000;
  const row = (d) => ({
    day: d,
    hijri: '1448-06-06',
    fajr: sec(5, 37, d),
    syuruk: sec(6, 51, d),
    dhuhr: sec(12, 52, d),
    asr: sec(16, 14, d),
    maghrib: sec(18, 51, d),
    isha: sec(20, 5, d),
  });
  const payload = { zone: 'JHR02', year: 2026, month: 'NOV', prayers: [row(15), row(16), row(17)] };

  it('parses a month into Malaysian day keys', () => {
    const month = parseMonth(payload);
    expect(Object.keys(month.days)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    const today = month.days['2026-11-16'];
    expect(formatClock(today.times.Subuh)).toBe('05:37');
    expect(formatClock(today.times.Isyak)).toBe('20:05');
    expect(today.hijri).toBe('1448-06-06');
  });

  it('accepts millisecond timestamps as well as seconds', () => {
    const ms = { ...payload, prayers: [Object.fromEntries(Object.entries(row(16)).map(([k, v]) => [k, typeof v === 'number' && k !== 'day' ? v * 1000 : v]))] };
    expect(formatClock(parseMonth(ms).days['2026-11-16'].times.Zohor)).toBe('12:52');
  });

  it('rejects payloads that are not prayer data', () => {
    expect(parseMonth(null)).toBeNull();
    expect(parseMonth({ prayers: 'nope' })).toBeNull();
    expect(parseMonth({ prayers: [{ day: 1 }] })).toBeNull();
  });

  it('refuses times that are out of order or implausible for Malaysia', () => {
    const good = parseMonth(payload).days['2026-11-16'].times;
    expect(isPlausible(good)).toBe(true);
    expect(isPlausible({ ...good, Asar: good.Zohor - 1 })).toBe(false);
    expect(isPlausible({ ...good, Subuh: good.Subuh - 3 * 3600000 })).toBe(false);
    // A row shifted by a timezone bug (8 hours) must not be shown.
    const shifted = Object.fromEntries(Object.entries(good).map(([k, v]) => [k, v + 8 * 3600000]));
    expect(isPlausible(shifted)).toBe(false);
  });

  it('finds the next and current prayer', () => {
    const t = parseMonth(payload).days['2026-11-16'].times;
    expect(nextPrayer(t, klTime(2026, 11, 16, 4, 0)).name).toBe('Subuh');
    expect(nextPrayer(t, klTime(2026, 11, 16, 13, 0)).name).toBe('Asar');
    expect(nextPrayer(t, klTime(2026, 11, 16, 21, 0))).toBeNull();
    expect(currentPrayer(t, klTime(2026, 11, 16, 6, 0))).toBe('Subuh');
    expect(currentPrayer(t, klTime(2026, 11, 16, 8, 0))).toBeNull(); // after Syuruk
    expect(currentPrayer(t, klTime(2026, 11, 16, 13, 0))).toBe('Zohor');
    expect(currentPrayer(t, klTime(2026, 11, 16, 23, 0))).toBe('Isyak');
  });

  it('formats the Hijri date supplied by JAKIM', () => {
    expect(formatHijri('1448-06-06')).toBe('6 Jamadilakhir 1448H');
    expect(formatHijri('1448-09-01')).toBe('1 Ramadan 1448H');
    expect(formatHijri('garbage')).toBe('');
    expect(formatHijri(null)).toBe('');
  });

  it('maps weather codes', () => {
    expect(describeWeather(0).label).toBe('Clear');
    expect(describeWeather(63).icon).toBe('rain');
    expect(describeWeather(95).label).toBe('Thunderstorm');
  });
});

// Captured from the live services on 17/11/2026, unmodified.
const fixture = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'));

describe('real API responses', () => {
  it('parses a real month of JAKIM data for JHR02', () => {
    const month = parseMonth(fixture('waktusolat-JHR02-2026-11.json'));
    expect(month.zone).toBe('JHR02');
    const keys = Object.keys(month.days);
    expect(keys).toHaveLength(30); // every day of November passes the sanity check
    expect(keys[0]).toBe('2026-11-01');
    expect(keys.at(-1)).toBe('2026-11-30');
    for (const day of Object.values(month.days)) {
      expect(isPlausible(day.times)).toBe(true);
      expect(Object.keys(day.times)).toEqual(PRAYER_ORDER);
    }
    expect(month.days['2026-11-01'].hijri).toBe('1448-05-21');
    expect(formatHijri(month.days['2026-11-01'].hijri)).toBe('21 Jamadilawal 1448H');
    // Subuh in Johor in November sits around 05:30
    expect(formatClock(month.days['2026-11-17'].times.Subuh)).toMatch(/^05:[2-4]\d$/);
    expect(formatClock(month.days['2026-11-17'].times.Maghrib)).toMatch(/^18:[4-5]\d$/);
  });

  it('parses a real Open-Meteo response', () => {
    const weather = parseWeather(fixture('open-meteo-current.json'));
    expect(weather).toEqual({ temp: 25, feels: 30.9, humidity: 98, code: 3 });
    expect(describeWeather(weather.code).label).toBe('Overcast');
  });

  it('rejects things that are not weather', () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather({ current: { temperature_2m: 'hot' } })).toBeNull();
    expect(parseWeather({ error: true, reason: 'bad request' })).toBeNull();
  });
});

describe('qibla', () => {
  it('points west-north-west from Johor', () => {
    const q = calculateQibla(1.6, 103.8167); // Ulu Tiram
    expect(q.bearing).toBeGreaterThan(292);
    expect(q.bearing).toBeLessThan(294);
    expect(q.distanceKm).toBeGreaterThan(7000);
    expect(q.distanceKm).toBeLessThan(7500);
    expect(compassPoint(q.bearing)).toBe('NW');
  });

  it('is sane at known reference points', () => {
    expect(calculateQibla(21.422487, 39.826206).distanceKm).toBe(0);
    // Directly south of the Kaabah, Qibla is due north.
    expect(calculateQibla(0, 39.826206).bearing).toBeCloseTo(0, 0);
    // London's Qibla is roughly 119° (south-east).
    const london = calculateQibla(51.5074, -0.1278).bearing;
    expect(london).toBeGreaterThan(117);
    expect(london).toBeLessThan(121);
  });

  it('maps every Johor district to a JAKIM zone', () => {
    expect(findDistrict('Ulu Tiram').zone).toBe('JHR02');
    expect(findDistrict('Kluang').zone).toBe('JHR03');
    expect(findDistrict('Muar').zone).toBe('JHR04');
    expect(findDistrict('Nowhere').name).toBe('Ulu Tiram');
    for (const d of JOHOR_DISTRICTS) expect(d.zone).toMatch(/^JHR0[234]$/);
  });
});
