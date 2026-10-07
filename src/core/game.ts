import type { Rng } from './rng';

/**
 * Game-agnostic contract every card game implements. Engines are pure and
 * their state is plain JSON, so the same code can later run on a server for
 * online multiplayer.
 *
 * S = full state, A = action, O = options, V = what one seat may see.
 */
export interface GameDefinition<S, A, O, V> {
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
  /** Projection of the state for one seat: hides other players' cards. */
  view(s: S, seat: number): V;
  /** Bots decide from their seat's view only. */
  bot(v: V, rng: Rng): A;
}
