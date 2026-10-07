import type { Card, Suit } from '../../core/cards';
import type { Declaration } from './declarations';
import { currentPlayer, legalActions } from './engine';
import { winningIndex, type Played } from './legal';
import { sortHand } from './sort';
import type { BelaAction, BelaOptions, BelaState, HandResult, Phase } from './state';

export interface SeatInfo {
  seat: number;
  /** Cards held, including face-down talon cards. */
  cardCount: number;
  isDealer: boolean;
  isTurn: boolean;
  /** Passed during trump calling this hand. */
  passed: boolean;
  /** Announced bela this hand. */
  bela: boolean;
}

export interface TrickCard extends Played {
  /** Currently winning the trick. */
  winning: boolean;
}

/**
 * What one seat may know: its own cards plus public information. The table,
 * the bots and (later) a multiplayer server all read only this.
 */
export interface SeatView {
  seat: number;
  /** Increments with every deal. */
  handNo: number;
  options: BelaOptions;
  phase: Phase;
  dealer: number;
  isMyTurn: boolean;
  /** Own cards, sorted for display (trump suit first once called). */
  hand: Card[];
  /** Own talon cards still face down (during trump calling). */
  hiddenTalon: number;
  legal: BelaAction[];
  /** Cards this seat may play now; empty when it is not this seat's play. */
  playable: Card[];
  /** This seat is the dealer and everyone passed: it must call (mus). */
  mustCall: boolean;
  trump: Suit | null;
  callerSeat: number | null;
  seats: SeatInfo[];
  trick: TrickCard[];
  /** All four cards are down and the trick is about to be collected. */
  trickComplete: boolean;
  /** Declarations that count, public from the second trick until the hand ends. */
  declarations: { team: number; declarations: Declaration[] } | null;
  /** Cards from completed tricks this hand. */
  played: Card[];
  tricksTaken: [number, number];
  scores: [number, number];
  history: HandResult[];
  winner: number | null;
}

export function viewFor(s: BelaState, seat: number): SeatView {
  const turn = currentPlayer(s);
  const legal = legalActions(s, seat);
  const winIdx = s.trick.length > 0 && s.trump ? winningIndex(s.trick, s.trump) : -1;
  const team = s.declarationTeam;

  return {
    seat,
    handNo: s.handNo,
    options: s.options,
    phase: s.phase,
    dealer: s.dealer,
    isMyTurn: turn === seat,
    hand: sortHand(s.hands[seat], s.trump),
    hiddenTalon: s.talon[seat]?.length ?? 0,
    legal,
    playable: legal.flatMap((a) => (a.type === 'play' ? [a.card] : [])),
    mustCall: s.phase === 'trump' && turn === seat && seat === s.dealer,
    trump: s.trump,
    callerSeat: s.callerSeat,
    seats: [0, 1, 2, 3].map((p) => ({
      seat: p,
      cardCount: s.hands[p].length + (s.talon[p]?.length ?? 0),
      isDealer: p === s.dealer,
      isTurn: turn === p && (s.phase === 'trump' || s.phase === 'play'),
      passed: s.phase === 'trump' && s.passed.includes(p),
      bela: s.phase !== 'trump' && s.belaSeats.includes(p),
    })),
    trick: s.trick.map((p, i) => ({ ...p, winning: i === winIdx })),
    trickComplete: s.phase === 'collect',
    declarations:
      s.declarationsShown && team !== null
        ? { team, declarations: s.declarations.filter((d) => d.seat % 2 === team && d.kind !== 'belot') }
        : null,
    played: s.played,
    tricksTaken: s.tricksTaken,
    scores: s.scores,
    history: s.history,
    winner: s.winner,
  };
}
