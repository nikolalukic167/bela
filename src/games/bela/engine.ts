import { RANKS_32, buildDeck, sameCard, shuffle, type Card, type Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { declarationWinner, findDeclarations } from './declarations';
import { legalCards, winningIndex } from './legal';
import { cardPoints } from './rules';
import { scoreHand, settleHand } from './scoring';
import { DEFAULT_RULES, type BelaAction, type BelaOptions, type BelaState } from './state';

export const HUMAN_SEAT = 0;
/** Cards dealt into the hand, then face down into the talon, per seat. */
const HAND_SIZE = 6;
const TALON_SIZE = 2;

/** Seats at the table; games saved before modes existed have four. */
export const seatCount = (o: Pick<BelaOptions, 'players'>): number => o.players ?? 4;
const allSeats = (o: Pick<BelaOptions, 'players'>) => Array.from({ length: seatCount(o) }, (_, i) => i);

export const teamOf = (seat: number) => seat % 2;

export function nextSeat(seat: number, s: { options: BelaOptions }): number {
  const n = seatCount(s.options);
  return s.options.direction === 'ccw' ? (seat + 1) % n : (seat + n - 1) % n;
}

/** 0 for the player after the dealer, … n − 1 for the dealer. */
export function playOrder(s: Pick<BelaState, 'options' | 'dealer'>, seat: number): number {
  const n = seatCount(s.options);
  let p = nextSeat(s.dealer, s);
  for (let i = 0; i < n; i++) {
    if (p === seat) return i;
    p = nextSeat(p, s);
  }
  return n;
}

/**
 * Deck order: first the six-card hands (seat 0 first), then the two-card talons
 * (seat 0 first). With four seats: cards 0–23 are hands, 24–31 talons.
 */
function deal(s: BelaState, arranged?: Card[]): BelaState {
  const seats = allSeats(s.options);
  const deck = arranged ?? shuffle(buildDeck(RANKS_32), createRng(s.seed + s.handNo * 7919));
  if (deck.length !== seats.length * (HAND_SIZE + TALON_SIZE)) throw new Error('A Bela deck has 32 cards');
  const handCards = seats.length * HAND_SIZE;
  const hands = seats.map((i) => deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE));
  const talon = seats.map((i) => deck.slice(handCards + i * TALON_SIZE, handCards + (i + 1) * TALON_SIZE));
  return {
    ...s,
    phase: 'trump',
    turn: nextSeat(s.dealer, s),
    hands,
    talon,
    trump: null,
    callerSeat: null,
    passed: [],
    declarations: [],
    declarationTeam: null,
    declarationsShown: false,
    trick: [],
    tricks: [],
    lastTrick: null,
    tricksTaken: [0, 0],
    trickPoints: [0, 0],
    belaCalled: [0, 0],
    belaSeats: [],
    belaHolder: -1,
    played: [],
  };
}

/** `deck` arranges the first deal (see `deal`); later deals are shuffled from `seed`. */
export function setup(options: BelaOptions, seed: number, deck?: Card[]): BelaState {
  if (seatCount(options) !== 4) throw new Error(`${seatCount(options)}-player Bela is not implemented yet`);
  const base: BelaState = {
    options,
    seed,
    handNo: 0,
    dealer: 3,
    phase: 'trump',
    turn: 0,
    hands: [],
    talon: [],
    trump: null,
    callerSeat: null,
    passed: [],
    declarations: [],
    declarationTeam: null,
    declarationsShown: false,
    trick: [],
    tricks: [],
    lastTrick: null,
    tricksTaken: [0, 0],
    trickPoints: [0, 0],
    belaCalled: [0, 0],
    belaSeats: [],
    belaHolder: -1,
    played: [],
    scores: [0, 0],
    hanging: 0,
    history: [],
    winner: null,
  };
  // The dealer is chosen so that the human (seat 0) is first to speak.
  base.dealer = options.direction === 'ccw' ? 3 : 1;
  return deal(base, deck);
}

export function currentPlayer(s: BelaState): number | null {
  if (s.phase === 'trump' || s.phase === 'play') return s.turn;
  if (s.phase === 'handOver') return HUMAN_SEAT;
  return null;
}

export function legalActions(s: BelaState, player: number): BelaAction[] {
  if (currentPlayer(s) !== player) return [];
  switch (s.phase) {
    case 'trump': {
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const calls: BelaAction[] = suits.map((suit) => ({ type: 'call', suit }));
      // Dealer is forced to call ("mus").
      return player === s.dealer ? calls : [{ type: 'pass' }, ...calls];
    }
    case 'play':
      return legalCards(s.hands[player], s.trick, s.trump as Suit).map((card) => ({ type: 'play', card }));
    case 'handOver':
      return [{ type: 'next' }];
    default:
      return [];
  }
}

/** The system action to apply automatically (after a UI delay), if any. */
export function autoAction(s: BelaState): BelaAction | null {
  return s.phase === 'collect' ? { type: 'collect' } : null;
}

function isLegal(s: BelaState, a: BelaAction): boolean {
  if (a.type === 'collect') return s.phase === 'collect';
  const player = currentPlayer(s);
  if (player === null) return false;
  return legalActions(s, player).some(
    (l) =>
      l.type === a.type &&
      (l.type !== 'call' || (a.type === 'call' && l.suit === a.suit)) &&
      (l.type !== 'play' || (a.type === 'play' && sameCard(l.card, a.card))),
  );
}

export function apply(s: BelaState, a: BelaAction): BelaState {
  if (!isLegal(s, a)) throw new Error(`Illegal action ${JSON.stringify(a)} in phase ${s.phase}`);

  switch (a.type) {
    case 'pass':
      return { ...s, passed: [...s.passed, s.turn], turn: nextSeat(s.turn, s) };

    case 'call': {
      const hands = s.hands.map((h, i) => [...h, ...s.talon[i]]);
      const declarations = hands.flatMap((h, seat) => findDeclarations(h, seat));
      const withTrump = { ...s, trump: a.suit };
      return {
        ...s,
        hands,
        talon: s.talon.map(() => []),
        trump: a.suit,
        callerSeat: s.turn,
        belaHolder: hands.findIndex(
          (h) => h.some((c) => c.suit === a.suit && c.rank === 'K') && h.some((c) => c.suit === a.suit && c.rank === 'Q'),
        ),
        declarations,
        declarationTeam: declarationWinner(declarations, a.suit, (seat) => playOrder(withTrump, seat)),
        phase: 'play',
        turn: nextSeat(s.dealer, s),
      };
    }

    case 'play': {
      const seat = s.turn;
      const trump = s.trump as Suit;
      const hand = s.hands[seat].filter((c) => !sameCard(c, a.card));
      const hands = s.hands.map((h, i) => (i === seat ? hand : h));
      const trick = [...s.trick, { seat, card: a.card }];

      // Bela: announced automatically when the holder of trump K+Q plays the second of them.
      let belaCalled = s.belaCalled;
      let belaSeats = s.belaSeats;
      const isBelaCard = (c: { suit: Suit; rank: string }) => c.suit === trump && (c.rank === 'K' || c.rank === 'Q');
      if (seat === s.belaHolder && isBelaCard(a.card) && !hand.some(isBelaCard)) {
        belaCalled = [...belaCalled] as [number, number];
        belaCalled[teamOf(seat)] += 1;
        belaSeats = [...belaSeats, seat];
      }

      const next = { ...s, hands, trick, belaCalled, belaSeats };
      if (trick.length < seatCount(s.options)) return { ...next, turn: nextSeat(seat, s) };
      return { ...next, phase: 'collect' };
    }

    case 'collect': {
      const trump = s.trump as Suit;
      const winner = s.trick[winningIndex(s.trick, trump)].seat;
      const team = teamOf(winner);
      const tricksTaken = [...s.tricksTaken] as [number, number];
      tricksTaken[team] += 1;
      const pts = [...s.trickPoints] as [number, number];
      pts[team] += s.trick.reduce((sum, p) => sum + cardPoints(p.card, trump), 0);
      const played = [...s.played, ...s.trick.map((p) => p.card)];
      const handDone = s.hands.every((h) => h.length === 0);

      const after: BelaState = {
        ...s,
        tricksTaken,
        trickPoints: pts,
        played,
        tricks: [...(s.tricks ?? []), s.trick],
        lastTrick: s.trick,
        trick: [],
        turn: winner,
        declarationsShown: true,
        phase: 'play',
      };
      return handDone ? finishHand(after) : after;
    }

    case 'next':
      return deal({ ...s, handNo: s.handNo + 1, dealer: nextSeat(s.dealer, s) });
  }
}

function finishHand(s: BelaState): BelaState {
  const hand = scoreHand({
    trump: s.trump as Suit,
    callerTeam: teamOf(s.callerSeat as number),
    trickPoints: s.trickPoints,
    tricksTaken: s.tricksTaken,
    lastTrickTeam: teamOf(s.turn),
    declarations: s.declarations,
    declarationTeam: s.declarationTeam,
    belaCalled: s.belaCalled,
  }, { ...DEFAULT_RULES, ...s.options });
  const { match, result } = settleHand({ scores: s.scores, hanging: s.hanging, winner: null }, hand, s.options.target);
  return {
    ...s,
    scores: match.scores,
    hanging: match.hanging,
    winner: match.winner,
    history: [...s.history, { ...result, callerSeat: s.callerSeat as number }],
    phase: match.winner === null ? 'handOver' : 'matchOver',
  };
}
