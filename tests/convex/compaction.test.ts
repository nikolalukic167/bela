// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from '../../convex/_generated/api';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DAY = 24 * 60 * 60 * 1000;

describe('action-log compaction', () => {
  it('deletes the move log of old finished unrated real tables only, keeping every games row', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const make = (code: string, extra: { rated?: boolean; isTest?: boolean; status?: 'finished' | 'playing' }) =>
      t.run(async (ctx) => {
        const tableId = await ctx.db.insert('tables', {
          code, hostId: admin.userId, options: OPTIONS, status: extra.status ?? 'finished', seats: [], isTest: extra.isTest ?? false,
          speed: 'live', createdAt: Date.now(), finishedAt: Date.now(), rated: extra.rated,
        });
        for (let seq = 0; seq < 3; seq++) await ctx.db.insert('actions', { tableId, seq, seat: 0, action: { type: 'pass' } });
        await ctx.db.insert('games', { tableId, players: [null, null, null, null], scores: [501, 0], winner: 0, rated: extra.rated === true, endReason: 'normal', endedAt: Date.now() });
        return tableId;
      });
    const friendly = await make('FRIENDLY', {});
    const rated = await make('RATEDONE', { rated: true });
    const test = await make('TESTTEST', { isTest: true });
    const running = await make('RUNNINGG', { status: 'playing' });
    vi.advanceTimersByTime(20 * DAY);
    const recent = await make('RECENTLY', {});
    vi.advanceTimersByTime(15 * DAY); // 35 days after the first four, 15 after the last
    await t.mutation(internal.maintenance.compactLogs, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = async (tableId: string) => (await t.run((ctx) => ctx.db.query('actions').collect())).filter((a) => a.tableId === tableId).length;
    expect(await left(friendly)).toBe(0);
    expect(await left(rated)).toBe(3);
    expect(await left(test)).toBe(3);
    expect(await left(running)).toBe(3);
    expect(await left(recent)).toBe(3);
    expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(5);
    // A second run has nothing to do.
    await t.mutation(internal.maintenance.compactLogs, {});
    expect(await left(rated)).toBe(3);
  });

  it('finishes a log bigger than one call can delete in follow-up calls', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const tableId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('tables', {
        code: 'LONGLONG', hostId: admin.userId, options: OPTIONS, status: 'finished', seats: [], isTest: false, speed: 'live', createdAt: Date.now(), finishedAt: Date.now(),
      });
      for (let seq = 0; seq < 9_001; seq++) await ctx.db.insert('actions', { tableId: id, seq, seat: 0, action: { type: 'pass' } });
      return id;
    });
    vi.advanceTimersByTime(31 * DAY);
    await t.mutation(internal.maintenance.compactLogs, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query('actions').collect())).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(tableId)))?.actionLog).toBe('compacted');
  }, 60_000);
});
