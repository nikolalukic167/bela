import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { compareDeclarations, declarationWinner, findDeclarations } from './declarations';
import { apply, autoAction, belaGame, currentPlayer, setup } from './engine';
import { legalCards, type Played } from './legal';
import { HAND_TOTAL } from './rules';
import { scoreHand } from './scoring';
import type { BelaState } from './state';

const SUIT: Record<string, Suit> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
/** Parse "Jh 9h As" into cards. */
const cards = (str: string): Card[] =>
  str.split(' ').map((t) => ({ rank: t.slice(0, -1) as Rank, suit: SUIT[t.slice(-1)] }));
const trickOf = (str: string): Played[] => cards(str).map((card, seat) => ({ seat, card }));
const ids = (cs: Card[]) => cs.map((c) => `${c.rank}${c.suit[0]}`).sort();

describe('legal plays', () => {
  it('must follow suit and beat if possible', () => {
    const hand = cards('7h Ah 10h 9s');
    expect(ids(legalCards(hand, trickOf('Kh'), 'spades'))).toEqual(['10h', 'Ah']);
  });

  it('may play any card of the suit when unable to beat', () => {
    const hand = cards('7h 8h 9s');
    expect(ids(legalCards(hand, trickOf('Ah'), 'spades'))).toEqual(['7h', '8h']);
  });

  it('must trump when void in led suit', () => {
    const hand = cards('7s Js Ad');
    expect(ids(legalCards(hand, trickOf('Ah'), 'spades'))).toEqual(['7s', 'Js']);
  });

  it('must overtrump when possible', () => {
    const hand = cards('7s Js Ad');
    expect(ids(legalCards(hand, trickOf('Ah 9s'), 'spades'))).toEqual(['Js']);
  });

  it('need not beat a trumped trick when following suit', () => {
    const hand = cards('7h Ah');
    expect(ids(legalCards(hand, trickOf('Kh 7s'), 'spades'))).toEqual(['7h', 'Ah']);
  });

  it('may discard anything when void in led suit and trumps', () => {
    const hand = cards('7d Ac');
    expect(ids(legalCards(hand, trickOf('Kh'), 'spades'))).toEqual(['7d', 'Ac']);
  });

  it('in trumps, the 9 beats the ace and J beats the 9', () => {
    expect(ids(legalCards(cards('9s Js 7s'), trickOf('As'), 'spades'))).toEqual(['9s', 'Js']);
  });
});

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
    const [a] = findDeclarations(cards('9h 10h Jh 7s 8d Ac Qc 7c'), 0); // 3-seq to J
    const [b] = findDeclarations(cards('9s 10s Js 7h 8d Ad Qd 7d'), 1); // same in spades
    expect(compareDeclarations(a, b, 'clubs', prio)).toBeGreaterThan(0); // seat priority
    expect(compareDeclarations(a, b, 'spades', prio)).toBeLessThan(0); // trump suit wins
    const [c] = findDeclarations(cards('10d Jd Qd 7s 8h Ac Qc 7c'), 3); // 3-seq to Q
    expect(compareDeclarations(c, a, 'clubs', prio)).toBeGreaterThan(0);
    expect(declarationWinner([a, b, c], 'clubs', prio)).toBe(1);
  });
});

function playedOut(overrides: Partial<BelaState>): BelaState {
  return {
    ...setup({ target: 1001, direction: 'ccw' }, 1),
    trump: 'hearts',
    callerSeat: 0,
    declarations: [],
    declarationTeam: null,
    tricksTaken: [4, 4],
    cardPoints: [82, 80],
    belaCalled: [0, 0],
    ...overrides,
  };
}

describe('scoring', () => {
  it('caller making the contract keeps their points', () => {
    const r = scoreHand(playedOut({}));
    expect(r.fell).toBe(false);
    expect(r.score).toEqual([82, 80]);
  });

  it('pad: caller below half gives everything to opponents', () => {
    const r = scoreHand(playedOut({ cardPoints: [70, 92] }));
    expect(r.fell).toBe(true);
    expect(r.score).toEqual([0, 162]);
  });

  it('declarations count toward the contract', () => {
    const declarations = findDeclarations(cards('7s 8s 9s 10s Jd Qd 7c 8c'), 1);
    const r = scoreHand(playedOut({ cardPoints: [90, 72], declarations, declarationTeam: 1 }));
    expect(r.declarations).toEqual([0, 50]);
    expect(r.fell).toBe(true);
    expect(r.score).toEqual([0, 212]);
  });

  it('štiglja adds 90', () => {
    const r = scoreHand(playedOut({ tricksTaken: [8, 0], cardPoints: [162, 0] }));
    expect(r.stiglja).toBe(0);
    expect(r.score).toEqual([252, 0]);
  });

  it('exact tie leaves caller points hanging (visi)', () => {
    const r = scoreHand(playedOut({ cardPoints: [81, 81] }));
    expect(r.hung).toBe(true);
    expect(r.score).toEqual([0, 81]);
  });
});

describe('full matches between bots', () => {
  it('play to completion with consistent hand totals', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      let s = setup({ target: 1001, direction: seed % 2 ? 'ccw' : 'cw' }, seed);
      let steps = 0;
      let hands = 0;
      while (!belaGame.isOver(s)) {
        if (++steps > 20000) throw new Error('match did not finish');
        const auto = autoAction(s);
        const before = s;
        s = auto ? apply(s, auto) : apply(s, belaGame.bot(s, currentPlayer(s) as number, rng));
        if (before.phase === 'collect' && (s.phase === 'handOver' || s.phase === 'matchOver')) {
          hands++;
          const r = s.history[s.history.length - 1];
          const cardTotal = r.cardPoints[0] + r.cardPoints[1];
          expect(cardTotal).toBe(HAND_TOTAL + (r.stiglja !== null ? 90 : 0));
          expect(s.hands.every((h) => h.length === 0)).toBe(true);
        }
      }
      expect(hands).toBeGreaterThan(0);
      expect(s.winner).not.toBeNull();
    }
  });
});
