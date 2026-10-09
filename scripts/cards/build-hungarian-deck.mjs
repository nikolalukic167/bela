// Builds the 32-card Hungarian-pattern deck (mađarice) used by the app.
//
//   node scripts/cards/build-hungarian-deck.mjs          SVGs for the app
//   node scripts/cards/build-hungarian-deck.mjs --png    also PNG exports and a deck sheet (needs Playwright's Chromium)
//
// Suit and numeral artwork comes from scripts/cards/symbols/ (see extract-symbols.mjs, public domain).
// Aces (the four seasons) and the court figures are original drawings defined below.
// Output:
//   src/ui/decks/hungarian/cards/<suit>-<rank>.svg   one file per card, loaded by the app as images
//   src/ui/decks/hungarian/emblems/<suit>.svg        small suit marks for text (trump tile, buttons)
//   docs/design/hungarian-deck/png/<suit>-<rank>.png 600x840 exports, plus deck.png (all 32)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYMBOLS = join(ROOT, 'scripts/cards/symbols');
const CARDS_OUT = join(ROOT, 'src/ui/decks/hungarian/cards');
const EMBLEMS_OUT = join(ROOT, 'src/ui/decks/hungarian/emblems');
const PNG_OUT = join(ROOT, 'docs/design/hungarian-deck');

export const SUITS = ['hearts', 'bells', 'acorns', 'leaves'];
export const RANKS = ['7', '8', '9', '10', 'unter', 'ober', 'king', 'ace'];

const W = 600;
const H = 840;
const FACE = '#fbfaf5';
const EDGE = '#c9c2b0';
const LINE = '#1d1a16';
const SERIF = "Georgia, 'Times New Roman', serif";
const SKIN = '#f1c79c';

/** Per-suit colours: ink for indices and frames, clothing colours for the court figures. */
const PALETTE = {
  hearts: { ink: '#b8322a', main: '#c23a2e', dark: '#7d1f18', accent: '#e7b84b', tint: '#f7e4df', hose: '#e8d9b0' },
  bells: { ink: '#a8680f', main: '#d9a21b', dark: '#8a5a0b', accent: '#c23a2e', tint: '#f8eed4', hose: '#2f5d8a' },
  acorns: { ink: '#6b4a1e', main: '#8a5a2b', dark: '#4d3215', accent: '#e7b84b', tint: '#efe5d8', hose: '#c23a2e' },
  leaves: { ink: '#2a6e38', main: '#2f7d3f', dark: '#1c4d26', accent: '#e7b84b', tint: '#e2efdf', hose: '#e8d9b0' },
};

const INDEX = { '7': '7', '8': '8', '9': '9', '10': '10', unter: 'U', ober: 'O', king: 'K', ace: 'A' };

// ---------- symbols ----------

function loadSymbol(name) {
  const svg = readFileSync(join(SYMBOLS, `${name}.svg`), 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const defs = svg.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? '';
  const markup = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<defs>[\s\S]*?<\/defs>/, '');
  const [, , w, h] = viewBox.split(' ').map(Number);
  return { name, viewBox, defs, markup, ratio: w / h };
}

/** A sheet symbol, made available in this card as <use href="#id">. */
function symbolDef(sym, id) {
  return `${sym.defs}<symbol id="${id}" viewBox="${sym.viewBox}">${sym.markup}</symbol>`;
}

/** Places a symbol centred on (cx, cy), fitting inside a size x size box. */
function place(sym, id, cx, cy, size, extra = '') {
  const w = sym.ratio >= 1 ? size : size * sym.ratio;
  const h = sym.ratio >= 1 ? size / sym.ratio : size;
  return `<use href="#${id}" x="${r(cx - w / 2)}" y="${r(cy - h / 2)}" width="${r(w)}" height="${r(h)}"${extra}/>`;
}

const r = (n) => +n.toFixed(1);

// ---------- card chrome ----------

function card(body, defs = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${defs}</defs>` +
    `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="40" fill="${FACE}" stroke="${EDGE}" stroke-width="5"/>` +
    body +
    `</svg>\n`
  );
}

function frame(p) {
  return `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="24" fill="none" stroke="${p.ink}" stroke-width="3" stroke-opacity="0.6"/>`;
}

/**
 * Rank and suit top-left and bottom-right, readable in a fanned hand. Both stay upright, like the rest of
 * a Hungarian card (figures and pips are not mirrored), so a 9 never reads as a 6.
 */
function corners(rank, p, plate = false) {
  const label = INDEX[rank];
  const text = (x, y) =>
    `<text x="${x}" y="${y}" font-family="${SERIF}" font-weight="700" font-size="${label.length > 1 ? 74 : 88}" text-anchor="middle" fill="${p.ink}"${label.length > 1 ? ' letter-spacing="-6"' : ''}>${label}</text>`;
  const backing = (x, y) => (plate ? `<rect x="${x}" y="${y}" width="96" height="176" rx="18" fill="${FACE}" fill-opacity="0.94"/>` : '');
  return (
    backing(32, 32) +
    text(80, 112) +
    `<use href="#emblem" x="50" y="128" width="60" height="64"/>` +
    backing(W - 128, H - 208) +
    `<use href="#emblem" x="${W - 110}" y="${H - 196}" width="60" height="64"/>` +
    text(W - 80, H - 52)
  );
}

// ---------- numeral cards ----------

const C = 300;
const L = 185;
const R = 415;
/** Pip centres and size per rank: two columns plus centre pips, all upright as on Hungarian cards. */
const PIPS = {
  '7': { size: 110, at: [[L, 255], [L, 420], [L, 585], [R, 255], [R, 420], [R, 585], [C, 337]] },
  '8': { size: 110, at: [[L, 255], [L, 420], [L, 585], [R, 255], [R, 420], [R, 585], [C, 337], [C, 503]] },
  '9': { size: 100, at: [[L, 230], [L, 360], [L, 490], [L, 620], [R, 230], [R, 360], [R, 490], [R, 620], [C, 425]] },
  '10': { size: 100, at: [[L, 230], [L, 360], [L, 490], [L, 620], [R, 230], [R, 360], [R, 490], [R, 620], [C, 295], [C, 555]] },
};

function numeralCard(suit, rank, sym) {
  const p = PALETTE[suit];
  const { size, at } = PIPS[rank];
  const numeral = sym.numerals[rank];
  const cartouche =
    `<rect x="215" y="42" width="170" height="84" rx="14" fill="${FACE}" stroke="${p.ink}" stroke-width="2.5" stroke-opacity="0.7"/>` +
    place(numeral, 'numeral', C, 84, 140 > 56 * numeral.ratio ? 56 * numeral.ratio : 140);
  const body =
    `<rect x="112" y="146" width="376" height="548" rx="26" fill="${p.tint}"/>` +
    frame(p) +
    // Only at the top: pips and figures are upright (not reversible), as on Hungarian cards.
    cartouche +
    at.map(([x, y]) => place(sym.pip, 'pip', x, y, size)).join('') +
    corners(rank, p);
  return card(body, symbolDef(sym.pip, 'pip') + symbolDef(sym.emblem, 'emblem') + symbolDef(numeral, 'numeral'));
}

// ---------- season aces ----------

const SEASON = { hearts: 'spring', leaves: 'summer', acorns: 'autumn', bells: 'winter' };

function tulip(x, y, s, petal) {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path d="M0 0 C-2 -30 2 -60 0 -90" fill="none" stroke="#3d7a2e" stroke-width="5"/>` +
    `<path d="M0 -20 C-30 -30 -42 -60 -38 -78 C-20 -60 -6 -44 0 -20Z" fill="#5d9e3f"/>` +
    `<path d="M0 -36 C26 -44 36 -70 32 -86 C16 -70 4 -58 0 -36Z" fill="#5d9e3f"/>` +
    `<path d="M-24 -120 C-26 -100 -18 -86 0 -86 C18 -86 26 -100 24 -120 C16 -110 10 -108 6 -112 C4 -124 0 -132 0 -132 C0 -132 -4 -124 -6 -112 C-10 -108 -16 -110 -24 -120Z" fill="${petal}"/>` +
    `</g>`
  );
}

function blossom(x, y, s, color) {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="-11" rx="8" ry="11" transform="rotate(${a})" fill="${color}" stroke="${LINE}" stroke-width="1.5"/>`)
    .join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">${petals}<circle r="5" fill="#e7b84b" stroke="${LINE}" stroke-width="1.5"/></g>`;
}

function wheat(x, y, s, lean) {
  const grains = [];
  for (let i = 0; i < 6; i++) {
    const gy = -100 - i * 16;
    grains.push(`<ellipse cx="-8" cy="${gy}" rx="6" ry="11" transform="rotate(-28 -8 ${gy})" fill="#e3b341"/>`);
    grains.push(`<ellipse cx="8" cy="${gy}" rx="6" ry="11" transform="rotate(28 8 ${gy})" fill="#e3b341"/>`);
  }
  return (
    `<g transform="translate(${x} ${y}) rotate(${lean}) scale(${s})" stroke="${LINE}" stroke-width="1.8">` +
    `<path d="M0 0 V-196" stroke="#b88a22" stroke-width="4" fill="none"/>${grains.join('')}<ellipse cx="0" cy="-200" rx="6" ry="12" fill="#e3b341"/>` +
    `</g>`
  );
}

function fallingLeaf(x, y, s, angle, color) {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${s})" stroke="${LINE}" stroke-width="2">` +
    `<path d="M0 -26 C16 -16 18 6 0 26 C-18 6 -16 -16 0 -26Z" fill="${color}"/><path d="M0 -20 V30" fill="none"/>` +
    `</g>`
  );
}

function snowflake(x, y, s) {
  const arms = [0, 60, 120]
    .map((a) => `<path d="M0 -20 V20 M-6 -14 L0 -8 L6 -14 M-6 14 L0 8 L6 14" transform="rotate(${a})"/>`)
    .join('');
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="#6f97c2" stroke-width="2.6" stroke-linecap="round" fill="none">${arms}</g>`;
}

function fir(x, y, s) {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<rect x="-7" y="-14" width="14" height="22" fill="#6b4a1e"/>` +
    `<path d="M0 -150 L-46 -70 H46Z M0 -110 L-56 -14 H56Z" fill="#2c5e3a"/>` +
    `<path d="M0 -150 L-18 -118 Q0 -110 18 -118Z M-34 -46 Q0 -30 34 -46 L46 -24 Q0 -6 -46 -24Z" fill="#fff"/>` +
    `</g>`
  );
}

function sky(top, bottom) {
  return (
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
    `<clipPath id="panel"><rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="24"/></clipPath>`
  );
}

const SCENES = {
  spring: {
    sky: sky('#cfe7f6', '#f3f8ea'),
    back:
      `<path d="M26 650 Q170 560 320 630 Q450 690 574 610 V814 H26Z" fill="#9fcf7c"/>` +
      `<path d="M26 720 Q200 650 360 712 Q470 752 574 700 V814 H26Z" fill="#78b356"/>` +
      `<path d="M170 140 q12 -12 24 0 q12 -12 24 0 M228 108 q10 -10 20 0 q10 -10 20 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>` +
      blossom(470, 110, 1.4, '#f6c6d4') + blossom(520, 170, 1.1, '#fff') + blossom(462, 200, 0.9, '#f6c6d4'),
    front: tulip(86, 800, 0.95, '#c23a2e') + tulip(150, 806, 0.75, '#e7b84b') + tulip(396, 806, 0.75, '#e7b84b') + tulip(448, 800, 0.95, '#c23a2e'),
  },
  summer: {
    sky: sky('#ffe08f', '#fff6dc'),
    back:
      Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        const pt = (rad, d) => `${r(300 + Math.cos(a + d) * rad)} ${r(410 + Math.sin(a + d) * rad)}`;
        return `<path d="M${pt(170, -0.09)} L${pt(300, 0)} L${pt(170, 0.09)}Z" fill="#f1b73f" fill-opacity="0.55"/>`;
      }).join('') +
      `<path d="M26 690 Q300 640 574 690 V814 H26Z" fill="#e9c35b"/><path d="M26 740 Q300 700 574 740 V814 H26Z" fill="#d6a637"/>`,
    front: wheat(80, 800, 1.05, -8) + wheat(112, 806, 0.9, 4) + wheat(410, 806, 0.9, -4) + wheat(446, 800, 1.05, 8),
  },
  autumn: {
    sky: sky('#f5cfa4', '#fdf0df'),
    back:
      `<path d="M26 700 Q300 650 574 700 V814 H26Z" fill="#c08a4c"/><path d="M26 752 Q300 712 574 752 V814 H26Z" fill="#9c6b37"/>` +
      fallingLeaf(470, 110, 1.3, 30, '#d9682b') + fallingLeaf(530, 220, 1.1, -40, '#c23a2e') + fallingLeaf(84, 300, 1.2, 60, '#e7a33b') +
      fallingLeaf(520, 540, 1.1, 10, '#8a5a2b') + fallingLeaf(150, 250, 0.9, -20, '#c23a2e'),
    front:
      `<g stroke="${LINE}" stroke-width="2">` +
      [[96, 724], [124, 724], [152, 724], [110, 750], [138, 750], [124, 776]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#6d3b7a"/>`).join('') +
      `<path d="M124 708 C124 690 132 680 140 676" fill="none" stroke="#5a3a18" stroke-width="4"/><path d="M134 690 C160 676 176 690 176 700 C160 704 146 700 134 690Z" fill="#7a9a3a"/>` +
      `</g>` +
      `<g stroke="${LINE}" stroke-width="2.5"><ellipse cx="410" cy="764" rx="54" ry="38" fill="#e07b2a"/><path d="M390 730 Q410 790 390 800 M430 730 Q410 790 430 800" fill="none" stroke-opacity="0.5"/><path d="M410 728 q4 -18 16 -22" fill="none" stroke="#5a3a18" stroke-width="5"/></g>`,
  },
  winter: {
    sky: sky('#c4d8ee', '#eef4fa'),
    back:
      `<path d="M26 680 Q180 610 330 670 Q460 720 574 660 V814 H26Z" fill="#fff" stroke="#c8d8ea" stroke-width="3"/>` +
      `<path d="M26 750 Q220 700 380 744 Q480 772 574 736 V814 H26Z" fill="#e3edf7"/>` +
      snowflake(470, 110, 1.4) + snowflake(536, 190, 0.9) + snowflake(160, 140, 0.8) + snowflake(78, 320, 1) + snowflake(526, 440, 1.1) + snowflake(72, 560, 0.8),
    front: fir(94, 790, 1) + fir(152, 800, 0.7) + fir(440, 790, 1),
  },
};

function aceCard(suit, sym) {
  const p = PALETTE[suit];
  const scene = SCENES[SEASON[suit]];
  const body =
    `<g clip-path="url(#panel)"><rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="url(#sky)"/>${scene.back}</g>` +
    `<circle cx="300" cy="410" r="172" fill="${FACE}" stroke="${p.ink}" stroke-width="5"/>` +
    `<circle cx="300" cy="410" r="156" fill="none" stroke="${p.ink}" stroke-width="2" stroke-opacity="0.5"/>` +
    place(sym.pip, 'pip', 300, 410, 236) +
    `<g clip-path="url(#panel)">${scene.front}</g>` +
    frame(p) +
    corners('ace', p, true);
  return card(body, scene.sky + symbolDef(sym.pip, 'pip') + symbolDef(sym.emblem, 'emblem'));
}

// ---------- court figures (original drawings) ----------

const st = `stroke="${LINE}" stroke-width="4" stroke-linejoin="round"`;

function face({ beard = false, mustache = false, hair = '#5a3a1e' }) {
  return (
    `<rect x="284" y="282" width="32" height="46" fill="${SKIN}" ${st}/>` +
    `<circle cx="300" cy="248" r="46" fill="${SKIN}" ${st}/>` +
    `<path d="M256 236 Q258 204 300 200 Q342 204 344 236 Q336 222 300 220 Q264 222 256 236Z" fill="${hair}" ${st}/>` +
    `<circle cx="283" cy="248" r="4.5" fill="${LINE}"/><circle cx="317" cy="248" r="4.5" fill="${LINE}"/>` +
    `<path d="M276 236 q7 -5 14 0 M310 236 q7 -5 14 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M300 252 q-6 13 3 15" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="273" cy="266" r="8" fill="#e8907a" fill-opacity="0.35"/><circle cx="327" cy="266" r="8" fill="#e8907a" fill-opacity="0.35"/>` +
    (beard
      ? `<path d="M256 254 Q256 320 300 336 Q344 320 344 254 Q336 284 300 286 Q264 284 256 254Z" fill="${hair}" ${st}/>`
      : `<path d="M289 280 q11 7 22 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`) +
    (mustache || beard ? `<path d="M278 276 Q300 262 322 276 Q312 284 300 278 Q288 284 278 276Z" fill="${hair}" ${st}/>` : '')
  );
}

function hand(x, y) {
  return `<circle cx="${x}" cy="${y}" r="17" fill="${SKIN}" ${st}/>`;
}

function legs(p, bootTop) {
  return (
    `<path d="M262 600 L258 ${bootTop + 6} H294 L298 600Z" fill="${p.hose}" ${st}/>` +
    `<path d="M302 600 L306 ${bootTop + 6} H342 L338 600Z" fill="${p.hose}" ${st}/>` +
    `<path d="M252 ${bootTop} H298 V760 H240 Q236 744 252 738Z" fill="#3a2a1c" ${st}/>` +
    `<path d="M302 ${bootTop} H348 V738 Q364 744 360 760 H302Z" fill="#3a2a1c" ${st}/>`
  );
}

function unter(p, sym) {
  return (
    legs(p, 726) +
    `<path d="M240 334 Q300 316 360 334 L392 610 Q300 634 208 610Z" fill="${p.main}" ${st}/>` +
    `<path d="M212 584 Q300 606 388 584 L392 610 Q300 634 208 610Z" fill="${p.accent}" ${st}/>` +
    `<path d="M300 344 V600" stroke="${LINE}" stroke-width="3"/>` +
    [384, 424, 552].map((y) => `<circle cx="300" cy="${y}" r="6" fill="${p.accent}" stroke="${LINE}" stroke-width="2.5"/>`).join('') +
    `<path d="M228 466 Q300 484 372 466 L376 494 Q300 512 224 494Z" fill="${p.dark}" ${st}/>` +
    `<rect x="286" y="474" width="28" height="28" rx="4" fill="${p.accent}" ${st}/>` +
    `<path d="M242 338 Q206 352 200 420 L192 512 L226 516 L236 430Z" fill="${p.main}" ${st}/>` +
    `<path d="M358 338 Q394 352 400 420 L410 512 L376 516 L366 430Z" fill="${p.main}" ${st}/>` +
    `<path d="M190 500 H228 L226 518 H192Z M372 500 H410 L412 518 H374Z" fill="${p.accent}" ${st}/>` +
    hand(208, 534) +
    hand(394, 534) +
    `<path d="M262 328 Q300 362 338 328 L330 316 Q300 340 270 316Z" fill="#fff" ${st}/>` +
    face({ hair: '#6b4320' }) +
    `<path d="M246 226 Q248 176 300 172 Q354 176 356 224 Q300 206 246 226Z" fill="${p.dark}" ${st}/>` +
    `<path d="M244 226 Q300 204 358 226 L356 242 Q300 222 246 242Z" fill="${p.accent}" ${st}/>` +
    `<path d="M336 196 C356 150 392 132 410 126 C398 150 376 178 344 204Z" fill="#fff" ${st}/>` +
    place(sym.emblem, 'emblem', 404, 600, 120)
  );
}

function ober(p, sym) {
  return (
    legs(p, 690) +
    `<path d="M236 334 Q300 314 364 334 L398 640 Q300 664 202 640Z" fill="${p.dark}" ${st}/>` +
    `<path d="M274 340 H326 L332 640 Q300 646 268 640Z" fill="${p.main}" ${st}/>` +
    [380, 412, 444, 476, 508].map((y) => `<path d="M268 ${y} H332" stroke="${p.accent}" stroke-width="6" stroke-linecap="round"/><circle cx="268" cy="${y}" r="5" fill="${p.accent}" stroke="${LINE}" stroke-width="2"/><circle cx="332" cy="${y}" r="5" fill="${p.accent}" stroke="${LINE}" stroke-width="2"/>`).join('') +
    `<path d="M222 540 Q300 560 378 540 L382 566 Q300 588 218 566Z" fill="${p.accent}" ${st}/>` +
    `<path d="M240 338 Q204 352 198 420 L190 512 L224 516 L234 430Z" fill="${p.dark}" ${st}/>` +
    `<path d="M188 498 H226 L224 518 H190Z" fill="${p.accent}" ${st}/>` +
    hand(206, 534) +
    `<path d="M352 342 Q378 324 390 312 L424 214 L394 202 L360 300Z" fill="${p.dark}" ${st}/>` +
    `<path d="M392 200 L426 212 L422 228 L388 216Z" fill="${p.accent}" ${st}/>` +
    hand(410, 196) +
    `<path d="M262 328 Q300 360 338 328 L330 316 Q300 338 270 316Z" fill="${p.accent}" ${st}/>` +
    face({ mustache: true, hair: '#4a3520' }) +
    `<path d="M254 222 L262 158 Q300 144 338 158 L346 222 Q300 208 254 222Z" fill="${p.dark}" ${st}/>` +
    `<path d="M252 222 Q300 206 348 222 L346 238 Q300 222 254 238Z" fill="${p.accent}" ${st}/>` +
    `<path d="M322 160 C318 120 292 96 266 86 C276 110 290 140 306 162Z" fill="#fff" ${st}/>` +
    place(sym.emblem, 'emblem', 418, 112, 132)
  );
}

function king(p, sym) {
  const spots = [[296, 420], [304, 500], [294, 580], [306, 660], [298, 730], [270, 368], [330, 368]]
    .map(([x, y]) => `<path d="M${x} ${y} l-4 12 h8z" fill="${LINE}"/>`)
    .join('');
  return (
    `<path d="M228 338 Q300 316 372 338 L424 762 Q300 786 176 762Z" fill="${p.main}" ${st}/>` +
    `<path d="M280 344 H320 L334 770 Q300 774 266 770Z" fill="#fffaf0" ${st}/>` +
    `<path d="M236 334 Q300 382 364 334 Q374 362 362 376 Q300 414 238 376 Q226 362 236 334Z" fill="#fffaf0" ${st}/>` +
    spots +
    `<path d="M238 344 Q206 360 200 430 L196 480 L232 484 L240 430Z" fill="${p.dark}" ${st}/>` +
    `<path d="M362 344 Q394 360 400 430 L404 470 L368 476 L360 430Z" fill="${p.dark}" ${st}/>` +
    `<path d="M210 248 L222 650" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/><path d="M210 248 L222 650" stroke="${LINE}" stroke-width="2" stroke-opacity="0.5"/>` +
    `<circle cx="209" cy="236" r="16" fill="${p.accent}" ${st}/><path d="M209 206 V222 M197 214 H221" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>` +
    hand(214, 488) +
    place(sym.emblem, 'emblem', 398, 420, 116) +
    hand(388, 482) +
    face({ beard: true, hair: '#8a7a66' }) +
    `<path d="M252 214 L252 158 L276 184 L300 146 L324 184 L348 158 L348 214Z" fill="#e7b84b" ${st}/>` +
    `<rect x="250" y="206" width="100" height="22" rx="4" fill="#d9a21b" ${st}/>` +
    `<circle cx="276" cy="217" r="6" fill="#c23a2e" stroke="${LINE}" stroke-width="2"/><circle cx="300" cy="217" r="6" fill="#2f5d8a" stroke="${LINE}" stroke-width="2"/><circle cx="324" cy="217" r="6" fill="#c23a2e" stroke="${LINE}" stroke-width="2"/>` +
    `<circle cx="252" cy="158" r="6" fill="#fff" stroke="${LINE}" stroke-width="2"/><circle cx="300" cy="146" r="6" fill="#fff" stroke="${LINE}" stroke-width="2"/><circle cx="348" cy="158" r="6" fill="#fff" stroke="${LINE}" stroke-width="2"/>`
  );
}

const FIGURE = { unter, ober, king };

function courtCard(suit, rank, sym) {
  const p = PALETTE[suit];
  const body =
    `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="24" fill="${p.tint}"/>` +
    `<path d="M136 790 V300 A164 164 0 0 1 464 300 V790Z" fill="${FACE}" fill-opacity="0.7"/>` +
    `<path d="M26 760 H574 V790 Q574 814 550 814 H50 Q26 814 26 790Z" fill="${p.ink}" fill-opacity="0.12"/>` +
    `<ellipse cx="300" cy="768" rx="138" ry="14" fill="#000" fill-opacity="0.12"/>` +
    FIGURE[rank](p, sym) +
    frame(p) +
    corners(rank, p);
  return card(body, symbolDef(sym.emblem, 'emblem'));
}

// ---------- emblems for text ----------

function emblemFile(sym) {
  // Square canvas so every suit sits on the same baseline next to text.
  const [x, y, w, h] = sym.viewBox.split(' ').map(Number);
  const side = Math.max(w, h);
  const vb = [x - (side - w) / 2, y - (side - h) / 2, side, side].map((n) => +n.toFixed(2)).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${sym.defs ? `<defs>${sym.defs}</defs>` : ''}${sym.markup}</svg>\n`;
}

// ---------- build ----------

export function buildDeck() {
  const numerals = Object.fromEntries(['7', '8', '9', '10'].map((n) => [n, loadSymbol(`numeral-${n}`)]));
  const files = {};
  const emblems = {};
  for (const suit of SUITS) {
    const sym = { pip: loadSymbol(`pip-${suit}`), emblem: loadSymbol(`emblem-${suit}`), numerals };
    emblems[suit] = emblemFile(sym.emblem);
    for (const rank of RANKS) {
      files[`${suit}-${rank}`] =
        rank in PIPS ? numeralCard(suit, rank, sym) : rank === 'ace' ? aceCard(suit, sym) : courtCard(suit, rank, sym);
    }
  }
  return { files, emblems };
}

async function exportPngs(files) {
  const { chromium } = await import('@playwright/test');
  mkdirSync(join(PNG_OUT, 'png'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [name, svg] of Object.entries(files)) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator('svg').first().screenshot({ path: join(PNG_OUT, 'png', `${name}.png`), omitBackground: true });
  }
  // Deck sheet: one row per suit, on table felt.
  const cw = 150;
  const gap = 14;
  const sheetW = 8 * cw + 9 * gap;
  const sheetH = 4 * (cw * 1.4) + 5 * gap;
  await page.setViewportSize({ width: sheetW, height: sheetH });
  // Each card as its own image: inline SVGs on one page would share their symbol ids.
  const cells = SUITS.flatMap((s) =>
    RANKS.map((rk) => `<img width="${cw}" height="${cw * 1.4}" src="data:image/svg+xml;base64,${Buffer.from(files[`${s}-${rk}`]).toString('base64')}">`),
  );
  await page.setContent(
    `<html><body style="margin:0;background:#123d2f"><div style="display:grid;grid-template-columns:repeat(8,${cw}px);gap:${gap}px;padding:${gap}px">${cells.join('')}</div></body></html>`,
  );
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: join(PNG_OUT, 'deck.png') });
  await browser.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { files, emblems } = buildDeck();
  mkdirSync(CARDS_OUT, { recursive: true });
  mkdirSync(EMBLEMS_OUT, { recursive: true });
  let total = 0;
  for (const [name, svg] of Object.entries(files)) {
    writeFileSync(join(CARDS_OUT, `${name}.svg`), svg);
    total += svg.length;
  }
  for (const [suit, svg] of Object.entries(emblems)) writeFileSync(join(EMBLEMS_OUT, `${suit}.svg`), svg);
  console.log(`${Object.keys(files).length} cards, ${(total / 1024).toFixed(0)} KB of SVG`);
  if (process.argv.includes('--png')) {
    await exportPngs(files);
    console.log(`PNGs in ${PNG_OUT}`);
  }
}
