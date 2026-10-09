// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { TIMER_PROFILES } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('per-table timer profile', () => {
  it('defaults to normal and is shown to the table', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    expect((await host.as.query(api.tables.watch, { code: c }))?.timerProfile).toBe('normal');
  });

  it('a quick table times the move with the quick profile', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, timerProfile: 'quick' });
    await host.as.mutation(api.tables.start, { code: c });
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.timerProfile).toBe('quick');
    expect(w?.deadline).toBe(Date.now() + TIMER_PROFILES.quick.turnMs);
    // The host keeps the page open but doesn't move: the server plays for them on the quick clock.
    await elapse(t, TIMER_PROFILES.quick.turnMs + 1000);
    const log = await t.run((ctx) => ctx.db.query('actions').collect());
    expect(log.find((a) => a.seat === 0)).toBeDefined();
  });

  it('a relaxed table holds a dropped player\'s seat for the relaxed grace period', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, timerProfile: 'relaxed' });
    await friend.as.mutation(api.tables.join, { code: c });
    await host.as.mutation(api.tables.start, { code: c });
    const friendAway = async () => (await host.as.query(api.tables.watch, { code: c }))?.seats[1].away;
    // Only the host's page is open; the friend dropped right after the start.
    const hostOnly = (ms: number) => elapse(t, ms, async (at) => {
      if (at % 20_000 === 0) await host.as.mutation(api.tables.heartbeat, { code: c });
    }, 1000);
    await hostOnly(TIMER_PROFILES.normal.graceMs + 5000);
    expect(await friendAway()).toBe(false); // a normal table would have a stand-in by now
    await hostOnly(TIMER_PROFILES.relaxed.graceMs - TIMER_PROFILES.normal.graceMs);
    expect(await friendAway()).toBe(true);
  });

  it('is frozen with the table: the rematch keeps it', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, timerProfile: 'relaxed' });
    await host.as.mutation(api.tables.start, { code: c });
    await t.run(async (ctx) => {
      const table = (await ctx.db.query('tables').first())!;
      await ctx.db.patch(table._id, { status: 'finished', result: { scores: [501, 0], winner: 0 }, finishedAt: Date.now() });
    });
    const next = await host.as.mutation(api.tables.rematch, { code: c });
    expect((await host.as.query(api.tables.watch, { code: next }))?.timerProfile).toBe('relaxed');
  });
});
