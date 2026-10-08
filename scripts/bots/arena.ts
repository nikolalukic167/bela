// Bot-vs-bot duplicate tournament shard.
// Usage: npx vite-node scripts/bots/arena.ts <botA> <botB> <mode: hands|matches> <from> <to> [out.json]
import { writeFileSync } from 'node:fs';
import { makeBot } from '../../src/games/bela/bots';
import { duplicateHand, playMatch } from '../../src/games/bela/bots/arena';

const [aId, bId, mode, fromS, toS, out] = process.argv.slice(2);
const a = makeBot(aId);
const b = makeBot(bId);
const from = Number(fromS);
const to = Number(toS);
const records: unknown[] = [];
const t0 = Date.now();
for (let seed = from; seed < to; seed++) {
  if (mode === 'hands') records.push(...duplicateHand(a, b, seed));
  else records.push(playMatch(a, b, seed, seed % 2));
}
const result = { a: aId, b: bId, mode, from, to, ms: Date.now() - t0, records };
if (out) writeFileSync(out, JSON.stringify(result));
else console.log(JSON.stringify(result));
