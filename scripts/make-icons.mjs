// Renders the PNG app icons from the crest artwork. iOS needs PNG for the
// home-screen icon and wants a full-bleed square (it rounds the corners itself).
// Run with:  node scripts/make-icons.mjs   (needs Playwright's Chromium)
import { createRequire } from 'node:module';

// require() so a globally installed Playwright (NODE_PATH) is found too.
const { chromium } = createRequire(import.meta.url)('playwright');

const crest = `
  <polygon points="256,88 424,256 256,424 88,256" fill="none" stroke="#D4AF37" stroke-width="14"/>
  <polygon points="256,128 384,256 256,384 128,256" fill="none" stroke="#10B981" stroke-width="10"/>
  <path d="M196 276 L256 216 L316 276" fill="none" stroke="#F5F5F0" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M196 324 L256 264 L316 324" fill="none" stroke="#10B981" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`;

const fullBleed = (scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" fill="#000000"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${crest}</g>
</svg>`;

const targets = [
  { file: 'public/apple-touch-icon.png', size: 180, svg: fullBleed(1) },
  { file: 'public/icon-192.png', size: 192, svg: fullBleed(1) },
  { file: 'public/icon-512.png', size: 512, svg: fullBleed(1) },
  // Maskable icons get cropped to a circle on Android: keep the crest inside the safe zone.
  { file: 'public/icon-maskable-512.png', size: 512, svg: fullBleed(0.82) },
];

const browser = await chromium.launch();
for (const { file, size, svg } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:#000">${svg}</body>`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log('wrote', file);
}
await browser.close();
