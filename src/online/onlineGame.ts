// Pure decisions behind useOnlineGame, kept apart so they are tested without Convex or React.
import type { BelaAction, Phase } from '../games/bela/state';

/** The turn countdown appears for the last seconds only, so it doesn't nag. */
export const COUNTDOWN_FROM_S = 20;

/**
 * Seconds left on this player's turn timer, or null when no countdown should show: no
 * deadline, someone else's turn, or still outside the countdown window. The hand summary
 * counts too, since any seated player's "next" deals on.
 */
export function secondsLeft(deadline: number | null, now: number, view: { isMyTurn: boolean; phase: Phase } | null): number | null {
  if (deadline === null || !view || !(view.isMyTurn || view.phase === 'handOver')) return null;
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return left > COUNTDOWN_FROM_S ? null : left;
}

/** Only a seated player at a running table reports presence; spectators and lobbies don't. */
export function needsHeartbeat(table: { status: string; mySeat: number | null } | null | undefined): boolean {
  return table?.status === 'playing' && table.mySeat !== null;
}

/** Collecting a trick is the server's job; everything else goes to `tables.act`. */
export function serverAction(a: BelaAction): Exclude<BelaAction, { type: 'collect' }> | null {
  return a.type === 'collect' ? null : a;
}
