// Run duplicate tournaments in parallel shards and summarise them.
// Usage: npx vite-node scripts/bots/tourney.ts <name> <hands|matches> <count> <A> <B> [<A> <B> ...]
// Results are appended to docs/bots/results/<name>.json.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { summarize, type HandRecord, type MatchRecord } from '../../src/games/bela/bots/arena';

const [name, mode, countS, ...pairs] = process.argv.slice(2);
const count = Number(countS);
const SHARDS = Math.max(1, cpus().length);
const SEED0 = Number(process.env.SEED0 ?? 1000);

function run(a: string, b: string, from: number, to: number, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['vite-node', 'scripts/bots/arena.ts', a, b, mode, String(from), String(to), out], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`shard failed: ${a} vs ${b}`))));
  });
}

async function matchup(a: string, b: string) {
  const dir = join(tmpdir(), `bela-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const per = Math.ceil(count / SHARDS);
  const jobs = [];
  for (let i = 0; i < SHARDS; i++) {
    const from = SEED0 + i * per;
    const to = Math.min(SEED0 + count, from + per);
    if (from < to) jobs.push(run(a, b, from, to, join(dir, `${i}.json`)));
  }
  await Promise.all(jobs);
  const records = jobs.flatMap((_, i) => JSON.parse(readFileSync(join(dir, `${i}.json`), 'utf8')).records);
  rmSync(dir, { recursive: true });
  const seconds = (Date.now() - t0) / 1000;
  let row: Record<string, unknown>;
  if (mode === 'hands') {
    const recs = records as HandRecord[];
    // Average each duplicate pair: the two halves share a deal.
    const bySeed = new Map<number, number[]>();
    for (const r of recs) bySeed.set(r.seed, [...(bySeed.get(r.seed) ?? []), r.diff]);
    const pairsMean = [...bySeed.values()].map((d) => (d[0] + d[1]) / 2);
    const s = summarize(pairsMean);
    const aCalls = recs.filter((r) => r.aCalled);
    const bCalls = recs.filter((r) => !r.aCalled);
    row = {
      a, b, mode, hands: recs.length, meanDiff: +s.mean.toFixed(2), se: +s.se.toFixed(2),
      aCallRate: +(aCalls.length / recs.length).toFixed(3),
      aFellRate: +(aCalls.filter((r) => r.callerFell).length / Math.max(1, aCalls.length)).toFixed(3),
      bFellRate: +(bCalls.filter((r) => r.callerFell).length / Math.max(1, bCalls.length)).toFixed(3),
      cardDiff: +summarize(recs.map((r) => r.cardDiff)).mean.toFixed(2),
      seconds,
    };
  } else {
    const recs = records as MatchRecord[];
    const wins = recs.filter((r) => r.aWon).length;
    const p = wins / recs.length;
    row = {
      a, b, mode, matches: recs.length, aWinRate: +p.toFixed(3), se: +Math.sqrt((p * (1 - p)) / recs.length).toFixed(3),
      avgHands: +(recs.reduce((x, r) => x + r.hands, 0) / recs.length).toFixed(1), seconds,
      results: recs.map((r) => (r.aWon ? 1 : 0)).join(''),
    };
  }
  console.log(JSON.stringify(row));
  return row;
}

const outDir = 'docs/bots/results';
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${name}.json`);
const all: unknown[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
for (let i = 0; i < pairs.length; i += 2) {
  all.push(await matchup(pairs[i], pairs[i + 1]));
  writeFileSync(file, JSON.stringify(all, null, 1) + '\n');
}
