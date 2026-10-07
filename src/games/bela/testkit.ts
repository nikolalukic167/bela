// Test helpers: describe cards tersely and arrange deals.
import { RANKS_32, buildDeck, sameCard, shuffle, type Card, type Rank, type Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { apply, autoAction, currentPlayer, setup } from './engine';
import { belaGame } from './game';
import { DEFAULT_RULES, type BelaOptions, type BelaState } from './state';

const SUIT: Record<string, Suit> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };

/** Parse "Jh 9h As" into cards. */
export const cards = (str: string): Card[] =>
  str.split(' ').map((t) => ({ rank: t.slice(0, -1) as Rank, suit: SUIT[t.slice(-1)] }));

export const ids = (cs: Card[]) => cs.map((c) => `${c.rank}${c.suit[0]}`).sort();

/**
 * A deck giving the listed seats exactly these 8 cards (first 6 in hand,
 * last 2 in the talon); other seats get the remaining cards, shuffled.
 */
export function arrangedDeck(seats: Partial<Record<number, string>>): Card[] {
  const fixed = Object.fromEntries(Object.entries(seats).map(([k, v]) => [k, cards(v as string)]));
  const used = Object.values(fixed).flat();
  const rest = shuffle(buildDeck(RANKS_32).filter((c) => !used.some((u) => sameCard(u, c))), createRng(7));
  const eight = [0, 1, 2, 3].map((seat) => fixed[seat] ?? rest.splice(0, 8));
  return [...eight.flatMap((h) => h.slice(0, 6)), ...eight.flatMap((h) => h.slice(6))];
}

export const OPTIONS: BelaOptions = { target: 1001, direction: 'ccw', ...DEFAULT_RULES };

export const deal = (seats: Partial<Record<number, string>>, options = OPTIONS) =>
  setup(options, 1, arrangedDeck(seats));

/** Advance one step: a system action or the current seat's bot move. */
export function step(s: BelaState): BelaState {
  const auto = autoAction(s);
  if (auto) return apply(s, auto);
  const seat = currentPlayer(s) as number;
  return apply(s, belaGame.bot(belaGame.view(s, seat), createRng(seat)));
}

/** Let bots play until the current hand is scored. */
export function playOutHand(s: BelaState): BelaState {
  let n = 0;
  while (s.phase !== 'handOver' && s.phase !== 'matchOver') {
    if (++n > 500) throw new Error('hand did not finish');
    s = step(s);
  }
  return s;
}
