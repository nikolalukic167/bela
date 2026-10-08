// OpenSkill ladder from match results (docs/bots/results/*.json, mode "matches").
// Each bot is rated as one player; a match is a 1v1 between the two partnerships.
// Usage: npx vite-node scripts/bots/rate.ts <results.json> [...]
import { readFileSync } from 'node:fs';
import { ordinal, rate, rating, type Rating } from 'openskill';
import { createRng, type Rng } from '../../src/core/rng';

interface Row {
  a: string;
  b: string;
  mode: string;
  results?: string;
}

const games: [string, string, boolean][] = [];
for (const f of process.argv.slice(2)) {
  for (const r of JSON.parse(readFileSync(f, 'utf8')) as Row[]) {
    if (r.mode !== 'matches' || !r.results) continue;
    for (const ch of r.results) games.push([r.a, r.b, ch === '1']);
  }
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Order matters for online ratings; average ordinals over several random orders.
const RUNS = 20;
const totals = new Map<string, { mu: number; sigma: number; ord: number }>();
for (let run = 0; run < RUNS; run++) {
  const ratings = new Map<string, Rating>();
  const get = (id: string) => ratings.get(id) ?? rating();
  for (const [a, b, aWon] of shuffle(games, createRng(run + 1))) {
    const [[ra], [rb]] = rate([[get(a)], [get(b)]], { rank: aWon ? [1, 2] : [2, 1] });
    ratings.set(a, ra);
    ratings.set(b, rb);
  }
  for (const [id, r] of ratings) {
    const t = totals.get(id) ?? { mu: 0, sigma: 0, ord: 0 };
    totals.set(id, { mu: t.mu + r.mu / RUNS, sigma: t.sigma + r.sigma / RUNS, ord: t.ord + ordinal(r) / RUNS });
  }
}
const rows = [...totals].sort((x, y) => y[1].ord - x[1].ord);
console.log(`${games.length} matches\n`);
console.log('| Bot | μ | σ | ordinal (μ − 3σ) |\n|---|---:|---:|---:|');
for (const [id, t] of rows) console.log(`| \`${id}\` | ${t.mu.toFixed(1)} | ${t.sigma.toFixed(2)} | ${t.ord.toFixed(1)} |`);
