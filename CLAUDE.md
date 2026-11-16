# CLAUDE.md — THE MUSLIM MAN — LIFE OS

Personal iOS PWA: solat times + Qibla, a slide-by-slide hypertrophy tracker with live rest timer,
body-recomposition analytics, and a daily character (Al-Muru'ah) review.

## Hard constraints
- **Target viewport:** iPhone 13 (`390×844pt`). Zero horizontal scroll at 390px. Respect safe areas
  (`.pt-safe`, `.pb-safe`, `viewport-fit=cover`).
- **Look:** true OLED dark. `#000` background, `#1C1C1E` cards, `#2C2C2E` secondary, hairline
  `rgba(255,255,255,0.08)` borders. Emerald `#10B981` = done/PR, blue `#0A84FF` = active/inputs,
  amber `#FF9F0A` = rest, gold `#D4AF37` = Islamic content. Tokens live in `src/index.css` (`@theme`).
- **Inputs are never below 16px** (prevents iOS Safari focus zoom). The e2e test enforces this.
- **Localisation:** Ulu Tiram, Johor (`JHR02`), `Asia/Kuala_Lumpur`, `DD/MM/YYYY`, 24-hour clock, `kg/cm`.
  All date logic goes through `src/lib/dates.js` — never use the device's local timezone directly.
- **Islamic content:** never fabricate Quran verses, hadith text, hadith numbers, gradings or audio URLs.
  Verify every reference against a reliable source before adding it. Keep established teachings visibly
  separate from scholarly opinion, personal frameworks (the "7 pillars" is one) and scientific claims.
- **Prayer times:** never display a time that has not passed `isPlausible()` in `src/lib/prayer.js`.
  Showing "unavailable" is always better than showing a wrong time.
- **Offline-first:** no external fonts, images or audio files. Sounds are synthesised (`src/utils/sound.js`).
- **Data:** everything the user logs lives in one `localStorage` key (`mlos_state_v1`). Nothing is sent anywhere.

## Commands
- `npm run dev` — dev server (no service worker in dev)
- `npm run build` — production build; also generates `dist/sw.js` with the precache list
- `npm run lint` — oxlint (must stay at zero warnings)
- `npm test` — unit tests (Vitest) for dates, lifting maths, timer, prayer parsing, store, backup
- `npm run test:e2e` — Playwright run of the built app at 390×844 (needs `npm run build` first)
- `npm run icons` — regenerate PNG icons from the crest (needs Playwright)

Run lint, unit tests, build and e2e before calling any change finished.

## Architecture
- `src/App.jsx` — shell: header, 4 tabs (Today · Workout · Progress · Al-Muru'ah), tab bar. Settings
  ("Routine & Data") open from the gear as a bottom sheet so the bar stays at four tabs.
- `src/store/` — `state.js` (default state, `normalizeState` for anything read from disk or a backup),
  `reducer.js` (pure; ids and timestamps arrive on the action), `storage.js` (load/save, JSON backup),
  `seed.js` (four weeks of sample history, every record flagged `sample: true`).
- `src/lib/` — pure, unit-tested logic: `dates.js`, `calc.js` (Epley 1RM, volume, PR detection, weekly
  series, muscle balance), `timer.js`, `prayer.js`. `src/lib/__fixtures__/` holds unmodified responses
  captured from the real prayer-time and weather services; the parsers are tested against them.
- `src/hooks/` — `useNow`/`useToday`, `useLiveData` (prayer times + weather with dated local copies),
  `useCompass`.
- `src/components/` — `tabs/*`, `SettingsSheet`, `RestTimerPill`, `ProgressCharts` (Chart.js),
  `overlays` (BottomSheet, ConfirmModal), `ui`.
- `src/sw.template.js` + the plugin in `vite.config.js` — cache-first app shell, precached at install.
  Live data is deliberately **not** cached by the service worker (see the comment in the template).

## Behaviours worth knowing before changing things
- **Rest timer** stores an end timestamp (`timer.endsAt`), never a ticking counter, so it stays right
  through screen lock and reloads. Keep it that way.
- **Daily logs** (prayers, pillars, protein) are keyed by the Malaysian calendar day and reset by themselves.
- **PR** = estimated 1RM beats every earlier set of that lift (reps for bodyweight work). Equalling is not a PR.
- **Sample data** must stay clearly labelled and removable in one tap ("Clear sample data").
- **External services:** `api.waktusolat.app` (JAKIM e-Solat data) and `api.open-meteo.com` (weather).
  Both are optional at runtime; the app must work with neither.

## Done
- Stage 1 — shell, prayer times, Qibla, workout logging, PWA install + offline.
- Stage 2 — charts: recomp rings, progressive-overload line chart, muscle-balance radar.
- Stage 5 — JSON export/import, reset with iOS confirmation modal, routine editor.

## Remaining stages
1. **Stage 3 — Quran & audio:** `src/components/QuranReader.jsx` using a legitimate, documented API
   (Quran Foundation or AlQuran Cloud) with Malay + English translations, a Qari selector and graceful
   offline handling. Confirm the exact endpoints, edition identifiers and licence terms from the provider's
   current documentation first — do not guess URLs.
2. **Stage 4 — Islamic philosophy of science & scholars:** `src/data/scholarsData.js` covering
   Ibn al-Haytham, Ibn Sina, Al-Biruni, Al-Khwarizmi, Al-Ghazali and Ibn Rushd, plus the *Zahir & Batin*
   safeguards. Every date, title and attribution needs a citable source.
