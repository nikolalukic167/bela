import type { Card, Suit } from '../../../core/cards';
import { strength } from '../rules';

/** Group by suit (alternating colours, trump first) and order by strength. */
export function sortHand(hand: Card[], trump: Suit | null): Card[] {
  const order: Suit[] = ['hearts', 'spades', 'diamonds', 'clubs'];
  if (trump) {
    // Rotate so trump comes first while keeping colours alternating.
    while (order[0] !== trump) order.push(order.shift() as Suit);
  }
  const t = trump ?? 'hearts';
  return hand
    .slice()
    .sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || strength(b, t) - strength(a, t));
}
