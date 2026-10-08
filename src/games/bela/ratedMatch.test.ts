import { describe, expect, it } from 'vitest';
import { replay } from '../../ratings/ratings';
import { setup } from './engine';
import { matchRecord } from './ratedMatch';
import { OPTIONS, step } from './testkit';

const SEATS: [string, string, string, string] = ['ana', 'ivo', 'marko', 'luka'];

function playMatch(seed: number) {
  let s = setup({ ...OPTIONS, target: 501 }, seed);
  for (let n = 0; s.phase !== 'matchOver'; n++) {
    if (n > 20000) throw new Error('match did not finish');
    s = step(s);
  }
  return s;
}

describe('rating a Bela match', () => {
  it('partners sit opposite each other and the winning pair goes up', () => {
    const s = playMatch(11);
    const m = matchRecord(s, SEATS, { id: 'x', playedAt: 0, rated: true });
    expect(m.teams).toEqual([['ana', 'marko'], ['ivo', 'luka']]);
    expect(m.winner).toBe(s.winner);
    expect(m.scores).toEqual(s.scores);

    const { book } = replay([m]);
    const [w, l] = m.winner === 0 ? m.teams : [m.teams[1], m.teams[0]];
    for (const id of w) for (const other of l) expect(book[id].mu).toBeGreaterThan(book[other].mu);
  });

  it('refuses an unfinished match unless someone abandoned it', () => {
    const s = setup(OPTIONS, 1);
    expect(() => matchRecord(s, SEATS, { id: 'x', playedAt: 0, rated: true })).toThrow();
    const m = matchRecord(s, SEATS, { id: 'x', playedAt: 0, rated: true, abandonedBy: 'ivo' });
    expect(m.abandonedBy).toBe('ivo');
    expect(replay([m]).book.ana.mu).toBeGreaterThan(replay([m]).book.ivo.mu);
  });
});
