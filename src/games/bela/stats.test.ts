import { describe, expect, it } from 'vitest';
import { apply } from './engine';
import { handLines, seatHands, summarizeStats, type HandLine } from './stats';
import { deal, playOutHand } from './testkit';
import type { HandResult } from './state';

describe('hand results', () => {
  it('remember which seat called trump', () => {
    // Seat 0 passes, seat 1 calls.
    let s = apply(deal({}), { type: 'pass' });
    s = apply(s, { type: 'call', suit: 'spades' });
    s = playOutHand(s);
    expect(s.history[0].callerSeat).toBe(1);
  });
});

const line = (callerSeat: number, fell: boolean, score: [number, number]): HandLine => ({ callerSeat, fell, score });

describe('handLines', () => {
  it('keeps what stats need and skips hands saved before callers were recorded', () => {
    const r = { caller: 0, fell: true, score: [0, 182] } as unknown as HandResult;
    expect(handLines([{ ...r, callerSeat: 2 }, r])).toEqual([line(2, true, [0, 182])]);
  });
});

describe('seatHands', () => {
  it('counts hands, own calls, own falls and the points written for the seat\'s team', () => {
    const lines = [line(0, false, [120, 42]), line(1, true, [162, 0]), line(0, true, [0, 172]), line(2, false, [100, 62])];
    expect(seatHands(lines, 0)).toEqual({ hands: 4, calls: 2, falls: 1, points: 120 + 162 + 0 + 100 });
    expect(seatHands(lines, 1)).toEqual({ hands: 4, calls: 1, falls: 1, points: 42 + 0 + 172 + 62 });
  });
});

describe('summarizeStats', () => {
  it('is empty-safe', () => {
    expect(summarizeStats([])).toEqual({
      games: 0, wins: 0, winRate: null, avgPoints: null, hands: 0, calls: 0, callRate: null, falls: 0, fallRate: null, avgHandPoints: null, gamesWithHands: 0,
    });
  });

  it('adds up matches; hand stats come only from games that have them', () => {
    const s = summarizeStats([
      { won: true, points: 1001, hands: { hands: 10, calls: 4, falls: 1, points: 1001 } },
      { won: false, points: 640, hands: { hands: 10, calls: 2, falls: 2, points: 640 } },
      { won: true, points: 1010 },
    ]);
    expect(s).toEqual({
      games: 3, wins: 2, winRate: 67, avgPoints: 884, hands: 20, calls: 6, callRate: 30, falls: 3, fallRate: 50, avgHandPoints: 82, gamesWithHands: 2,
    });
  });
});
