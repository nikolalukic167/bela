// One-off: pulls the suit and numeral artwork we use out of Gabor (razr)'s public-domain Inkscape
// symbol set "Hungarian cards symbols" (https://inkscape.org/~razr/%E2%98%85hungarian-cards-symbols)
// into small standalone SVGs under scripts/cards/symbols/. The full sheet (1.9 MB) is not committed.
//
// Usage: node scripts/cards/extract-symbols.mjs "<path to Hungarian cards symbols.svg>"
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'symbols');

/** Sheet symbol id → file name. Upright variants for pips and aces, the plainer ones for small emblems. */
const PICK = {
  'Heart 5 Color': 'pip-hearts',
  'Bell 4 Color': 'pip-bells',
  'Acorn 4 Color': 'pip-acorns',
  'Green 4 Color': 'pip-leaves',
  'Heart 6 Color': 'emblem-hearts',
  'Bell 5 Color': 'emblem-bells',
  'Acorn 6 Color': 'emblem-acorns',
  'Green 5 Color': 'emblem-leaves',
  'Number 7': 'numeral-7',
  'Number 8': 'numeral-8',
  'Number 9': 'numeral-9',
  'Number 10': 'numeral-10',
};

const sheet = process.argv[2];
if (!sheet) throw new Error('Pass the path to "Hungarian cards symbols.svg".');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<html><body>${readFileSync(sheet, 'utf8')}</body></html>`);
const symbols = await page.evaluate((pick) => {
  const NOISE = /^(inkscape|sodipodi):|^id$/;
  // Style properties that only restate SVG defaults.
  const DEFAULTS = new Set([
    'fill-opacity:1', 'stroke-opacity:1', 'stroke-linecap:butt', 'stroke-linejoin:miter', 'stroke-miterlimit:4',
    'stroke-dasharray:none', 'opacity:1', 'stroke:none', 'paint-order:normal', 'stroke-dashoffset:0',
  ]);
  const round = (s, digits) => s.replace(/-?\d*\.\d+(e-?\d+)?/g, (n) => String(+(+n).toFixed(digits)));
  const svg = document.querySelector('svg');
  const out = {};
  for (const [id, name] of Object.entries(pick)) {
    const symbol = [...svg.querySelectorAll('symbol')].find((s) => s.id === id);
    if (!symbol) throw new Error(`missing symbol ${id}`);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const c of symbol.children) g.appendChild(c.cloneNode(true));
    svg.appendChild(g);
    const bb = g.getBBox();
    g.remove();
    const gradients = new Map();
    const clean = (el) => {
      for (const a of [...el.attributes]) if (NOISE.test(a.name)) el.removeAttribute(a.name);
      const style = el.getAttribute('style');
      if (style) {
        const kept = style.split(';').map((s) => s.trim()).filter((s) => s && !DEFAULTS.has(s));
        if (kept.length) el.setAttribute('style', kept.join(';'));
        else el.removeAttribute('style');
      }
      if (el.hasAttribute('d')) el.setAttribute('d', round(el.getAttribute('d'), 2));
      if (el.hasAttribute('transform')) el.setAttribute('transform', round(el.getAttribute('transform'), 5));
      for (const ref of (el.getAttribute('style') ?? '').matchAll(/url\(#([^)]+)\)/g)) gradients.set(ref[1], null);
      for (const c of el.children) clean(c);
    };
    const body = [...symbol.children].map((c) => c.cloneNode(true));
    body.forEach(clean);
    // Gradients, following xlink:href chains; ids get the file name as prefix so symbols can share a card.
    const defs = [];
    for (let i = 0; i < 10; i++) {
      for (const gid of gradients.keys()) {
        if (gradients.get(gid)) continue;
        const grad = svg.querySelector(`[id="${gid}"]`).cloneNode(true);
        const parent = grad.getAttribute('xlink:href');
        if (parent) gradients.set(parent.slice(1), null);
        gradients.set(gid, grad);
      }
    }
    for (const [gid, grad] of gradients) {
      const copy = grad.cloneNode(true);
      for (const a of [...copy.attributes]) if (/^(inkscape|sodipodi):/.test(a.name)) copy.removeAttribute(a.name);
      copy.setAttribute('id', `${name}-${gid}`);
      const parent = copy.getAttribute('xlink:href');
      if (parent) {
        copy.removeAttribute('xlink:href');
        copy.setAttribute('href', `#${name}-${parent.slice(1)}`);
      }
      if (copy.hasAttribute('gradientTransform')) copy.setAttribute('gradientTransform', round(copy.getAttribute('gradientTransform'), 5));
      for (const s of copy.querySelectorAll('stop')) s.removeAttribute('id');
      defs.push(copy.outerHTML);
    }
    let markup = body.map((c) => c.outerHTML).join('');
    for (const gid of gradients.keys()) markup = markup.replaceAll(`url(#${gid})`, `url(#${name}-${gid})`);
    const pad = 0.4;
    out[name] = {
      viewBox: [bb.x - pad, bb.y - pad, bb.width + 2 * pad, bb.height + 2 * pad].map((v) => +v.toFixed(2)).join(' '),
      defs: defs.join(''),
      markup: markup.replace(/ xmlns(:\w+)?="[^"]*"/g, ''),
    };
  }
  return out;
}, PICK);
await browser.close();

mkdirSync(OUT, { recursive: true });
for (const [name, { viewBox, defs, markup }] of Object.entries(symbols)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs ? `<defs>${defs}</defs>` : ''}${markup}</svg>\n`;
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(name, `${(svg.length / 1024).toFixed(1)} KB`);
}
