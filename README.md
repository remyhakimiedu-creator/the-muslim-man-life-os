# THE MUSLIM MAN — LIFE OS

A personal iPhone web app (PWA): solat times and Qibla for Johor, a slide-by-slide workout tracker
with a live rest timer, body-recomposition charts, and a daily Al-Muru'ah character review.
Built for an iPhone 13 screen, works offline, and keeps all data on the phone.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints. For the real offline-capable build:

```bash
npm run build
npm run preview
```

## Put it on your iPhone

The app needs to be served over HTTPS before iOS will install it.

1. Deploy the `dist/` folder (created by `npm run build`) to any static host — Netlify, Vercel,
   Cloudflare Pages and GitHub Pages all have free tiers. The build uses relative paths, so it works
   at a domain root or in a sub-folder.
2. Open the site in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen**.

Open it once while online so it can save itself and this month's prayer times. After that it launches
with no connection.

## Your data

Everything is stored on the phone in the browser's storage. Nothing is uploaded.
Use **gear icon → Data → Export backup** regularly and keep the file in iCloud Drive: deleting the
app, clearing Safari data or losing the phone erases the history otherwise.

The first launch includes four weeks of **sample** training and measurements so the charts are not
empty. Clear it from **gear icon → Data → Clear sample data** before tracking for real.

## Checks

```bash
npm run lint       # linter
npm test           # unit tests
npm run build
npm run test:e2e   # full browser run at 390×844 (needs Playwright's Chromium)
```

## Sources and limits

- Prayer times: JAKIM e-Solat data served by `api.waktusolat.app`. Times that fail a sanity check are
  not shown. Always treat your local mosque as the final word.
- Weather: `api.open-meteo.com`.
- Qibla: great-circle bearing calculated on the phone. The compass needs motion permission and is
  affected by metal and magnetic cases.
- Estimated 1RM uses the Epley formula. It is an estimate, not a tested maximum.
- Rest-timer sounds cannot play while the iPhone is locked (iOS suspends web audio); the countdown
  itself stays accurate and is correct the moment you unlock.

See `CLAUDE.md` for architecture notes and the remaining build stages.
