import { vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.*s');

export function newBackend() {
  return convexTest(schema, modules);
}
export type Backend = ReturnType<typeof newBackend>;

/** A signed-in client for a fresh user. Convex Auth's subject is "<userId>|<sessionId>". */
export async function signUp(t: Backend, name: string, flags: { isAdmin?: boolean } = {}) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { name, isAnonymous: true, ...flags }));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

export const OPTIONS = { target: 501 as const, direction: 'ccw' as const, belaAlwaysCounts: false, tie: 'hangs' as const, botLevel: 'medium' as const };

/**
 * Advances the fake clock in small ticks and runs whatever the scheduler fires on the way
 * (bot moves, presence checks). Unlike `finishAllScheduledFunctions(vi.runAllTimers)` it
 * stops at `ms`, so players are not timed out unless the test lets that much time pass.
 * `onTick` runs after each tick with the time elapsed so far (e.g. to send heartbeats).
 */
export async function elapse(t: Backend, ms: number, onTick?: (elapsed: number) => Promise<unknown>, TICK = 500) {
  for (let at = TICK; at <= ms; at += TICK) {
    vi.advanceTimersByTime(TICK);
    await t.finishInProgressScheduledFunctions();
    if (onTick) await onTick(at);
  }
}
