// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { STALE_TABLE_MS } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

async function finishedTable() {
  const t = newBackend();
  const host = await signUp(t, 'Host');
  const friend = await signUp(t, 'Friend');
  const c = await host.as.mutation(api.tables.create, { options: { ...OPTIONS, target: 701 } });
  await friend.as.mutation(api.tables.join, { code: c });
  await host.as.mutation(api.tables.start, { code: c });
  await t.run(async (ctx) => {
    const table = await ctx.db.query('tables').withIndex('by_code', (q) => q.eq('code', c)).unique();
    await ctx.db.patch(table!._id, { status: 'finished', result: { scores: [701, 300], winner: 0 }, finishedAt: Date.now() });
  });
  return { t, host, friend, c };
}

describe('rematch', () => {
  it('opens a lobby with the same seating and options, hosted by whoever asked', async () => {
    const { host, friend, c } = await finishedTable();
    const next = await friend.as.mutation(api.tables.rematch, { code: c });
    expect(next).not.toBe(c);
    const w = await friend.as.query(api.tables.watch, { code: next });
    expect(w).toMatchObject({ status: 'lobby', isHost: true, mySeat: 1 });
    expect(w?.options.target).toBe(701);
    expect(w?.seats.map((s) => [s.kind, s.name])).toEqual((await host.as.query(api.tables.watch, { code: c }))!.seats.map((s) => [s.kind, s.name]));
    expect((await host.as.query(api.tables.mine, {})).map((m) => m.code)).toContain(next);
  });

  it('is one table for everyone: the old table points to it and asking again returns it', async () => {
    const { host, friend, c } = await finishedTable();
    const next = await host.as.mutation(api.tables.rematch, { code: c });
    expect((await friend.as.query(api.tables.watch, { code: c }))?.rematchCode).toBe(next);
    expect(await friend.as.mutation(api.tables.rematch, { code: c })).toBe(next);
  });

  it('only players at a finished table can ask', async () => {
    const { t, c } = await finishedTable();
    const outsider = await signUp(t, 'Outsider');
    expect(await errCode(outsider.as.mutation(api.tables.rematch, { code: c }))).toBe('FORBIDDEN');
    const host = await signUp(t, 'Busy');
    const live = await host.as.mutation(api.tables.create, { options: OPTIONS });
    expect(await errCode(host.as.mutation(api.tables.rematch, { code: live }))).toBe('WRONG_STATE');
  });
});

describe('cleanup', () => {
  const count = (t: Backend, table: 'tables' | 'memberships' | 'presence' | 'tableStates' | 'actions') => t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

  it('deletes lobbies nobody started within a day, with their memberships, and keeps fresh ones', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    await host.as.mutation(api.tables.create, { options: OPTIONS });
    vi.advanceTimersByTime(STALE_TABLE_MS);
    const fresh = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await t.mutation(internal.tables.cleanup, {});
    expect((await host.as.query(api.tables.mine, {})).map((m) => m.code)).toEqual([fresh]);
    expect(await count(t, 'memberships')).toBe(1);
  });

  it('deletes a running table everyone has been away from for a day, but keeps finished games', async () => {
    const { t, host, c } = await finishedTable();
    const solo = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: solo });
    await t.run(async (ctx) => {
      const table = (await ctx.db.query('tables').withIndex('by_code', (q) => q.eq('code', solo)).unique())!;
      const seats = table.seats.map((s) => (s.kind === 'user' ? { kind: 'bot' as const, name: s.name, level: 'easy' as const, standInFor: s.userId } : s));
      await ctx.db.patch(table._id, { seats });
    });
    vi.advanceTimersByTime(STALE_TABLE_MS);
    await t.mutation(internal.tables.cleanup, {});
    expect(await host.as.query(api.tables.watch, { code: solo })).toBeNull();
    expect((await host.as.query(api.tables.watch, { code: c }))?.status).toBe('finished');
    expect((await host.as.query(api.tables.history, {})).map((h) => h.id)).toEqual([`online:${c}`]);
  });

  it('runs daily from crons.ts', async () => {
    const crons = (await import('../../convex/crons')).default as unknown as { crons: Record<string, unknown> };
    expect(Object.keys(crons.crons)).toContain('delete abandoned tables');
  });
});
