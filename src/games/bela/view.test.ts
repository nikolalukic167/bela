import { describe, expect, it } from 'vitest';
import { apply } from './engine';
import { deal, step } from './testkit';
import { viewFor } from './view';

const has = (json: string, c: { suit: string; rank: string }) => json.includes(JSON.stringify(c));

describe('seat view', () => {
  it('never contains other players’ hands or talons', () => {
    let s = deal({});
    s = apply(s, { type: 'call', suit: 'hearts' });
    for (const seat of [0, 1, 2, 3]) {
      const json = JSON.stringify(viewFor(s, seat));
      for (const other of [0, 1, 2, 3].filter((o) => o !== seat)) {
        for (const c of s.hands[other]) expect(has(json, c)).toBe(false);
      }
    }
  });

  it('shows only own talon count before trump is called', () => {
    const s = deal({});
    const v = viewFor(s, 0);
    expect(v.hand).toHaveLength(6);
    expect(v.hiddenTalon).toBe(2);
    expect(v.seats.map((x) => x.cardCount)).toEqual([8, 8, 8, 8]);
    for (const c of s.talon[0]) expect(has(JSON.stringify(v), c)).toBe(false);
  });

  it('lists playable cards only on this seat’s turn', () => {
    const s = apply(deal({}), { type: 'call', suit: 'hearts' });
    expect(viewFor(s, 0).playable).toHaveLength(8);
    expect(viewFor(s, 1).playable).toHaveLength(0);
  });

  it('marks dealer must-call', () => {
    let s = deal({});
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'pass' });
    expect(viewFor(s, 3).mustCall).toBe(true);
    expect(viewFor(s, 3).legal.some((a) => a.type === 'pass')).toBe(false);
    expect(viewFor(s, 0).seats[0].passed).toBe(true);
  });

  it('flags the winning card and a complete trick', () => {
    let s = apply(deal({}), { type: 'call', suit: 'hearts' });
    for (let i = 0; i < 4; i++) s = step(s);
    const v = viewFor(s, 0);
    expect(v.trickComplete).toBe(true);
    expect(v.trick.filter((p) => p.winning)).toHaveLength(1);
  });

  it('reveals the counting declarations from the second trick until the hand ends', () => {
    let s = apply(deal({ 0: 'Jh Jd Jc Js 7h 8d 9c 10s' }), { type: 'call', suit: 'spades' });
    const firstTrick: (number | null)[] = [];
    const later: (number | null)[] = [];
    while (s.phase === 'play' || s.phase === 'collect') {
      const team = viewFor(s, 1).declarations?.team ?? null;
      (s.played.length < 4 ? firstTrick : later).push(team);
      s = step(s);
    }
    expect(firstTrick.every((t) => t === null)).toBe(true);
    expect(later.length).toBeGreaterThan(20);
    expect(later.every((t) => t === 0)).toBe(true);
  });
});
