import type { Card, Suit } from '../../core/cards';
import type { Declaration } from './declarations';
import type { Played } from './legal';

export type Direction = 'ccw' | 'cw';

export interface BelaOptions {
  /** Points needed to win the match. */
  target: 501 | 701 | 1001;
  /** Croatian tables traditionally play counter-clockwise. */
  direction: Direction;
}

export type Phase = 'trump' | 'play' | 'collect' | 'handOver' | 'matchOver';

export type BelaAction =
  | { type: 'pass' }
  | { type: 'call'; suit: Suit }
  | { type: 'play'; card: Card }
  | { type: 'collect' }
  | { type: 'next' };

export interface HandResult {
  caller: number; // team
  trump: Suit;
  cardPoints: [number, number];
  declarations: [number, number];
  bela: [number, number];
  stiglja: number | null; // team that took every trick
  fell: boolean; // caller failed the contract (pad)
  hung: boolean; // exact tie – caller's points carried over (visi)
  belot: number | null; // team holding an 8-card sequence
  score: [number, number]; // what was written down this hand
  hanging: number; // caller team's total; carried over when hung
}

export interface BelaState {
  options: BelaOptions;
  seed: number;
  handNo: number;
  dealer: number;
  phase: Phase;
  turn: number;
  hands: Card[][];
  /** Two face-down cards per player, picked up after trump is called. */
  talon: Card[][];
  trump: Suit | null;
  callerSeat: number | null;
  /** Seats that passed during trump calling this hand. */
  passed: number[];
  declarations: Declaration[];
  /** Team whose declarations count, decided when trump is called. */
  declarationTeam: number | null;
  /** Declarations are shown to the table after the first trick. */
  declarationsShown: boolean;
  trick: Played[];
  lastTrick: Played[] | null;
  tricksTaken: [number, number];
  /** Card points won in tricks so far, without the last-trick bonus. */
  trickPoints: [number, number];
  belaCalled: [number, number];
  /** Seats that announced bela, for UI. */
  belaSeats: number[];
  /** Seat holding trump K+Q after the talon, or -1. */
  belaHolder: number;
  played: Card[];
  scores: [number, number];
  /** Points left hanging after a tied contract (visi), go to next hand's winner. */
  hanging: number;
  history: HandResult[];
  winner: number | null;
}
