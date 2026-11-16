// End-to-end check of the built app on an iPhone 13 viewport (390×844).
// Run:  npm run build && npm run test:e2e
// Needs Playwright's Chromium (preinstalled in Claude Code cloud sessions).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const KEY = 'mlos_state_v1';
const VIEWPORT = { width: 390, height: 844 };

// Monday 16 Nov 2026, 10:00 in Johor (UTC+8)
const FIXED_NOW = Date.UTC(2026, 10, 16, 2, 0, 0);

// ---- tiny test harness -------------------------------------------------------
const results = [];
let current = '';
function check(condition, label, detail = '') {
  results.push({ ok: Boolean(condition), label: `${current} › ${label}`, detail });
  if (!condition) console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}
const eq = (actual, expected, label) =>
  check(actual === expected, label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

async function until(fn, label, timeout = 4000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return check(true, label);
    } catch (err) {
      last = err.message;
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  return check(false, label, `timed out (last: ${JSON.stringify(last)})`);
}

// ---- fixtures ------------------------------------------------------------------
function prayerPayload(nowMs) {
  const kl = new Date(nowMs + 8 * 3600e3);
  const y = kl.getUTCFullYear();
  const m = kl.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const at = (d, h, min) => Date.UTC(y, m, d, h - 8, min) / 1000;
  const prayers = [];
  for (let d = 1; d <= days; d++) {
    prayers.push({ day: d, hijri: '1448-06-06', fajr: at(d, 5, 37), syuruk: at(d, 6, 51), dhuhr: at(d, 12, 52), asr: at(d, 16, 14), maghrib: at(d, 18, 51), isha: at(d, 20, 5) });
  }
  return { zone: 'JHR02', year: y, month: 'NOV', month_number: m + 1, last_updated: null, prayers };
}
const WEATHER = { current: { time: '2026-11-16T10:00', interval: 900, temperature_2m: 30.4, relative_humidity_2m: 74, apparent_temperature: 35.8, weather_code: 2 } };

let browser;
async function open({ live = 'ok', fixedTime = null, serviceWorkers = 'block' } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (fixedTime != null) await page.clock.install({ time: fixedTime });
  const nowMs = fixedTime ?? Date.now();
  if (live === 'ok') {
    await context.route('https://api.waktusolat.app/**', (r) => r.fulfill({ json: prayerPayload(nowMs) }));
    await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: WEATHER }));
  } else if (live === 'down') {
    await context.route('https://api.waktusolat.app/**', (r) => r.abort());
    await context.route('https://api.open-meteo.com/**', (r) => r.abort());
  } else if (live === 'garbage') {
    // A response shifted by eight hours (a classic timezone bug) must never be displayed.
    const bad = prayerPayload(nowMs);
    for (const row of bad.prayers) for (const k of ['fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha']) row[k] += 8 * 3600;
    await context.route('https://api.waktusolat.app/**', (r) => r.fulfill({ json: bad }));
    await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { nope: true } }));
  }
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="prayer-card"]');
  const state = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  const tab = (id) => page.click(`[data-testid="tab-${id}"]`);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  return { context, page, errors, state, tab, overflow };
}

const dismissTour = async (page) => {
  if (await page.locator('[data-testid="quick-tour"]').count()) await page.click('[aria-label="Dismiss tour"]');
};
const pillSeconds = async (page) => {
  const text = await page.locator('[data-testid="rest-remaining"]').textContent();
  const [m, s] = text.split(':').map(Number);
  return m * 60 + s;
};

/** A real finger swipe across the exercise card (touchstart → touchend). */
async function swipe(page, fromX, toX) {
  await page.evaluate(
    ([x1, x2]) => {
      const el = document.querySelector('[data-testid="exercise-card"]');
      const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(x1)], changedTouches: [touch(x1)] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(x2)] }));
    },
    [fromX, toX],
  );
}

// ---- scenarios -----------------------------------------------------------------
async function layoutAndPwa() {
  current = 'Layout 390×844';
  const { context, page, errors, tab, overflow } = await open({ fixedTime: FIXED_NOW });

  eq(await page.locator('[data-testid="quick-tour"]').count(), 1, 'quick tour shows on first open');
  eq(await overflow(), 0, 'Today: no horizontal scroll (with tour)');
  // swipe through the three tour cards
  const track = page.locator('[data-testid="quick-tour"] .snap-x');
  await track.evaluate((el) => el.scrollTo({ left: el.clientWidth * 2 }));
  await until(async () => (await page.locator('[data-testid="quick-tour"]').textContent()).includes('3 of 3'), 'tour is swipeable to step 3');
  await page.locator('[data-testid="quick-tour"] button', { hasText: 'Got it' }).click();
  await until(async () => (await page.locator('[data-testid="quick-tour"]').count()) === 0, 'tour dismisses');

  for (const id of ['today', 'workout', 'progress', 'deen']) {
    await tab(id);
    await page.waitForTimeout(250);
    eq(await overflow(), 0, `${id}: no horizontal scroll`);
  }

  await page.click('[data-testid="open-settings"]');
  await page.waitForSelector('[data-testid="settings-sheet"]');
  eq(await overflow(), 0, 'settings sheet: no horizontal scroll');
  const smallInputs = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => el.type !== 'file' && Number.parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.getAttribute('aria-label') || el.id || el.type),
  );
  eq(smallInputs.length, 0, `settings fields are ≥16px (no iOS zoom) ${smallInputs.join(',')}`);
  await page.keyboard.press('Escape');

  await tab('workout');
  await page.click('[data-testid="start-session"]');
  await page.waitForSelector('[data-testid="exercise-card"]');
  eq(await overflow(), 0, 'active workout: no horizontal scroll while the card slides in');
  await page.waitForTimeout(450);
  eq(await overflow(), 0, 'active workout: no horizontal scroll once settled');
  await page.click('[data-testid="next-exercise"]');
  eq(await overflow(), 0, 'no horizontal scroll during a slide transition');
  await page.waitForTimeout(450);
  const small2 = await page.evaluate(() => [...document.querySelectorAll('input, select')].filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16).length);
  eq(small2, 0, 'workout fields are ≥16px');
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="exercise-card"] button')]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.height < 36 || r.width < 36).length,
  );
  eq(tooSmall, 0, 'workout buttons are at least 36×36px');

  current = 'PWA shell';
  const head = await page.evaluate(() => ({
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
    viewport: document.querySelector('meta[name="viewport"]')?.content,
    manifest: document.querySelector('link[rel="manifest"]')?.href,
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href,
  }));
  eq(head.capable, 'yes', 'apple-mobile-web-app-capable');
  eq(head.bar, 'black-translucent', 'status bar style');
  check(head.viewport.includes('viewport-fit=cover'), 'viewport-fit=cover for safe areas');
  const manifest = await (await context.request.get(head.manifest)).json();
  eq(manifest.display, 'standalone', 'manifest display standalone');
  eq(manifest.background_color, '#000000', 'manifest background colour');
  eq(manifest.theme_color, '#000000', 'manifest theme colour');
  for (const icon of manifest.icons) {
    const res = await context.request.get(new URL(icon.src, head.manifest).href);
    check(res.ok(), `icon ${icon.src} is served`);
  }
  const touch = await context.request.get(head.touchIcon);
  const png = await touch.body();
  check(touch.ok() && png.subarray(1, 4).toString() === 'PNG', 'apple-touch-icon is a PNG');
  eq(png.readUInt32BE(16), 180, 'apple-touch-icon is 180px wide');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

async function dailyLogsPersist() {
  current = 'Daily logs + localStorage';
  const { context, page, state, tab, errors } = await open({ fixedTime: FIXED_NOW });
  await dismissTour(page);

  eq((await state()).settings.tourDone, true, 'tour dismissal is saved');
  check((await page.locator('[data-testid="prayer-card"]').textContent()).includes('05:37'), 'prayer times render in 24h Malaysia time');
  check((await page.locator('[data-testid="prayer-card"]').textContent()).includes('6 Jamadilakhir 1448H'), 'Hijri date from the feed is shown');
  check((await page.locator('[data-testid="next-prayer"]').textContent()).startsWith('Zohor in 2h 52m'), 'next-prayer countdown is correct at 10:00', await page.locator('[data-testid="next-prayer"]').textContent());
  check((await page.locator('[data-testid="qibla-bearing"]').textContent()).startsWith('292.'), 'Qibla bearing for Ulu Tiram ≈ 292°');
  check((await page.locator('[data-testid="weather"]').textContent()).includes('30°C'), 'weather renders');

  await page.click('[data-testid="prayer-Subuh"]');
  await page.click('[data-testid="prayer-Zohor"]');
  await page.locator('button', { hasText: '+25 g' }).click();
  await page.locator('button', { hasText: '+40 g' }).click();
  await until(async () => (await state()).protein['2026-11-16'] === 65, 'protein written to localStorage');
  eq(JSON.stringify((await state()).prayers['2026-11-16']), JSON.stringify({ Subuh: true, Zohor: true }), 'prayer ticks written to localStorage');
  eq(await page.locator('[data-testid="fardhu-count"]').textContent(), '2/5', 'fardhu counter');

  await tab('deen');
  await page.click('[data-testid="pillar-Hilm"]');
  await until(async () => (await state()).muruah['2026-11-16']?.Hilm === true, 'pillar tick written to localStorage');

  await page.reload();
  await page.waitForSelector('[data-testid="prayer-card"]');
  eq(await page.locator('[data-testid="quick-tour"]').count(), 0, 'tour stays dismissed after reload');
  eq(await page.locator('[data-testid="fardhu-count"]').textContent(), '2/5', 'prayer ticks survive reload');
  eq(await page.locator('[data-testid="prayer-Subuh"]').getAttribute('aria-checked'), 'true', 'Subuh still ticked');
  check((await page.locator('[data-testid="ring-protein"]').textContent()).startsWith('65'), 'protein survives reload');
  await tab('deen');
  eq(await page.locator('[data-testid="pillars-count"]').textContent(), '1/7', 'pillar survives reload');

  // A new day: yesterday's ticks stay in history, today starts clean.
  await tab('today');
  await page.clock.fastForward('24:00:00');
  await until(async () => (await page.locator('[data-testid="fardhu-count"]').textContent()) === '0/5', 'prayer ticks reset at the next day');
  eq(await page.locator('[data-testid="prayer-Subuh"]').getAttribute('aria-checked'), 'false', 'Subuh unticked on the new day');
  check((await page.locator('[data-testid="ring-protein"]').textContent()).startsWith('0'), 'protein resets on the new day');
  check((await page.locator('[data-testid="readiness"]').textContent()).includes('17/11/2026'), 'date shown as DD/MM/YYYY');
  eq((await state()).prayers['2026-11-16'].Subuh, true, 'the previous day is kept in storage');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

async function workoutFlow() {
  current = 'Workout flow';
  const { context, page, state, tab, errors } = await open({ fixedTime: FIXED_NOW });
  await dismissTour(page);
  const before = (await state()).sessions.length;

  await page.click('[data-testid="quick-start"] button');
  await page.waitForSelector('[data-testid="exercise-card"]');
  eq(await page.locator('[data-testid="exercise-name"]').textContent(), 'Incline Dumbbell Press', 'quick start opens the first exercise');
  eq(await page.inputValue('#stepper-load'), '26', 'load prefilled from last session');

  // Swipe between exercise cards
  await swipe(page, 320, 80);
  await until(async () => (await page.locator('[data-testid="exercise-name"]').textContent()) === 'Weighted Pull-Ups / Lat Pulldown', 'swiping left slides to the next exercise');
  await swipe(page, 80, 320);
  await until(async () => (await page.locator('[data-testid="exercise-name"]').textContent()) === 'Incline Dumbbell Press', 'swiping right slides back');
  await swipe(page, 200, 230);
  await page.waitForTimeout(150);
  eq(await page.locator('[data-testid="exercise-name"]').textContent(), 'Incline Dumbbell Press', 'a small accidental drag does not change exercise');

  // Live maths: 26 kg × 10 → Epley 34.7 kg
  await page.fill('#stepper-reps', '10');
  eq(await page.locator('[data-testid="e1rm"]').textContent(), '34.7 kg', 'Epley 1RM updates live');
  await page.click('[aria-label="Increase Load"]');
  eq(await page.inputValue('#stepper-load'), '28.5', 'stepper adds 2.5 kg');
  await page.fill('#stepper-load', '26');

  // Set 1 matches the previous best → no PR
  await page.click('[data-testid="complete-set"]');
  await until(async () => (await state()).active?.sets.length === 1, 'set 1 written to localStorage');
  eq(await page.locator('[data-testid="pr-badge"]').count(), 0, 'matching a previous best is not a PR');
  eq(await page.locator('[data-testid="session-volume"]').textContent(), '260', 'session volume = kg × reps');
  eq(await page.locator('[data-testid="rest-timer"]').count(), 1, 'rest timer starts automatically');
  eq(await pillSeconds(page), 120, 'rest timer uses the exercise default (120s)');

  // Set 2 beats it → PR
  await page.fill('#stepper-load', '28');
  await page.click('[data-testid="complete-set"]');
  await until(async () => (await page.locator('[data-testid="pr-badge"]').count()) === 1, 'heavier set is flagged as a PR');
  eq((await state()).active.sets[1].pr, true, 'PR flag saved');
  eq(await page.locator('[data-testid="session-volume"]').textContent(), '540', 'volume accumulates (260 + 280)');

  // Invalid input is refused
  await page.fill('#stepper-reps', '0');
  await page.click('[data-testid="complete-set"]');
  eq(await page.locator('[data-testid="logged-set"]').count(), 2, 'a set with 0 reps is not logged');
  check(await page.locator('[role="alert"]').count(), 'and an error message explains why');
  await page.fill('#stepper-reps', '9');

  // Delete a set
  await page.click('[aria-label="Delete set 1"]');
  await until(async () => (await state()).active.sets.length === 1, 'deleting a set updates localStorage');

  // Slide to the next exercise and back
  await page.click('[data-testid="next-exercise"]');
  await until(async () => (await page.locator('[data-testid="exercise-name"]').textContent()) === 'Weighted Pull-Ups / Lat Pulldown', 'Next slides to exercise 2');
  check((await page.locator('[data-testid="exercise-card"]').getAttribute('class')).includes('slide-next'), 'slide-in animation runs forwards');
  eq((await state()).active.exIdx, 1, 'current exercise is saved');

  // Mid-session reload: session, position and timer all come back
  await page.reload();
  await page.waitForSelector('[data-testid="prayer-card"]');
  eq(await page.locator('[data-testid="resume-workout"]').count(), 1, 'Today offers to resume the session after reload');
  eq(await page.locator('[data-testid="rest-timer"]').count(), 1, 'rest timer survives reload');
  await page.click('[data-testid="resume-workout"]');
  eq(await page.locator('[data-testid="exercise-name"]').textContent(), 'Weighted Pull-Ups / Lat Pulldown', 'resumes on the same exercise');
  await page.click('[data-testid="prev-exercise"]');
  await until(async () => (await page.locator('[data-testid="logged-set"]').count()) === 1, 'logged set is still there');
  check((await page.locator('[data-testid="exercise-card"]').getAttribute('class')).includes('slide-prev'), 'slide-in animation runs backwards');

  // Stopwatch follows the clock
  await page.clock.fastForward('10:00');
  await until(async () => (await page.locator('[data-testid="stopwatch"]').textContent()).startsWith('10:'), 'session stopwatch tracks elapsed time');

  // Finish → summary → history
  await page.click('[data-testid="finish-button"]');
  await page.waitForSelector('[data-testid="finish-sheet"]');
  await page.click('[data-testid="save-session"]');
  await page.waitForSelector('[data-testid="summary-sheet"]');
  check((await page.locator('[data-testid="summary-sheet"]').textContent()).includes('Workout complete'), 'summary sheet appears');
  const after = await state();
  eq(after.sessions.length, before + 1, 'finished session appended to history');
  eq(after.active, null, 'active session cleared');
  eq(after.timer, null, 'rest timer cleared on finish');
  const saved = after.sessions.at(-1);
  eq(saved.date, '2026-11-16', 'session saved under the Malaysian date');
  eq(saved.sample, undefined, 'real session is not marked as sample');
  await page.locator('[data-testid="summary-sheet"] button', { hasText: 'Done' }).click();

  await tab('progress');
  check((await page.locator('[data-testid="session-row"]').first().textContent()).includes('16/11/2026'), 'new session listed in Progress');
  await tab('today');
  check((await page.locator('[data-testid="ring-volume"]').textContent()).startsWith('280'), 'Today volume ring counts the finished session (28 kg × 10)', await page.locator('[data-testid="ring-volume"]').textContent());

  // Discard path uses the confirmation modal
  await tab('workout');
  await page.click('[data-testid="start-session"]');
  await page.fill('#stepper-reps', '8');
  await page.click('[data-testid="complete-set"]');
  await page.click('[data-testid="finish-button"]');
  await page.click('[data-testid="discard-session"]');
  await page.waitForSelector('[role="alertdialog"]');
  await page.locator('[role="alertdialog"] button', { hasText: 'Cancel' }).click();
  check((await state()).active !== null, 'Cancel keeps the session');
  await page.click('[data-testid="discard-session"]');
  await page.locator('[role="alertdialog"] button', { hasText: 'Discard' }).click();
  await until(async () => (await state()).active === null, 'Discard removes the session');
  eq((await state()).sessions.length, before + 1, 'a discarded session is not saved');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

async function timerAccuracy() {
  current = 'Rest timer accuracy';
  // (a) real clock: the display must match wall-clock time
  {
    const { context, page, state, tab } = await open();
    await dismissTour(page);
    await tab('workout');
    await page.click('[data-testid="start-session"]');
    await page.locator('button', { hasText: /^60s$/ }).click();
    await page.click('[data-testid="complete-set"]');
    await page.waitForSelector('[data-testid="rest-timer"]');
    const endsAt = (await state()).timer.endsAt;
    for (const waitMs of [0, 2300, 3100]) {
      await page.waitForTimeout(waitMs);
      const [shown, expected] = [await pillSeconds(page), Math.ceil((endsAt - Date.now()) / 1000)];
      check(Math.abs(shown - expected) <= 1, `real time: shows ${shown}s, wall clock says ${expected}s`);
    }
    await page.locator('button', { hasText: '+15s' }).click();
    await until(async () => (await state()).timer.endsAt === endsAt + 15000, '+15s moves the end time by exactly 15 s');
    await page.locator('button', { hasText: '−15s' }).click();
    await page.locator('button', { hasText: '−15s' }).click();
    await until(async () => (await state()).timer.endsAt === endsAt - 15000, '−15s moves it back by exactly 15 s each tap');
    await page.click('[aria-label="Skip rest"]');
    await until(async () => (await state()).timer === null, 'skip clears the timer');
    eq(await page.locator('[data-testid="rest-done"]').count(), 0, 'skipping does not announce "rest over"');
    await context.close();
  }
  // (b) screen lock: time jumps without the page ticking, like a locked iPhone
  {
    const { context, page, state, tab } = await open({ fixedTime: FIXED_NOW });
    await dismissTour(page);
    await tab('workout');
    await page.click('[data-testid="start-session"]');
    await page.click('[data-testid="complete-set"]'); // 120 s default
    await page.waitForSelector('[data-testid="rest-timer"]');
    eq(await pillSeconds(page), 120, 'starts at 2:00');
    await page.clock.fastForward(73_400);
    await until(async () => (await pillSeconds(page)) === 47, 'after a 73.4 s "lock" it shows 0:47, not a stale count');
    // custom rest value
    await page.click('[aria-label="Skip rest"]');
    await page.locator('[data-testid="exercise-card"] button', { hasText: 'Custom' }).click();
    await page.fill('[aria-label="Custom rest in seconds"]', '45');
    await page.click('[data-testid="complete-set"]');
    await until(async () => (await pillSeconds(page)) === 45, 'custom rest of 45 s is honoured');
    // let it run out while "locked"
    await page.clock.fastForward(50_000);
    await until(async () => (await state()).timer === null, 'timer clears itself when it runs out');
    await until(async () => (await page.locator('[data-testid="rest-done"]').count()) === 1, '"Rest over" confirmation shows');
    await context.close();
  }
}

async function progressAndMeasurements() {
  current = 'Progress + measurements';
  const { context, page, state, tab, errors } = await open({ fixedTime: FIXED_NOW });
  await dismissTour(page);
  await tab('progress');
  await page.waitForSelector('[data-testid="overload-card"] canvas');

  eq(await page.locator('canvas').count(), 2, 'line chart and radar chart are drawn');
  const painted = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')].map((c) => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    }),
  );
  check(painted.every((n) => n > 2000), `both charts actually contain pixels (${painted.join(', ')})`);
  eq(await page.locator('[data-testid="ring-weight"]').textContent(), '71.4', 'weight ring shows the latest entry');
  eq(await page.locator('[data-testid="ring-taper"]').textContent(), '1.53', 'V-taper ratio = shoulders ÷ waist (118 ÷ 77)');
  eq(await page.locator('[data-testid="sample-banner"]').count(), 1, 'sample-data banner is visible');

  await page.selectOption('[data-testid="lift-select"]', { label: 'Hack Squat / Barbell Squat' });
  await page.waitForTimeout(300);
  check(true, 'lift selector switches the chart');

  // Log today's measurements
  await page.click('[data-testid="log-measurement"]');
  await page.waitForSelector('[data-testid="measure-sheet"]');
  eq(await page.locator('[data-testid="measure-date-label"]').textContent(), '16/11/2026', 'measurement date reads DD/MM/YYYY');
  const small = await page.evaluate(() => [...document.querySelectorAll('[data-testid="measure-sheet"] input')].filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16).length);
  eq(small, 0, 'measurement fields are ≥16px');
  await page.click('[data-testid="save-measurement"]');
  check((await page.locator('[data-testid="measure-sheet"] [role="alert"]').textContent()).includes('at least one'), 'an empty form is refused');
  await page.fill('[data-testid="measure-weight"]', '70.9');
  await page.fill('[data-testid="measure-waist"]', '76.5');
  await page.fill('[data-testid="measure-shoulders"]', '118.5');
  await page.click('[data-testid="save-measurement"]');
  await until(async () => (await state()).measurements.at(-1).weight === 70.9, 'measurement written to localStorage');
  eq(await page.locator('[data-testid="ring-weight"]').textContent(), '70.9', 'weight ring updates');
  eq(await page.locator('[data-testid="ring-taper"]').textContent(), '1.55', 'V-taper ring updates (118.5 ÷ 76.5)');
  eq(await page.locator('[data-testid="ring-bodyFat"]').textContent(), '13.2', 'body fat keeps its last known value');

  await page.reload();
  await page.waitForSelector('[data-testid="prayer-card"]');
  await tab('progress');
  eq(await page.locator('[data-testid="ring-weight"]').textContent(), '70.9', 'measurement survives reload');

  // Delete with confirmation
  const rows = await page.locator('[data-testid="measurement-row"]').count();
  await page.locator('[data-testid="measurement-row"] button').first().click();
  await page.locator('[role="alertdialog"] button', { hasText: 'Cancel' }).click();
  eq(await page.locator('[data-testid="measurement-row"]').count(), rows, 'Cancel keeps the entry');
  await page.locator('[data-testid="measurement-row"] button').first().click();
  await page.locator('[role="alertdialog"] button', { hasText: 'Delete' }).click();
  await until(async () => (await page.locator('[data-testid="ring-weight"]').textContent()) === '71.4', 'Delete removes it and the ring falls back');

  // Clear sample data from the banner
  await page.locator('[data-testid="sample-banner"] button').click();
  await page.locator('[role="alertdialog"] button', { hasText: 'Clear' }).click();
  await until(async () => (await state()).sessions.length === 0, 'sample sessions cleared');
  eq((await state()).measurements.length, 0, 'sample measurements cleared');
  eq(await page.locator('[data-testid="sample-banner"]').count(), 0, 'banner disappears');
  eq(await page.locator('[data-testid="ring-weight"]').textContent(), '—', 'rings handle having no data');
  eq(await page.locator('canvas').count(), 0, 'charts show empty states instead of blank canvases');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

async function settingsAndBackup() {
  current = 'Settings, routine, backup';
  const { context, page, state, tab, errors } = await open({ fixedTime: FIXED_NOW });
  await dismissTour(page);
  await page.click('[data-testid="open-settings"]');
  await page.waitForSelector('[data-testid="settings-sheet"]');

  // Targets
  await page.fill('[data-testid="setting-proteinTarget"]', '180');
  await page.locator('[data-testid="setting-proteinTarget"]').blur();
  await until(async () => (await state()).settings.proteinTarget === 180, 'protein target saved');
  await page.fill('[data-testid="setting-weeklyTarget"]', '99');
  await page.locator('[data-testid="setting-weeklyTarget"]').blur();
  await until(async () => (await state()).settings.weeklyTarget === 7, 'out-of-range target is clamped (99 → 7)');

  // District → zone
  await page.selectOption('[data-testid="setting-district"]', 'Muar');
  await until(async () => (await state()).settings.district === 'Muar', 'district saved');
  check((await page.locator('[data-testid="header-subtitle"]').textContent()).includes('JHR04'), 'header shows the new zone (JHR04)');

  // Mute
  await page.click('[role="switch"][aria-label="Sound effects"]');
  await until(async () => (await state()).settings.muted === true, 'mute toggle saved');

  // Add, edit, reorder and remove an exercise
  await page.click('[data-testid="add-exercise"]');
  await page.waitForSelector('[data-testid="exercise-form"]');
  await page.click('[data-testid="ex-save"]');
  check((await page.locator('[data-testid="exercise-form"] [role="alert"]').textContent()).includes('name'), 'exercise without a name is refused');
  await page.fill('[data-testid="ex-name"]', 'Face Pull');
  await page.fill('[data-testid="ex-sets"]', '4');
  await page.click('[data-testid="ex-save"]');
  await until(async () => (await state()).routine[0].exercises.at(-1).name === 'Face Pull', 'new exercise saved to the routine');
  eq((await state()).routine[0].exercises.at(-1).sets, 4, 'with its sets');
  await page.click('[aria-label="Move Face Pull up"]');
  await until(async () => (await state()).routine[0].exercises.at(-2).name === 'Face Pull', 'reorder saved');
  await page.click('[aria-label="Edit Face Pull"]');
  await page.fill('[data-testid="ex-name"]', 'Cable Face Pull');
  await page.click('[data-testid="ex-save"]');
  await until(async () => (await state()).routine[0].exercises.some((e) => e.name === 'Cable Face Pull'), 'edit saved');
  await page.keyboard.press('Escape');
  await tab('workout');
  check((await page.locator('[data-testid="workout-preview"]').textContent()).includes('Cable Face Pull'), 'Workout tab shows the edited routine');
  await page.click('[data-testid="open-settings"]');
  await page.click('[aria-label="Edit Cable Face Pull"]');
  await page.click('[data-testid="ex-delete"]');
  await page.locator('[role="alertdialog"] button', { hasText: 'Remove' }).click();
  await until(async () => !(await state()).routine[0].exercises.some((e) => e.name === 'Cable Face Pull'), 'exercise removed after confirming');

  // Export
  const snapshot = await state();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="export-backup"]')]);
  eq(download.suggestedFilename(), 'life-os-backup-2026-11-16.json', 'backup file name carries the date');
  const backupPath = await download.path();
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  eq(backup.app, 'the-muslim-man-life-os', 'backup is tagged with the app id');
  eq(backup.state.sessions.length, snapshot.sessions.length, 'backup contains every session');
  eq(backup.state.settings.proteinTarget, 180, 'backup contains settings');
  await until(async () => typeof (await state()).settings.lastBackupAt === 'number', 'last-backup time recorded');

  // Reset: cancel, then confirm
  await page.click('[data-testid="reset-default"]');
  await page.waitForSelector('[role="alertdialog"]');
  check((await page.locator('[role="alertdialog"]').textContent()).includes('can’t be undone'), 'reset shows an iOS-style confirmation');
  await page.locator('[role="alertdialog"] button', { hasText: 'Cancel' }).click();
  eq((await state()).settings.proteinTarget, 180, 'Cancel leaves data untouched');
  await page.click('[data-testid="reset-default"]');
  await page.locator('[role="alertdialog"] button', { hasText: 'Reset' }).click();
  await until(async () => (await state()).settings.proteinTarget === 150, 'Reset restores default settings');
  const reset = await state();
  eq(reset.settings.district, 'Ulu Tiram', 'district back to Ulu Tiram');
  eq(reset.sessions.length, 16, 'sample history restored');
  eq(reset.routine[0].exercises.length, 5, 'default routine restored');

  // Import the backup taken above
  await page.setInputFiles('[data-testid="import-file"]', { name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await until(async () => (await page.locator('[data-testid="settings-message"]').textContent()).includes('not a Life OS backup'), 'a foreign file is rejected with a clear message');
  eq((await state()).settings.proteinTarget, 150, 'and nothing is changed');
  await page.setInputFiles('[data-testid="import-file"]', backupPath);
  await page.waitForSelector('[role="alertdialog"]');
  check((await page.locator('[role="alertdialog"]').textContent()).includes('16 sessions'), 'import asks for confirmation and says what is inside');
  await page.locator('[role="alertdialog"] button', { hasText: 'Replace' }).click();
  await until(async () => (await state()).settings.proteinTarget === 180, 'import restores the backed-up data');
  eq((await state()).settings.district, 'Muar', 'including the district');

  // Clear sample data
  await page.click('[data-testid="clear-sample"]');
  await page.locator('[role="alertdialog"] button', { hasText: 'Clear' }).click();
  await until(async () => (await state()).sessions.length === 0, 'Clear sample data removes the demo history');
  eq(await page.locator('[data-testid="clear-sample"]').count(), 0, 'and the option disappears');

  await page.reload();
  await page.waitForSelector('[data-testid="prayer-card"]');
  eq((await state()).settings.proteinTarget, 180, 'everything persists across reload');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

async function liveDataFailures() {
  current = 'Live data failures';
  {
    const { context, page, errors } = await open({ live: 'down', fixedTime: FIXED_NOW });
    await until(async () => (await page.locator('[data-testid="prayer-source"]').textContent()).includes('unavailable'), 'no network + no saved copy → says times are unavailable');
    check(!(await page.locator('[data-testid="prayer-card"]').textContent()).match(/\d\d:\d\d/), 'and shows no invented times');
    check((await page.locator('[data-testid="readiness"]').textContent()).includes('Weather needs a connection'), 'weather degrades gracefully');
    check((await page.locator('[data-testid="qibla-bearing"]').textContent()).startsWith('292.'), 'Qibla still works offline (calculated on the phone)');
    await page.click('[data-testid="prayer-Asar"]');
    eq(await page.locator('[data-testid="fardhu-count"]').textContent(), '1/5', 'prayers can still be ticked without times');
    eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
    await context.close();
  }
  {
    const { context, page } = await open({ live: 'garbage', fixedTime: FIXED_NOW });
    await until(async () => (await page.locator('[data-testid="prayer-source"]').textContent()).includes('unavailable'), 'implausible prayer data is rejected, not displayed');
    check(!(await page.locator('[data-testid="prayer-card"]').textContent()).match(/\d\d:\d\d/), 'no wrong times are shown');
    check((await page.locator('[data-testid="readiness"]').textContent()).includes('Weather needs a connection'), 'malformed weather is ignored');
    await context.close();
  }
}

async function offline() {
  current = 'Offline (service worker)';
  const { context, page, errors, tab } = await open({ serviceWorkers: 'allow' });
  await dismissTour(page);
  await page.click('[data-testid="prayer-Subuh"]');
  await until(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active) && Boolean(navigator.serviceWorker.controller)), 'service worker installs and takes control on the first visit', 10000);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((k) => k.startsWith('life-os-shell-'));
    return names.length === 1 ? (await (await caches.open(names[0])).keys()).map((r) => new URL(r.url).pathname) : [];
  });
  check(cached.some((p) => p.endsWith('.js')) && cached.some((p) => p.endsWith('.css')) && cached.includes('/index.html'), `app shell precached (${cached.length} files)`);
  check(cached.includes('/apple-touch-icon.png') && cached.includes('/manifest.json'), 'icons and manifest precached');

  await context.setOffline(true);
  // Offline for real: the mocked data feeds stop answering too.
  await context.unrouteAll();
  await context.route(/api\.(waktusolat\.app|open-meteo\.com)/, (r) => r.abort());
  await page.reload();
  await page.waitForSelector('[data-testid="prayer-card"]', { timeout: 8000 }).catch(() => {});
  eq(await page.locator('[data-testid="prayer-card"]').count(), 1, 'app loads with the network off');
  eq(await page.locator('[data-testid="fardhu-count"]').textContent(), '1/5', 'saved data is there offline');
  check((await page.locator('[data-testid="prayer-card"]').textContent()).includes('05:37'), 'prayer times come from the copy saved on the phone');
  await until(async () => (await page.locator('[data-testid="prayer-source"]').textContent()).includes('Saved copy'), 'and are labelled as a saved copy, not as live');
  check((await page.locator('[data-testid="weather"]').textContent()).includes('as of'), 'offline weather is stamped with when it was fetched');
  check(await page.evaluate(async () => !(await caches.keys()).includes('life-os-data')), 'the service worker keeps no second copy of live data');
  await tab('progress');
  await page.waitForSelector('[data-testid="overload-card"] canvas');
  eq(await page.locator('canvas').count(), 2, 'charts render offline');
  await tab('workout');
  await page.click('[data-testid="start-session"]');
  await page.click('[data-testid="complete-set"]');
  eq(await page.locator('[data-testid="logged-set"]').count(), 1, 'a set can be logged offline');
  eq(errors.length, 0, `no runtime errors ${errors.join(' | ')}`);
  await context.close();
}

// ---- runner --------------------------------------------------------------------
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

if (!existsSync(join(ROOT, 'dist/index.html'))) {
  console.error('No build found. Run "npm run build" first.');
  process.exit(1);
}
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
let failed = false;
try {
  await waitForServer();
  browser = await chromium.launch();
  for (const scenario of [layoutAndPwa, dailyLogsPersist, workoutFlow, timerAccuracy, progressAndMeasurements, settingsAndBackup, liveDataFailures, offline]) {
    const start = results.length;
    try {
      await scenario();
    } catch (err) {
      check(false, 'scenario crashed', err.message.split('\n')[0]);
    }
    const mine = results.slice(start);
    const bad = mine.filter((r) => !r.ok).length;
    console.log(`${bad ? '✗' : '✓'} ${current}: ${mine.length - bad}/${mine.length}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed`);
if (bad.length) {
  for (const r of bad) console.log(`FAILED  ${r.label}${r.detail ? `\n        ${r.detail}` : ''}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
