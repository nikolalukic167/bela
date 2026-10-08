import type { Suit } from '../../../core/cards';
import type { BelaState, Direction } from '../state';
import { maskOf, suitIndex, tables, toIdx } from './fast';
import type { World } from './solver';

export const nextSeats = (d: Direction) => (d === 'ccw' ? [1, 2, 3, 0] : [3, 0, 1, 2]);

/** The true position of a hand in play (perfect information: tests and tools only). */
export function worldFromState(s: BelaState): World {
  let took = 0;
  if (s.tricksTaken[0] > 0) took |= 1;
  if (s.tricksTaken[1] > 0) took |= 2;
  return {
    T: tables(suitIndex(s.trump as Suit)),
    hands: s.hands.map(maskOf),
    next: nextSeats(s.options.direction),
    trick: s.trick.map((p) => toIdx(p.card)),
    trickSeats: s.trick.map((p) => p.seat),
    turn: s.turn,
    took,
  };
}
