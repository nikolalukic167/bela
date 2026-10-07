import type { Card, Suit } from '../../core/cards';
import { strength } from './rules';

export interface Played {
  seat: number;
  card: Card;
}

/** Index into `trick` of the card currently winning it. */
export function winningIndex(trick: Played[], trump: Suit): number {
  const led = trick[0].card.suit;
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const c = trick[i].card;
    const b = trick[best].card;
    if (c.suit !== led && c.suit !== trump) continue;
    if (beats(c, b, trump)) best = i;
  }
  return best;
}

/** Does `a` beat `b`, given `b` is already a contender (led suit or trump)? */
export function beats(a: Card, b: Card, trump: Suit): boolean {
  if (a.suit === b.suit) return strength(a, trump) > strength(b, trump);
  return a.suit === trump;
}

/**
 * Croatian Bela play obligations:
 * follow suit and beat the winning card if possible; if void, trump (and
 * overtrump if possible); otherwise any card.
 */
export function legalCards(hand: Card[], trick: Played[], trump: Suit): Card[] {
  if (trick.length === 0) return hand.slice();
  const led = trick[0].card.suit;
  const winning = trick[winningIndex(trick, trump)].card;

  const follow = hand.filter((c) => c.suit === led);
  if (follow.length > 0) {
    if (winning.suit !== led) return follow; // already trumped – cannot beat by following
    const higher = follow.filter((c) => beats(c, winning, trump));
    return higher.length > 0 ? higher : follow;
  }

  const trumps = hand.filter((c) => c.suit === trump);
  if (trumps.length > 0) {
    if (winning.suit !== trump) return trumps;
    const higher = trumps.filter((c) => beats(c, winning, trump));
    return higher.length > 0 ? higher : trumps;
  }
  return hand.slice();
}
