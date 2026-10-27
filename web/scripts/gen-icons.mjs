// Renders the PWA icons from public/favicon.svg with the local Chromium.
// Run: NODE_PATH=$(npm root -g) npm run icons
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; it resolves from NODE_PATH or a global install.
const { chromium } = createRequire(import.meta.url)('playwright');

const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));
const svg = readFileSync(pub('favicon.svg'), 'utf8');
mkdirSync(pub('icons'), { recursive: true });

// Maskable icons need the artwork inside the central 80% safe zone and a full bleed.
const variants = [
  { file: 'icons/icon-192.png', size: 192, maskable: false },
  { file: 'icons/icon-512.png', size: 512, maskable: false },
  { file: 'icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'icons/apple-touch-icon.png', size: 180, maskable: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const v of variants) {
  const inner = v.maskable ? svg.replace('rx="112"', 'rx="0"').replace('<path', '<path transform="translate(51 51) scale(0.8)"') : svg;
  await page.setViewportSize({ width: v.size, height: v.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner.replace('<svg', `<svg width="${v.size}" height="${v.size}"`)}</body></html>`);
  await page.screenshot({ path: pub(v.file), omitBackground: !v.maskable });
  console.log('wrote', v.file);
}
await browser.close();
