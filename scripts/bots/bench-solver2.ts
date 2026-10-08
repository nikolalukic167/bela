import { apply, setup } from '../../src/games/bela/engine';
import { OPTIONS, step } from '../../src/games/bela/testkit';
import { Solver } from '../../src/games/bela/bots/solver';
import { worldFromState } from '../../src/games/bela/bots/world';

// Time to get all root move values, by cards left in hand of the player to act.
const times: Record<number, number[]> = {};
for (let seed = 1; seed <= 30; seed++) {
  let s = setup(OPTIONS, seed);
  s = apply(s, { type: 'call', suit: 'hearts' });
  while (s.phase === 'play' || s.phase === 'collect') {
    if (s.phase === 'play' && s.trick.length === 0) {
      const n = s.hands[s.turn].length;
      if (n <= 7) {
        const t0 = performance.now();
        new Solver().moveValues(worldFromState(s));
        (times[n] ??= []).push(performance.now() - t0);
      }
    }
    s = step(s);
  }
}
for (const [n, ts] of Object.entries(times)) {
  ts.sort((a, b) => a - b);
  console.log(n, 'cards: median', ts[ts.length >> 1].toFixed(1), 'ms, max', ts[ts.length - 1].toFixed(1));
}
