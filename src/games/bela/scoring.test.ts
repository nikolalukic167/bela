import { describe, expect, it } from 'vitest';
import { findDeclarations } from './declarations';
import { scoreHand, settleHand, type HandTally, type MatchScore } from './scoring';
import { cards } from './testkit';

const tally = (t: Partial<HandTally>): HandTally => ({
  trump: 'hearts',
  callerTeam: 0,
  trickPoints: [72, 80],
  tricksTaken: [4, 4],
  lastTrickTeam: 0,
  declarations: [],
  declarationTeam: null,
  belaCalled: [0, 0],
  ...t,
});
const fresh: MatchScore = { scores: [0, 0], hanging: 0, winner: null };

describe('scoreHand', () => {
  it('adds the last trick and keeps both totals when the caller makes it', () => {
    const r = scoreHand(tally({}));
    expect(r.cardPoints).toEqual([82, 80]);
    expect(r.fell).toBe(false);
    expect(r.score).toEqual([82, 80]);
  });
  it('pad: caller at or below half of a larger total gives everything away', () => {
    const r = scoreHand(tally({ trickPoints: [60, 92] }));
    expect(r.fell).toBe(true);
    expect(r.score).toEqual([0, 162]);
  });
  it('declarations count toward the contract', () => {
    const declarations = findDeclarations(cards('7s 8s 9s 10s Jd Qd 7c 8c'), 1);
    const r = scoreHand(tally({ trickPoints: [80, 72], declarations, declarationTeam: 1 }));
    expect(r.declarations).toEqual([0, 50]);
    expect(r.fell).toBe(true);
    expect(r.score).toEqual([0, 212]);
  });
  it('bela counts for the team that announced it', () => {
    const r = scoreHand(tally({ trickPoints: [62, 90], belaCalled: [1, 0] }));
    expect(r.bela).toEqual([20, 0]);
    expect(r.score).toEqual([92, 90]);
  });
  it('štiglja adds 90 on top of the last trick', () => {
    const r = scoreHand(tally({ trickPoints: [152, 0], tricksTaken: [8, 0] }));
    expect(r.stiglja).toBe(0);
    expect(r.score).toEqual([252, 0]);
  });
  it('visi: an exact tie leaves the caller total hanging', () => {
    const r = scoreHand(tally({ trickPoints: [71, 81] }));
    expect(r.hung).toBe(true);
    expect(r.score).toEqual([0, 81]);
    expect(r.hanging).toBe(81);
  });
});

describe('settleHand', () => {
  const hung = scoreHand(tally({ trickPoints: [71, 81] }));

  it('carries hanging points to the caller when the next contract is made', () => {
    const first = settleHand(fresh, hung, 1001);
    expect(first.match).toEqual({ scores: [0, 81], hanging: 81, winner: null });
    const second = settleHand(first.match, scoreHand(tally({})), 1001);
    expect(second.result.score).toEqual([82 + 81, 80]);
    expect(second.match.hanging).toBe(0);
  });
  it('gives hanging points to the opponents when the next caller falls', () => {
    const first = settleHand(fresh, hung, 1001);
    const second = settleHand(first.match, scoreHand(tally({ trickPoints: [60, 92] })), 1001);
    expect(second.result.score).toEqual([0, 162 + 81]);
  });
  it('accumulates hanging points over consecutive ties', () => {
    const first = settleHand(fresh, hung, 1001);
    expect(settleHand(first.match, hung, 1001).match.hanging).toBe(162);
  });
  it('ends the match at the target, higher score winning', () => {
    const r = settleHand({ scores: [950, 900], hanging: 0, winner: null }, scoreHand(tally({})), 1001);
    expect(r.match.winner).toBe(0);
  });
  it('keeps playing when both pass the target with equal scores', () => {
    const tie = settleHand({ scores: [920, 922], hanging: 0, winner: null }, scoreHand(tally({})), 1001);
    expect(tie.match.scores).toEqual([1002, 1002]);
    expect(tie.match.winner).toBeNull();
  });
  it('belot wins the match outright', () => {
    const belot = { ...scoreHand(tally({})), belot: 1 };
    expect(settleHand(fresh, belot, 1001).match.winner).toBe(1);
  });
});

describe('house rules', () => {
  it('bela always counts: a failed caller still writes its bela', () => {
    const r = scoreHand(tally({ trickPoints: [50, 102], belaCalled: [1, 0] }), { belaAlwaysCounts: true, tie: 'hangs' });
    expect(r.fell).toBe(true);
    expect(r.score).toEqual([20, 162]);
  });

  it('tie fails: an exact tie counts as a failed contract and nothing hangs', () => {
    const r = scoreHand(tally({ trickPoints: [71, 81] }), { belaAlwaysCounts: false, tie: 'fails' });
    expect(r.fell).toBe(true);
    expect(r.hung).toBe(false);
    expect(r.score).toEqual([0, 162]);
  });
});
