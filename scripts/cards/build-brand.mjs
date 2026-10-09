// Brand assets for Karte: the mark (two fanned cards with the heart and acorn from the Hungarian
// deck), favicon, app icons and the social share image. Needs Playwright's Chromium for the PNGs.
//
//   node scripts/cards/build-hungarian-deck.mjs   (first: the share image shows the deck)
//   node scripts/cards/build-brand.mjs
//
// The share image uses the brand fonts from Google Fonts. Offline, set BRAND_FONT_CSS to a local
// @font-face stylesheet; without either it falls back to system fonts.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYMBOLS = join(ROOT, 'scripts/cards/symbols');
const PUBLIC = join(ROOT, 'public');
const CARDS = join(ROOT, 'src/ui/decks/hungarian/cards');

const FELT = '#123d2f';
const FELT_DEEP = '#0c2a20';
const GOLD = '#e7b84b';
const FACE = '#fbfaf5';

/** A sheet symbol as a nested <svg>, so the mark needs no ids. */
function nested(name, cx, cy, size) {
  const svg = readFileSync(join(SYMBOLS, `${name}.svg`), 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>`;
}

/** The mark on a 64x64 grid. `bleed` fills the whole square (maskable and Apple icons, which get their own mask). */
function mark({ bleed = false } = {}) {
  const tile = bleed
    ? `<rect width="64" height="64" fill="${FELT}"/>`
    : `<rect width="64" height="64" rx="14" fill="${FELT}"/><rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-opacity="0.85"/>`;
  const scale = bleed ? 0.78 : 1;
  const cardStroke = `stroke="${FELT_DEEP}" stroke-width="1.4"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${tile}` +
    `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">` +
    `<g transform="rotate(-13 30 46)"><rect x="12" y="12" width="26" height="38" rx="4" fill="${FACE}" ${cardStroke}/>${nested('emblem-acorns', 25, 31, 20)}</g>` +
    `<g transform="rotate(11 34 46)"><rect x="27" y="13" width="26" height="38" rx="4" fill="${FACE}" ${cardStroke}/>${nested('emblem-hearts', 40, 32, 21)}</g>` +
    `</g></svg>\n`
  );
}

async function png(page, html, path, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete) && document.fonts.ready.then(() => true));
  await page.screenshot({ path, omitBackground: true });
}

const fullSize = (svg, w, h) => svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

function shareImage() {
  const fontCss = process.env.BRAND_FONT_CSS
    ? `<style>${readFileSync(process.env.BRAND_FONT_CSS, 'utf8')}</style>`
    : `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=DM+Sans:wght@500;700&display=swap">`;
  const fan = ['hearts-ace', 'leaves-ober', 'acorns-king', 'bells-unter']
    .map((name, i) => {
      const rot = -18 + i * 12;
      const x = i * 76;
      const y = Math.abs(i - 1.5) * 18;
      return `<img src="${dataUrl(readFileSync(join(CARDS, `${name}.svg`), 'utf8'))}" style="position:absolute;left:${x}px;top:${y}px;width:200px;transform:rotate(${rot}deg);transform-origin:50% 100%;filter:drop-shadow(0 10px 18px rgb(0 0 0 / .45))">`;
    })
    .join('');
  return `${fontCss}
<div style="width:1200px;height:630px;box-sizing:border-box;position:relative;overflow:hidden;background:radial-gradient(ellipse at 70% 40%, #1b5a45 0%, ${FELT} 55%, ${FELT_DEEP} 100%);font-family:'DM Sans',system-ui,sans-serif;color:#e8f0ea">
  <div style="position:absolute;inset:18px;border:2px solid ${GOLD};border-radius:28px;opacity:.55"></div>
  <div style="position:absolute;left:84px;top:150px;width:540px">
    <div style="display:flex;align-items:center;gap:22px">
      <img src="${dataUrl(mark())}" style="width:112px;height:112px">
      <span style="font-family:'Bricolage Grotesque','DM Sans',sans-serif;font-weight:800;font-size:116px;letter-spacing:-3px;line-height:1">Karte</span>
    </div>
    <div style="margin-top:34px;font-size:46px;font-weight:700;line-height:1.15">Bela u pregledniku</div>
    <div style="margin-top:14px;font-size:26px;font-weight:500;color:#b7ccc0;line-height:1.35">Protiv botova ili s prijateljima online.<br>Mađarice ili francuske karte.<br>Bez reklama.</div>
  </div>
  <div style="position:absolute;left:690px;top:150px;width:480px;height:420px">${fan}</div>
</div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(join(PUBLIC, 'icons'), { recursive: true });

writeFileSync(join(PUBLIC, 'favicon.svg'), mark());
for (const size of [192, 512]) await png(page, fullSize(mark(), size, size), join(PUBLIC, `icons/icon-${size}.png`), size, size);
await png(page, fullSize(mark({ bleed: true }), 512, 512), join(PUBLIC, 'icons/maskable-512.png'), 512, 512);
await png(page, fullSize(mark({ bleed: true }), 180, 180), join(PUBLIC, 'icons/apple-touch-icon.png'), 180, 180);
await png(page, fullSize(mark(), 32, 32), join(PUBLIC, 'icons/favicon-32.png'), 32, 32);
await png(page, shareImage(), join(PUBLIC, 'og-image.png'), 1200, 630);
await browser.close();
console.log('brand assets written to public/');
