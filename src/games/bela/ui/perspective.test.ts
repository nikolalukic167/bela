import { describe, expect, it } from 'vitest';
import { belaGame } from '../game';
import { deal } from '../testkit';
import { viewFor } from '../view';
import { perspective } from './perspective';
import { positionOf } from './positions';

describe('perspective', () => {
  const s = { ...deal({}), scores: [120, 340] as [number, number], winner: null };

  it('is the identity for team 0', () => {
    const v = viewFor(s, 2);
    expect(perspective(v)).toBe(v);
  });

  it('swaps teams for seats on team 1 so "us" is always the viewer', () => {
    const v = viewFor(s, 1);
    const p = perspective(v);
    expect(p.scores).toEqual([340, 120]);
    expect(p.hand).toEqual(v.hand);
    expect(p.seat).toBe(1);
    expect(perspective(p).scores).toEqual([120, 340]); // swapping is an involution only through a team-0 view
  });

  it('flips winner, declaration team and hand results', () => {
    const base = viewFor(s, 3);
    const r = { caller: 0, trump: 'hearts', cardPoints: [100, 62], declarations: [20, 0], bela: [0, 20], stiglja: 1, fell: false, hung: false, belot: null, score: [120, 82], hanging: 0 } as const;
    const v = { ...base, winner: 0, history: [{ ...r, cardPoints: [100, 62], declarations: [20, 0], bela: [0, 20], score: [120, 82] }] } as typeof base;
    const p = perspective(v);
    expect(p.winner).toBe(1);
    expect(p.history[0]).toMatchObject({ caller: 1, cardPoints: [62, 100], declarations: [0, 20], bela: [20, 0], score: [82, 120], stiglja: 0, belot: null });
  });
});

describe('positionOf with a viewer', () => {
  const o = belaGame.defaultOptions;
  it('puts the viewer at the bottom and their partner on top, whatever the seat', () => {
    for (const viewer of [0, 1, 2, 3]) {
      expect(positionOf(viewer, o, viewer)).toBe('bottom');
      expect(positionOf((viewer + 2) % 4, o, viewer)).toBe('top');
    }
  });
  it('keeps the old default for the local player', () => {
    expect(positionOf(1, o)).toBe('right');
    expect(positionOf(1, { ...o, direction: 'cw' })).toBe('left');
  });
  it('gives the four seats four different positions', () => {
    expect(new Set([0, 1, 2, 3].map((s) => positionOf(s, o, 3))).size).toBe(4);
  });
});
