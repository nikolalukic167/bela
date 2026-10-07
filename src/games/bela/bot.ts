import { SUITS, type Card, type Suit } from '../../core/cards';
import type { Rng } from '../../core/rng';
import { beats } from './legal';
import { cardPoints, strength } from './rules';
import type { BelaAction } from './state';
import type { SeatView } from './view';

// The bot only ever sees its seat's view: own hand plus public information.

const TRUMP_WEIGHT: Record<string, number> = { J: 4, '9': 3, A: 1.6, '10': 1.3, K: 0.9, Q: 0.8, '8': 0.6, '7': 0.6 };

/** Rough strength of a 6-card hand if `trump` were called. */
export function trumpScore(hand: Card[], trump: Suit): number {
  let score = 0;
  for (const c of hand) {
    if (c.suit === trump) score += TRUMP_WEIGHT[c.rank];
    else if (c.rank === 'A') score += 1.1;
    else if (c.rank === '10') score += 0.3;
  }
  return score;
}

const CALL_THRESHOLD = 6.5;

function chooseTrump(v: SeatView): BelaAction {
  let best: Suit = SUITS[0];
  for (const suit of SUITS) if (trumpScore(v.hand, suit) > trumpScore(v.hand, best)) best = suit;
  return v.mustCall || trumpScore(v.hand, best) >= CALL_THRESHOLD ? { type: 'call', suit: best } : { type: 'pass' };
}

/** True if no unseen card of the same suit can beat `card` (ignores ruffs). */
function isBoss(card: Card, v: SeatView): boolean {
  const trump = v.trump as Suit;
  const seen = [...v.played, ...v.trick.map((p) => p.card), ...v.hand];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
  return ranks.every((rank) => {
    const other = { suit: card.suit, rank };
    if (strength(other, trump) <= strength(card, trump)) return true;
    return seen.some((c) => c.suit === other.suit && c.rank === other.rank);
  });
}

const byPoints = (trump: Suit) => (a: Card, b: Card) =>
  cardPoints(a, trump) - cardPoints(b, trump) || strength(a, trump) - strength(b, trump);

function choosePlay(v: SeatView): Card {
  const trump = v.trump as Suit;
  const legal = v.playable;
  if (legal.length === 1) return legal[0];
  const cheapest = (cards: Card[]) => cards.slice().sort(byPoints(trump))[0];
  const richest = (cards: Card[]) => cards.slice().sort(byPoints(trump)).reverse()[0];
  const nonTrump = (cards: Card[]) => cards.filter((c) => c.suit !== trump);

  // Leading.
  if (v.trick.length === 0) {
    const myTeamCalled = (v.callerSeat as number) % 2 === v.seat % 2;
    const trumpJ = legal.find((c) => c.suit === trump && c.rank === 'J');
    if (myTeamCalled && trumpJ) return trumpJ;
    const bosses = nonTrump(legal).filter((c) => isBoss(c, v));
    if (bosses.length > 0) return richest(bosses);
    const plain = nonTrump(legal);
    return cheapest(plain.length > 0 ? plain : legal);
  }

  // Following.
  const winning = v.trick.find((p) => p.winning) as SeatView['trick'][number];
  const partnerWinning = winning.seat % 2 === v.seat % 2;
  const lastToPlay = v.trick.length === 3;

  if (partnerWinning) {
    const safe = lastToPlay || (isBoss(winning.card, v) && (winning.card.suit === trump || v.trick.length === 2));
    if (safe) {
      const smear = nonTrump(legal);
      return richest(smear.length > 0 ? smear : legal);
    }
    return cheapest(legal);
  }

  const winners = legal.filter((c) => beats(c, winning.card, trump));
  const trickPoints = v.trick.reduce((sum, p) => sum + cardPoints(p.card, trump), 0);
  if (winners.length > 0 && (lastToPlay || trickPoints >= 10 || winners.some((c) => isBoss(c, v)))) {
    const sure = lastToPlay ? winners : winners.filter((c) => isBoss(c, v));
    return cheapest(sure.length > 0 ? sure : winners);
  }
  const plain = nonTrump(legal);
  return cheapest(plain.length > 0 ? plain : legal);
}

export function chooseAction(v: SeatView, _rng: Rng): BelaAction {
  switch (v.phase) {
    case 'trump':
      return chooseTrump(v);
    case 'play':
      return { type: 'play', card: choosePlay(v) };
    case 'handOver':
      return { type: 'next' };
    default:
      throw new Error(`Bot has nothing to do in phase ${v.phase}`);
  }
}
