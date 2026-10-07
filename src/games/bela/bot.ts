import { SUITS, type Card, type Suit } from '../../core/cards';
import type { Rng } from '../../core/rng';
import { beats, legalCards, winningIndex } from './legal';
import { cardPoints, strength } from './rules';
import type { BelaAction, BelaState } from './state';

// The bot only reads its own hand plus public information (played cards, trick).

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

function chooseTrump(s: BelaState, seat: number): BelaAction {
  const hand = s.hands[seat];
  let best: Suit = SUITS[0];
  for (const suit of SUITS) if (trumpScore(hand, suit) > trumpScore(hand, best)) best = suit;
  const forced = seat === s.dealer;
  return forced || trumpScore(hand, best) >= CALL_THRESHOLD ? { type: 'call', suit: best } : { type: 'pass' };
}

/** True if no unseen card of the same suit can beat `card` (ignores ruffs). */
function isBoss(card: Card, s: BelaState, seat: number): boolean {
  const trump = s.trump as Suit;
  const seen = [...s.played, ...s.trick.map((p) => p.card), ...s.hands[seat]];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
  return ranks.every((rank) => {
    const other = { suit: card.suit, rank };
    if (strength(other, trump) <= strength(card, trump)) return true;
    return seen.some((c) => c.suit === other.suit && c.rank === other.rank);
  });
}

const byPoints = (trump: Suit) => (a: Card, b: Card) =>
  cardPoints(a, trump) - cardPoints(b, trump) || strength(a, trump) - strength(b, trump);

function choosePlay(s: BelaState, seat: number): Card {
  const trump = s.trump as Suit;
  const hand = s.hands[seat];
  const legal = legalCards(hand, s.trick, trump);
  if (legal.length === 1) return legal[0];
  const cheapest = (cards: Card[]) => cards.slice().sort(byPoints(trump))[0];
  const richest = (cards: Card[]) => cards.slice().sort(byPoints(trump)).reverse()[0];
  const nonTrump = (cards: Card[]) => cards.filter((c) => c.suit !== trump);

  // Leading.
  if (s.trick.length === 0) {
    const myTeamCalled = (s.callerSeat as number) % 2 === seat % 2;
    const trumpJ = legal.find((c) => c.suit === trump && c.rank === 'J');
    if (myTeamCalled && trumpJ) return trumpJ;
    const bosses = nonTrump(legal).filter((c) => isBoss(c, s, seat));
    if (bosses.length > 0) return richest(bosses);
    const plain = nonTrump(legal);
    return cheapest(plain.length > 0 ? plain : legal);
  }

  // Following.
  const winIdx = winningIndex(s.trick, trump);
  const winning = s.trick[winIdx];
  const partnerWinning = winning.seat % 2 === seat % 2;
  const lastToPlay = s.trick.length === 3;

  if (partnerWinning) {
    const safe = lastToPlay || (isBoss(winning.card, s, seat) && (winning.card.suit === trump || s.trick.length === 2));
    if (safe) {
      const smear = nonTrump(legal);
      return richest(smear.length > 0 ? smear : legal);
    }
    return cheapest(legal);
  }

  const winners = legal.filter((c) => beats(c, winning.card, trump));
  const trickPoints = s.trick.reduce((sum, p) => sum + cardPoints(p.card, trump), 0);
  if (winners.length > 0 && (lastToPlay || trickPoints >= 10 || winners.some((c) => isBoss(c, s, seat)))) {
    const sure = lastToPlay ? winners : winners.filter((c) => isBoss(c, s, seat));
    return cheapest(sure.length > 0 ? sure : winners);
  }
  const plain = nonTrump(legal);
  return cheapest(plain.length > 0 ? plain : legal);
}

export function chooseAction(s: BelaState, seat: number, _rng: Rng): BelaAction {
  switch (s.phase) {
    case 'trump':
      return chooseTrump(s, seat);
    case 'play':
      return { type: 'play', card: choosePlay(s, seat) };
    case 'handOver':
      return { type: 'next' };
    default:
      throw new Error(`Bot has nothing to do in phase ${s.phase}`);
  }
}
