// Level 2: card tracking and inference from public information only.
//
// For every unseen card we keep the set of seats that could still hold it.
// The core rule is exact: a seat that played card x into a trick could not have
// held any card c for which {x, c} would have made x illegal (must follow,
// must beat, must trump, must overtrump). That one rule yields voids, "has no
// higher trump", "has no higher card in the led suit", and so on.
import type { Suit } from '../../../core/cards';
import { winningIndex, type Played } from '../legal';
import type { SeatView } from '../view';
import { SUIT_MASK, beatsIdx, bit, maskOf, popcount, suitIndex, tables, toIdx, type TrumpTables } from './fast';

export interface Knowledge {
  seat: number;
  trump: number;
  T: TrumpTables;
  hand: number;
  /** Cards no one has played and that are not in our hand. */
  unseen: number;
  /** Per seat: unseen cards it may hold (our own seat: our hand). */
  canHold: number[];
  /** Per seat: unseen cards it certainly holds (shown declarations). */
  mustHold: number[];
  /** Per seat: cards still in hand. */
  counts: number[];
  /** Per seat: card points taken by each team so far, without last-trick bonus. */
  teamPoints: [number, number];
  /** Bit 1: team 0 took a trick, bit 2: team 1. */
  took: number;
  /** Cards each seat has played this hand (completed tricks and current trick). */
  playedBy: number[];
}

/** Cards that a seat which played `x` into `before` cannot have held. */
export function excludedBy(x: number, before: number[], T: TrumpTables): number {
  if (before.length === 0) return 0;
  const led = before[0];
  const ledSuit = led >> 3;
  let win = led;
  for (let i = 1; i < before.length; i++) if (beatsIdx(before[i], win, T)) win = before[i];
  const xs = x >> 3;
  if (xs === ledSuit) {
    // Followed: had to beat the winning card if it was still of the led suit.
    return win >> 3 === ledSuit && !beatsIdx(x, win, T) ? T.higher[win] : 0;
  }
  if (xs === T.trump) {
    // Void in the led suit and trumped; had to overtrump if possible.
    let out = SUIT_MASK[ledSuit];
    if (win >> 3 === T.trump && !beatsIdx(x, win, T)) out |= T.higher[win];
    return out;
  }
  // Neither followed nor trumped: void in both.
  return SUIT_MASK[ledSuit] | SUIT_MASK[T.trump];
}

export function infer(v: SeatView): Knowledge {
  const trump = suitIndex(v.trump as Suit);
  const T = tables(trump);
  const hand = maskOf(v.hand);
  const playedBy = [0, 0, 0, 0];
  const exclude = [0, 0, 0, 0];
  const teamPoints: [number, number] = [0, 0];
  let took = 0;

  const scan = (trick: Played[]) => {
    const before: number[] = [];
    for (const p of trick) {
      const x = toIdx(p.card);
      exclude[p.seat] |= excludedBy(x, before, T);
      playedBy[p.seat] |= bit(x);
      before.push(x);
    }
  };
  for (const trick of v.tricks) {
    scan(trick);
    const team = trick[winningIndex(trick, v.trump as Suit)].seat % 2;
    took |= team === 0 ? 1 : 2;
    for (const p of trick) teamPoints[team] += T.points[toIdx(p.card)];
  }
  scan(v.trick);

  let seen = hand;
  for (const m of playedBy) seen |= m;
  const unseen = ~seen;

  const mustHold = [0, 0, 0, 0];
  if (v.declarations) {
    for (const d of v.declarations.declarations) {
      if (d.seat !== v.seat) mustHold[d.seat] |= maskOf(d.cards) & unseen;
    }
  }

  const canHold = [0, 1, 2, 3].map((p) => {
    if (p === v.seat) return hand;
    let m = unseen & ~exclude[p];
    for (let q = 0; q < 4; q++) if (q !== p) m &= ~mustHold[q];
    return m | mustHold[p];
  });

  const counts = v.seats.map((s) => s.cardCount);
  return { seat: v.seat, trump, T, hand, unseen, canHold, mustHold, counts, teamPoints, took, playedBy };
}

/** Seats (other than ours) that may still hold a card of `suit`. */
export function holdersOfSuit(k: Knowledge, suit: number): number[] {
  return [0, 1, 2, 3].filter((p) => p !== k.seat && (k.canHold[p] & SUIT_MASK[suit] & k.unseen) !== 0);
}

/** Unseen cards of a suit (still in other players' hands). */
export function outstanding(k: Knowledge, suit: number): number {
  return k.unseen & SUIT_MASK[suit];
}

export const countOutstanding = (k: Knowledge, suit: number) => popcount(outstanding(k, suit));
