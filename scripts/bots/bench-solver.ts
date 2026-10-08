import { apply } from '../../src/games/bela/engine';
import { setup } from '../../src/games/bela/engine';
import { OPTIONS } from '../../src/games/bela/testkit';
import { Solver } from '../../src/games/bela/bots/solver';
import { worldFromState } from '../../src/games/bela/bots/world';

for (let seed = 1; seed <= 10; seed++) {
  let s = setup(OPTIONS, seed);
  s = apply(s, { type: 'call', suit: 'hearts' });
  const t0 = performance.now();
  const solver = new Solver();
  const w = worldFromState(s);
  const v = solver.value(w);
  const t1 = performance.now();
  const mv = new Solver().moveValues(worldFromState(s));
  const t2 = performance.now();
  console.log(seed, 'value', v, 'nodes', solver.nodes, `${(t1 - t0).toFixed(0)}ms`, 'moves', [...mv.values()].join(' '), `${(t2 - t1).toFixed(0)}ms`);
}
