import type { Card, Rank, Suit } from '../../core/cards';

/** Strength order, weakest → strongest. */
export const TRUMP_ORDER: Rank[] = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
export const PLAIN_ORDER: Rank[] = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
/** Natural order used for sequences (zvanja). */
export const SEQUENCE_ORDER: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const TRUMP_POINTS: Partial<Record<Rank, number>> = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3 };
export const PLAIN_POINTS: Partial<Record<Rank, number>> = { A: 11, '10': 10, K: 4, Q: 3, J: 2 };

export const LAST_TRICK_BONUS = 10;
export const STIGLJA_BONUS = 90;
export const BELA_VALUE = 20;
/** Card points in one hand including the last-trick bonus. */
export const HAND_TOTAL = 162;

export const SEQUENCE_VALUES: Record<number, number> = { 3: 20, 4: 50, 5: 100, 6: 100, 7: 100 };
export const FOUR_VALUES: Partial<Record<Rank, number>> = { J: 200, '9': 150, A: 100, '10': 100, K: 100, Q: 100 };

export function cardPoints(c: Card, trump: Suit): number {
  return (c.suit === trump ? TRUMP_POINTS[c.rank] : PLAIN_POINTS[c.rank]) ?? 0;
}

export function strength(c: Card, trump: Suit): number {
  return c.suit === trump ? 100 + TRUMP_ORDER.indexOf(c.rank) : PLAIN_ORDER.indexOf(c.rank);
}
