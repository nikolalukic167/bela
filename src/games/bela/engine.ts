import { RANKS_32, buildDeck, sameCard, shuffle, type Suit } from '../../core/cards';
import type { GameDefinition } from '../../core/game';
import { createRng } from '../../core/rng';
import { chooseAction } from './bot';
import { declarationWinner, findDeclarations } from './declarations';
import { legalCards, winningIndex } from './legal';
import { cardPoints, LAST_TRICK_BONUS } from './rules';
import { scoreHand } from './scoring';
import type { BelaAction, BelaOptions, BelaState } from './state';

export const NUM_PLAYERS = 4;
export const HUMAN_SEAT = 0;

export const teamOf = (seat: number) => seat % 2;

export function nextSeat(seat: number, s: { options: BelaOptions }): number {
  return s.options.direction === 'ccw' ? (seat + 1) % 4 : (seat + 3) % 4;
}

/** 0 for the player after the dealer, … 3 for the dealer. */
export function playOrder(s: BelaState, seat: number): number {
  let p = nextSeat(s.dealer, s);
  for (let i = 0; i < 4; i++) {
    if (p === seat) return i;
    p = nextSeat(p, s);
  }
  return 4;
}

function deal(s: BelaState): BelaState {
  const rng = createRng(s.seed + s.handNo * 7919);
  const deck = shuffle(buildDeck(RANKS_32), rng);
  const hands = [0, 1, 2, 3].map((i) => deck.slice(i * 6, i * 6 + 6));
  const talon = [0, 1, 2, 3].map((i) => deck.slice(24 + i * 2, 24 + i * 2 + 2));
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
    lastTrick: null,
    tricksTaken: [0, 0],
    cardPoints: [0, 0],
    belaCalled: [0, 0],
    belaSeats: [],
    belaHolder: -1,
    played: [],
  };
}

export function setup(options: BelaOptions, seed: number): BelaState {
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
    lastTrick: null,
    tricksTaken: [0, 0],
    cardPoints: [0, 0],
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
  return deal(base);
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
        talon: [[], [], [], []],
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
      if (trick.length < 4) return { ...next, turn: nextSeat(seat, s) };
      return { ...next, phase: 'collect' };
    }

    case 'collect': {
      const trump = s.trump as Suit;
      const winner = s.trick[winningIndex(s.trick, trump)].seat;
      const team = teamOf(winner);
      const tricksTaken = [...s.tricksTaken] as [number, number];
      tricksTaken[team] += 1;
      const pts = [...s.cardPoints] as [number, number];
      pts[team] += s.trick.reduce((sum, p) => sum + cardPoints(p.card, trump), 0);
      const played = [...s.played, ...s.trick.map((p) => p.card)];
      const handDone = played.length === 32;
      if (handDone) pts[team] += LAST_TRICK_BONUS;

      const after: BelaState = {
        ...s,
        tricksTaken,
        cardPoints: pts,
        played,
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
  const result = scoreHand(s);
  const scores = [s.scores[0] + result.score[0], s.scores[1] + result.score[1]] as [number, number];
  let hanging = s.hanging;
  if (hanging > 0 && !result.hung) {
    const handWinner = result.fell ? 1 - result.caller : result.caller;
    scores[handWinner] += hanging;
    result.score[handWinner] += hanging;
    hanging = 0;
  }
  if (result.hung) hanging += totalOf(result, result.caller);

  let winner: number | null = null;
  if (result.belot !== null) winner = result.belot;
  else if (scores[0] >= s.options.target || scores[1] >= s.options.target) {
    if (scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1;
  }

  return {
    ...s,
    scores,
    hanging,
    history: [...s.history, result],
    phase: winner === null ? 'handOver' : 'matchOver',
    winner,
  };
}

function totalOf(r: { cardPoints: number[]; declarations: number[]; bela: number[] }, team: number) {
  return r.cardPoints[team] + r.declarations[team] + r.bela[team];
}

export const belaGame: GameDefinition<BelaState, BelaAction, BelaOptions> = {
  id: 'bela',
  defaultOptions: { target: 1001, direction: 'ccw' },
  setup,
  currentPlayer,
  legalActions,
  apply,
  autoAction,
  isOver: (s) => s.phase === 'matchOver',
  bot: chooseAction,
};
