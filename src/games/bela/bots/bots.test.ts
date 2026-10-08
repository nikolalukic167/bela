import { describe, expect, it } from 'vitest';
import { createRng } from '../../../core/rng';
import { apply, autoAction, currentPlayer, setup } from '../engine';
import type { BelaState } from '../state';
import { OPTIONS } from '../testkit';
import { viewFor } from '../view';
import { ARENA_OPTIONS, duplicateHand, playHand } from './arena';
import { beatsIdx, legalMask, maskOf, popcount } from './fast';
import { BOT_LEVELS, levelBot, makeBot, type Bot } from './index';
import { infer } from './knowledge';
import { sampleDeal } from './sampler';
import { Solver, cloneWorld, type World } from './solver';
import { worldFromState } from './world';

/** Every play decision of `hands` heuristic-bot hands. */
function* decisions(hands: number): Generator<BelaState> {
  const bot = makeBot('heuristic');
  for (let seed = 1; seed <= hands; seed++) {
    let s = setup({ ...OPTIONS, direction: seed % 2 ? 'ccw' : 'cw' }, seed);
    while (s.phase !== 'handOver' && s.phase !== 'matchOver') {
      const auto = autoAction(s);
      if (auto) {
        s = apply(s, auto);
        continue;
      }
      if (s.phase === 'play') yield s;
      const seat = currentPlayer(s) as number;
      s = apply(s, bot(viewFor(s, seat), createRng(seed)));
    }
  }
}

describe('card tracking (Level 2)', () => {
  it('never rules out the true holder of a card, and only claims cards it really holds', () => {
    let checked = 0;
    for (const s of decisions(60)) {
      const k = infer(viewFor(s, s.turn));
      for (let p = 0; p < 4; p++) {
        const truth = maskOf(s.hands[p]);
        expect(truth & ~k.canHold[p]).toBe(0);
        expect(k.mustHold[p] & ~truth).toBe(0);
        expect(k.counts[p]).toBe(s.hands[p].length);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('learns voids from a seat that did not follow suit', () => {
    let voids = 0;
    for (const s of decisions(30)) {
      const k = infer(viewFor(s, s.turn));
      for (let p = 0; p < 4; p++) if (p !== s.turn) voids += popcount(k.unseen & ~k.canHold[p]);
    }
    expect(voids).toBeGreaterThan(0);
  });
});

describe('deal sampling', () => {
  it('deals every unseen card exactly once, within what each seat can hold', () => {
    const rng = createRng(3);
    for (const s of decisions(20)) {
      const k = infer(viewFor(s, s.turn));
      const hands = sampleDeal(k, rng);
      expect(hands).not.toBeNull();
      const h = hands as number[];
      let union = 0;
      for (let p = 0; p < 4; p++) {
        expect(popcount(h[p])).toBe(s.hands[p].length);
        expect(h[p] & ~k.canHold[p]).toBe(0);
        expect(union & h[p]).toBe(0);
        union |= h[p];
      }
      expect(union).toBe(k.hand | k.unseen);
    }
  });
});

/** Plain minimax without pruning, tables or equivalences. */
function bruteForce(w: World): number {
  if (w.trick.length === 0 && w.hands[w.turn] === 0) return w.took === 1 ? 90 : w.took === 2 ? -90 : 0;
  let win = -1;
  for (const c of w.trick) if (win < 0 || beatsIdx(c, win, w.T)) win = c;
  const legal = legalMask(w.hands[w.turn], w.trick.length ? w.trick[0] : -1, win, w.T);
  const max = w.turn % 2 === 0;
  let best = max ? -1e9 : 1e9;
  for (let c = 0; c < 32; c++) {
    if (!(legal & (1 << c))) continue;
    const x = cloneWorld(w);
    const seat = x.turn;
    x.hands[seat] &= ~(1 << c);
    x.trick.push(c);
    x.trickSeats.push(seat);
    let gain = 0;
    if (x.trick.length < 4) x.turn = x.next[seat];
    else {
      let wi = 0;
      let pts = 0;
      for (let i = 0; i < 4; i++) {
        pts += x.T.points[x.trick[i]];
        if (i > 0 && beatsIdx(x.trick[i], x.trick[wi], x.T)) wi = i;
      }
      if ((x.hands[0] | x.hands[1] | x.hands[2] | x.hands[3]) === 0) pts += 10;
      const winner = x.trickSeats[wi];
      gain = winner % 2 === 0 ? pts : 0;
      x.took |= winner % 2 === 0 ? 1 : 2;
      x.trick = [];
      x.trickSeats = [];
      x.turn = winner;
    }
    const v = gain + bruteForce(x);
    best = max ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

describe('perfect-information solver', () => {
  it('agrees with plain minimax on endgames', () => {
    let n = 0;
    for (const s of decisions(40)) {
      if (s.hands[s.turn].length > 3) continue;
      const w = worldFromState(s);
      const values = [...new Solver().moveValues(cloneWorld(w)).values()];
      const best = s.turn % 2 === 0 ? Math.max(...values) : Math.min(...values);
      expect(best).toBe(bruteForce(w));
      n++;
    }
    expect(n).toBeGreaterThan(50);
  });
});

describe('research bots', () => {
  const quick: Record<string, Bot> = {
    random: makeBot('random'),
    tracker: makeBot('tracker:bid=learned'),
    pimc: makeBot('pimc:samples=4,exact=3,rollouts=1'),
    ismcts: makeBot('ismcts:iters=60'),
    easy: makeBot('heuristic:mistakes=0.5'),
  };
  for (const [name, bot] of Object.entries(quick)) {
    it(`${name} plays legal hands`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const s = playHand(setup(ARENA_OPTIONS, seed), [bot, bot, bot, bot], seed);
        expect(s.history).toHaveLength(1);
      }
    });
  }

  it('every difficulty level finishes a hand', () => {
    for (const botLevel of BOT_LEVELS) {
      const s = setup({ ...ARENA_OPTIONS, botLevel }, 9);
      const bot: Bot = (v, rng) => levelBot(v, rng);
      expect(playHand(s, [bot, bot, bot, bot], 9).history).toHaveLength(1);
    }
  });

  it('duplicate hands swap the teams on the same deal', () => {
    const [x, y] = duplicateHand(makeBot('heuristic'), makeBot('heuristic'), 5);
    expect(x.aTeam).toBe(0);
    expect(y.aTeam).toBe(1);
    // Same bots on both sides: the second half mirrors the first.
    expect(x.diff).toBe(-y.diff);
  });
});
