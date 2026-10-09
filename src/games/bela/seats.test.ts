import { describe, expect, it } from 'vitest';
import { nextSeat, playOrder, seatCount } from './engine';
import { belaGame } from './game';
import { deal, OPTIONS, playOutHand } from './testkit';
import { viewFor } from './view';

describe('seat count', () => {
  it('is part of the game definition, 4 by default and for games saved before modes', () => {
    expect(belaGame.seats(belaGame.defaultOptions)).toBe(4);
    expect(seatCount(OPTIONS)).toBe(4);
    expect(seatCount({ ...OPTIONS, players: 3 })).toBe(3);
  });

  it('drives the turn order around the table, both directions', () => {
    const three = { options: { ...OPTIONS, players: 3 as const } };
    expect([0, 1, 2].map((p) => nextSeat(p, three))).toEqual([1, 2, 0]);
    const cw = { options: { ...OPTIONS, players: 3 as const, direction: 'cw' as const } };
    expect([0, 1, 2].map((p) => nextSeat(p, cw))).toEqual([2, 0, 1]);
    const four = { options: OPTIONS };
    expect([0, 1, 2, 3].map((p) => nextSeat(p, four))).toEqual([1, 2, 3, 0]);
  });

  it('drives the order of play after the dealer', () => {
    const s = { ...deal({}), options: { ...OPTIONS, players: 3 as const }, dealer: 2 };
    expect([0, 1, 2].map((p) => playOrder(s, p))).toEqual([0, 1, 2]);
  });

  it('gives a four-player view four seats, and a four-player hand still deals 32 cards', () => {
    const s = playOutHand(deal({}));
    expect(viewFor(s, 0).seats).toHaveLength(4);
    expect(s.played).toHaveLength(32);
  });
});
