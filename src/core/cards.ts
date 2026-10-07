import type { Rng } from './rng';

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS_52)[number];

export const RANKS_32: readonly Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';

export const cardId = (c: Card) => `${c.rank}${c.suit[0]}`;
export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

export function buildDeck(ranks: readonly Rank[]): Card[] {
  return SUITS.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
}

/** Fisher–Yates shuffle, returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
