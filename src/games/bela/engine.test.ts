import { describe, expect, it } from 'vitest';
import { apply, legalActions, setup } from './engine';
import { belaGame } from './game';
import { HAND_TOTAL } from './rules';
import { deal, OPTIONS, playOutHand, step } from './testkit';

describe('trump calling', () => {
  it('the dealer cannot pass (mus)', () => {
    let s = deal({});
    // Counter-clockwise, dealer is seat 3, so seats 0, 1, 2 speak first.
    for (const seat of [0, 1, 2]) {
      expect(s.turn).toBe(seat);
      s = apply(s, { type: 'pass' });
    }
    expect(s.turn).toBe(3);
    expect(legalActions(s, 3).some((a) => a.type === 'pass')).toBe(false);
    expect(() => apply(s, { type: 'pass' })).toThrow();
  });

  it('picking up the talon gives everyone 8 cards', () => {
    const s = apply(deal({}), { type: 'call', suit: 'hearts' });
    expect(s.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(s.callerSeat).toBe(0);
  });
});

describe('a hand played through the engine', () => {
  it('announces and scores bela for the holder of trump K+Q', () => {
    let s = deal({ 0: 'Kh Qh 7c 8c 9d 10d 7s 8s' });
    s = apply(s, { type: 'call', suit: 'hearts' });
    s = playOutHand(s);
    expect(s.belaSeats).toEqual([0]);
    expect(s.history[0].bela).toEqual([20, 0]);
  });

  it('only the team with the best declaration scores declarations', () => {
    let s = deal({ 0: 'Jh Jd Jc Js 7h 8d 9c 10s', 1: '7s 8s 9s Ac Kc 7d Ad Kd' });
    s = apply(s, { type: 'call', suit: 'spades' });
    expect(s.declarationTeam).toBe(0);
    s = playOutHand(s);
    expect(s.history[0].declarations).toEqual([200, 0]);
  });

  it('belot ends the match immediately', () => {
    let s = deal({ 1: '7s 8s 9s 10s Js Qs Ks As' });
    s = apply(s, { type: 'call', suit: 'hearts' });
    s = playOutHand(s);
    expect(s.phase).toBe('matchOver');
    expect(s.winner).toBe(1);
  });

  it('card points always total 162 (252 with štiglja)', () => {
    const s = playOutHand(deal({}));
    const r = s.history[0];
    expect(r.cardPoints[0] + r.cardPoints[1]).toBe(HAND_TOTAL + (r.stiglja !== null ? 90 : 0));
  });
});

describe('full matches between bots', () => {
  it('play to completion with consistent hand totals', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = setup({ ...OPTIONS, direction: seed % 2 ? 'ccw' : 'cw' }, seed);
      let steps = 0;
      while (!belaGame.isOver(s)) {
        if (++steps > 20000) throw new Error('match did not finish');
        const handsBefore = s.history.length;
        s = s.phase === 'handOver' ? apply(s, { type: 'next' }) : step(s);
        if (s.history.length > handsBefore) {
          const r = s.history[s.history.length - 1];
          expect(r.cardPoints[0] + r.cardPoints[1]).toBe(HAND_TOTAL + (r.stiglja !== null ? 90 : 0));
          expect(s.hands.every((h) => h.length === 0)).toBe(true);
        }
      }
      expect(s.winner).not.toBeNull();
    }
  });
});

describe('a finished match', () => {
  it('stays finished: "next" never deals another hand', () => {
    let s = setup({ ...OPTIONS, target: 501 }, 7);
    for (let i = 0; i < 500 && s.phase !== 'matchOver'; i++) s = s.phase === 'handOver' ? apply(s, { type: 'next' }) : step(s);
    expect(s.phase).toBe('matchOver');
    expect(() => apply(s, { type: 'next' })).toThrow(/Illegal/);
    expect(legalActions(s, 0)).toEqual([]);
  });
});
