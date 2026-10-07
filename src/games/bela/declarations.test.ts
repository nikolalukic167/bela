import { describe, expect, it } from 'vitest';
import { compareDeclarations, declarationWinner, findDeclarations } from './declarations';
import { cards } from './testkit';

describe('declarations', () => {
  it('finds sequences and fours', () => {
    const decl = findDeclarations(cards('7h 8h 9h 10h Js Jd Jc Jh'), 0);
    expect(decl.map((d) => [d.kind, d.value])).toEqual([
      ['sequence', 100],
      ['four', 200],
    ]);
  });
  it('values sequences 20 / 50 / 100', () => {
    expect(findDeclarations(cards('Qh Kh Ah 7s 9s Jd 8c 10c'), 0)[0].value).toBe(20);
    expect(findDeclarations(cards('Jh Qh Kh Ah 7s 9s 8c 10c'), 0)[0].value).toBe(50);
  });
  it('detects belot (all 8 of a suit)', () => {
    expect(findDeclarations(cards('7h 8h 9h 10h Jh Qh Kh Ah'), 0)[0].kind).toBe('belot');
  });
  it('compares by value, then length, then top card, then trump, then seat', () => {
    const prio = (seat: number) => seat;
    const [a] = findDeclarations(cards('9h 10h Jh 7s 8d Ac Qc 7c'), 0);
    const [b] = findDeclarations(cards('9s 10s Js 7h 8d Ad Qd 7d'), 1);
    expect(compareDeclarations(a, b, 'clubs', prio)).toBeGreaterThan(0);
    expect(compareDeclarations(a, b, 'spades', prio)).toBeLessThan(0);
    const [c] = findDeclarations(cards('10d Jd Qd 7s 8h Ac Qc 7c'), 3);
    expect(compareDeclarations(c, a, 'clubs', prio)).toBeGreaterThan(0);
    expect(declarationWinner([a, b, c], 'clubs', prio)).toBe(1);
  });
});
