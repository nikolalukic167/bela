import { describe, expect, it } from 'vitest';
import { mergeHistory, recordLocal, summarize, type HistoryEntry } from './history';
import type { HandResult } from './state';

const entry = (id: string, playedAt: number, won: boolean, source: HistoryEntry['source'] = 'local'): HistoryEntry => ({
  id,
  playedAt,
  source,
  target: 1001,
  scores: won ? [1010, 800] : [700, 1020],
  won,
  players: ['Partner', 'Bot', 'Bot'],
});

describe('summarize', () => {
  it('counts games, wins and the win rate', () => {
    expect(summarize([entry('a', 1, true), entry('b', 2, false), entry('c', 3, true)])).toEqual({ played: 3, won: 2, rate: 67 });
  });
  it('has no rate before the first game', () => {
    expect(summarize([])).toEqual({ played: 0, won: 0, rate: null });
  });
});

describe('mergeHistory', () => {
  it('puts the newest first and drops duplicate ids', () => {
    const merged = mergeHistory([entry('a', 1, true), entry('b', 5, false)], [entry('c', 3, true, 'online'), entry('a', 1, true)]);
    expect(merged.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('recordLocal', () => {
  const finished = { handNo: 7, scores: [1012, 874] as [number, number], winner: 0, options: { target: 1001 as const } };

  it('turns a finished local match into an entry the player can read', () => {
    const e = recordLocal(finished, 1000);
    expect(e).toMatchObject({ source: 'local', target: 1001, scores: [1012, 874], won: true, playedAt: 1000 });
  });
  it('gives the same id every time for the same finished match, so a reload cannot add it twice', () => {
    expect(recordLocal(finished, 1000).id).toBe(recordLocal(finished, 5000).id);
  });
  it('keeps the human seat\'s hand stats when the match has hand results', () => {
    const history = [
      { callerSeat: 0, fell: false, score: [120, 42] },
      { callerSeat: 1, fell: true, score: [162, 0] },
    ] as unknown as HandResult[];
    expect(recordLocal({ ...finished, history }, 1).hands).toEqual({ hands: 2, calls: 1, falls: 0, points: 282 });
    expect(recordLocal(finished, 1).hands).toBeUndefined();
  });
  it('marks a lost match', () => {
    expect(recordLocal({ ...finished, scores: [800, 1005], winner: 1 }, 1).won).toBe(false);
  });
});
