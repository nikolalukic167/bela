import type { Rng } from './rng';

/**
 * Game-agnostic contract every card game implements. Engines are pure and
 * their state is plain JSON, so the same code can later run on a server for
 * online multiplayer.
 */
export interface GameDefinition<S, A, O> {
  id: string;
  defaultOptions: O;
  setup(opts: O, seed: number): S;
  /** Seat whose input is awaited, or null when no input is pending. */
  currentPlayer(s: S): number | null;
  legalActions(s: S, player: number): A[];
  apply(s: S, a: A): S;
  /** System action (e.g. collecting a finished trick) the UI applies after a delay. */
  autoAction(s: S): A | null;
  isOver(s: S): boolean;
  bot(s: S, player: number, rng: Rng): A;
}
