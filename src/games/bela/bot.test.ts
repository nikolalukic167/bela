import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { belaGame } from './game';
import { deal } from './testkit';
import { viewFor } from './view';

describe('bot trump calling', () => {
  it('calls with a fair hand instead of passing it down to the dealer', () => {
    // Hearts score 6.3 (J 4 + 7 0.6 + side ace 1.1 + two side tens 0.6): between the old 6.5 and new 6.0.
    const s = deal({ 0: 'Jh 7h Ac 10d 10s 7s 9d 8d' });
    expect(s.turn).toBe(0);
    expect(s.dealer).not.toBe(0);
    expect(belaGame.bot(viewFor(s, 0), createRng(1))).toEqual({ type: 'call', suit: 'hearts' });
  });
});
