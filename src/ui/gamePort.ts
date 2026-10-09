/**
 * What a table screen needs from a game, whoever runs it (architecture §8): `useGame` runs
 * the engine in the browser, `useOnlineGame` talks to the server. The screen can't tell them apart.
 */
export interface GamePort<A, V> {
  /** The viewer's seat projection, or null before a game exists. */
  view: V | null;
  /** Moves the viewer may make now; empty when it isn't their turn. */
  legalActions: A[];
  act: (a: A) => void;
  /** Seconds left on the viewer's turn timer while a countdown should show (online only). */
  secondsLeft?: number | null;
}
