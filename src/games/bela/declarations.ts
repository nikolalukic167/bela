import type { Card, Suit } from '../../core/cards';
import { SUITS } from '../../core/cards';
import { FOUR_VALUES, SEQUENCE_ORDER, SEQUENCE_VALUES } from './rules';

export interface Declaration {
  seat: number;
  kind: 'sequence' | 'four' | 'belot';
  cards: Card[];
  value: number;
}

/** All declarations (zvanja) in an 8-card hand. A full 8-card suit is "belot". */
export function findDeclarations(hand: Card[], seat: number): Declaration[] {
  const out: Declaration[] = [];

  for (const suit of SUITS) {
    const idx = hand
      .filter((c) => c.suit === suit)
      .map((c) => SEQUENCE_ORDER.indexOf(c.rank))
      .sort((a, b) => a - b);
    let start = 0;
    for (let i = 1; i <= idx.length; i++) {
      if (i < idx.length && idx[i] === idx[i - 1] + 1) continue;
      const len = i - start;
      if (len >= 3) {
        const cards = idx.slice(start, i).map((r) => ({ suit, rank: SEQUENCE_ORDER[r] }));
        if (len === 8) out.push({ seat, kind: 'belot', cards, value: 0 });
        else out.push({ seat, kind: 'sequence', cards, value: SEQUENCE_VALUES[len] });
      }
      start = i;
    }
  }

  for (const rank of SEQUENCE_ORDER) {
    const value = FOUR_VALUES[rank];
    if (!value) continue;
    const cards = hand.filter((c) => c.rank === rank);
    if (cards.length === 4) out.push({ seat, kind: 'four', cards, value });
  }
  return out;
}

function topIndex(d: Declaration): number {
  return Math.max(...d.cards.map((c) => SEQUENCE_ORDER.indexOf(c.rank)));
}

/**
 * Compare two declarations; positive if `a` is better.
 * Order: value, length, top card, trump suit, then seat priority
 * (`priority` = position in play order starting after the dealer, lower wins).
 */
export function compareDeclarations(
  a: Declaration,
  b: Declaration,
  trump: Suit,
  priority: (seat: number) => number,
): number {
  if (a.value !== b.value) return a.value - b.value;
  if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length;
  const ta = topIndex(a);
  const tb = topIndex(b);
  if (ta !== tb) return ta - tb;
  const aTrump = a.cards[0].suit === trump && a.kind !== 'four' ? 1 : 0;
  const bTrump = b.cards[0].suit === trump && b.kind !== 'four' ? 1 : 0;
  if (aTrump !== bTrump) return aTrump - bTrump;
  return priority(b.seat) - priority(a.seat);
}

/** Team (0/1) whose declarations count this hand, or null if nobody declared. */
export function declarationWinner(
  all: Declaration[],
  trump: Suit,
  priority: (seat: number) => number,
): number | null {
  const scoring = all.filter((d) => d.kind !== 'belot');
  if (scoring.length === 0) return null;
  let best = scoring[0];
  for (const d of scoring.slice(1)) if (compareDeclarations(d, best, trump, priority) > 0) best = d;
  return best.seat % 2;
}
