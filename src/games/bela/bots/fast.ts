// Compact Bela card model for search: a card is an index 0–31 (suit * 8 + rank
// in sequence order 7 8 9 10 J Q K A), a hand is a 32-bit mask. Used by the
// solver, the sampler and the Monte Carlo bots, where the object-based engine
// would be far too slow.
import { SUITS, type Card, type Suit } from '../../../core/cards';
import { SEQUENCE_ORDER, cardPoints, strength } from '../rules';

export const suitIndex = (s: Suit) => SUITS.indexOf(s);
export const toIdx = (c: Card) => suitIndex(c.suit) * 8 + SEQUENCE_ORDER.indexOf(c.rank);
export const fromIdx = (i: number): Card => ({ suit: SUITS[i >> 3], rank: SEQUENCE_ORDER[i & 7] });
export const bit = (i: number) => 1 << i;
export const SUIT_MASK = [0xff, 0xff00, 0xff0000, 0xff000000 | 0];
export const ALL_CARDS = -1; // all 32 bits

export function maskOf(cards: Card[]): number {
  let m = 0;
  for (const c of cards) m |= bit(toIdx(c));
  return m;
}

export function cardsOf(mask: number): Card[] {
  const out: Card[] = [];
  forBits(mask, (i) => out.push(fromIdx(i)));
  return out;
}

export function forBits(mask: number, fn: (i: number) => void): void {
  let m = mask;
  while (m !== 0) {
    const b = m & -m;
    fn(31 - Math.clz32(b));
    m ^= b;
  }
}

export function popcount(m: number): number {
  m = m - ((m >>> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Per-trump lookup tables. */
export interface TrumpTables {
  trump: number;
  points: Int8Array;
  strength: Int16Array;
  /** Cards of the same suit that beat card i. */
  higher: Int32Array;
  /** Per suit, its 8 cards weakest first. */
  order: number[][];
}

const tableCache: TrumpTables[] = [];

export function tables(trump: number): TrumpTables {
  if (tableCache[trump]) return tableCache[trump];
  const t = SUITS[trump];
  const points = new Int8Array(32);
  const str = new Int16Array(32);
  for (let i = 0; i < 32; i++) {
    points[i] = cardPoints(fromIdx(i), t);
    str[i] = strength(fromIdx(i), t);
  }
  const higher = new Int32Array(32);
  for (let i = 0; i < 32; i++) {
    let m = 0;
    for (let j = (i >> 3) * 8; j < (i >> 3) * 8 + 8; j++) if (str[j] > str[i]) m |= bit(j);
    higher[i] = m;
  }
  const order = [0, 1, 2, 3].map((su) =>
    Array.from({ length: 8 }, (_, r) => su * 8 + r).sort((a, b) => str[a] - str[b]),
  );
  return (tableCache[trump] = { trump, points, strength: str, higher, order });
}

/** Does card a beat the currently winning card w? */
export function beatsIdx(a: number, w: number, T: TrumpTables): boolean {
  if (a >> 3 === w >> 3) return T.strength[a] > T.strength[w];
  return a >> 3 === T.trump;
}

/**
 * Legal cards (mask) from `hand`, given the led card and the winning card of
 * the trick so far (led < 0 when leading). Mirrors `legal.ts`.
 */
export function legalMask(hand: number, led: number, win: number, T: TrumpTables): number {
  if (led < 0) return hand;
  const ledSuit = led >> 3;
  const follow = hand & SUIT_MASK[ledSuit];
  if (follow !== 0) {
    if (win >> 3 !== ledSuit) return follow;
    const higher = follow & T.higher[win];
    return higher !== 0 ? higher : follow;
  }
  const trumps = hand & SUIT_MASK[T.trump];
  if (trumps !== 0) {
    if (win >> 3 !== T.trump) return trumps;
    const higher = trumps & T.higher[win];
    return higher !== 0 ? higher : trumps;
  }
  return hand;
}
