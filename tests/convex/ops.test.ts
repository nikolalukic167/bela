// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { CALLS_PER_ACTION, HEARTBEAT_MS, QUOTA_CALLS_PER_MONTH, QUOTA_WARN_AT } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

describe('feature flags', () => {
  it('are public, and all on by default', async () => {
    const t = newBackend();
    expect(await t.query(api.flags.list, {})).toEqual({ ratings: true, rematch: true, chat: true });
  });

  it('only admins can switch them', async () => {
    const t = newBackend();
    const user = await signUp(t, 'Regular');
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    expect(await errCode(user.as.mutation(api.admin.setFlag, { name: 'chat', on: false }))).toBe('NOT_FOUND');
    await admin.as.mutation(api.admin.setFlag, { name: 'chat', on: false });
    expect(await t.query(api.flags.list, {})).toEqual({ ratings: true, rematch: true, chat: false });
    await admin.as.mutation(api.admin.setFlag, { name: 'chat', on: true });
    expect((await t.query(api.flags.list, {})).chat).toBe(true);
  });

  it('rematch off: no rematch table is opened', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    await t.run(async (ctx) => {
      const table = (await ctx.db.query('tables').first())!;
      await ctx.db.patch(table._id, { status: 'finished', result: { scores: [501, 0], winner: 0 }, finishedAt: Date.now() });
    });
    await admin.as.mutation(api.admin.setFlag, { name: 'rematch', on: false });
    expect(await errCode(host.as.mutation(api.tables.rematch, { code: c }))).toBe('FEATURE_OFF');
  });

  it('ratings off stops new rated tables only: a rated match already running is still rated (architecture §1.6)', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const players: Awaited<ReturnType<typeof signUp>>[] = [];
    for (const n of ['Ana', 'Bruno', 'Cvita', 'Duje']) players.push(await signUp(t, n, { isAnonymous: false }));
    const c = await players[0].as.mutation(api.tables.create, { options: OPTIONS, rated: true });
    for (const p of players.slice(1)) await p.as.mutation(api.tables.join, { code: c });
    await players[0].as.mutation(api.tables.start, { code: c });
    await admin.as.mutation(api.admin.setFlag, { name: 'ratings', on: false });
    expect(await errCode(players[0].as.mutation(api.tables.create, { options: OPTIONS, rated: true }))).toBe('FEATURE_OFF');
    // Finish the running match: both teams one hand from the target, turn timers play for everyone.
    await t.run(async (ctx) => {
      const row = (await ctx.db.query('tableStates').first())!;
      await ctx.db.patch(row._id, { state: { ...row.state, scores: [495, 495] } });
    });
    await elapse(t, 60 * 60_000, async (at) => {
      if (at % HEARTBEAT_MS === 0) for (const p of players) await p.as.mutation(api.tables.heartbeat, { code: c });
    }, 5000);
    expect((await players[0].as.query(api.tables.watch, { code: c }))?.status).toBe('finished');
    expect(await t.run((ctx) => ctx.db.query('games').collect())).toMatchObject([{ rated: true, endReason: 'normal' }]);
    for (const p of players) expect((await p.as.query(api.ratings.mine, {}))?.games).toBe(1);
  });
});

describe('quota watch', () => {
  it('counts yesterday\'s tables and actions, and the admin panel sums the last 30 days', async () => {
    const t = newBackend();
    vi.setSystemTime(Date.UTC(2026, 9, 1, 12));
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    await host.as.mutation(api.tables.create, { options: OPTIONS });
    vi.setSystemTime(Date.UTC(2026, 9, 2, 2, 43));
    await t.mutation(internal.maintenance.countUsage, {});
    const { usage } = await admin.as.query(api.admin.overview, {});
    expect(usage.days).toMatchObject([{ day: '2026-10-01', tables: 2, actions: 1 }]);
    expect(usage.estimatedCalls).toBe(CALLS_PER_ACTION * 1);
    expect(usage.warn).toBe(false);
  });

  it('pages through a busy day without hitting the per-mutation read limit', async () => {
    const t = newBackend();
    vi.setSystemTime(Date.UTC(2026, 9, 1, 12));
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const busy = 9_001;
    await t.run(async (ctx) => {
      const tableId = await ctx.db.insert('tables', {
        code: 'BUSYBUSY', hostId: admin.userId, options: OPTIONS, status: 'finished', seats: [], isTest: false, speed: 'live', createdAt: Date.now(),
      });
      for (let seq = 0; seq < busy; seq++) await ctx.db.insert('actions', { tableId, seq, seat: 0, action: { type: 'pass' } });
    });
    vi.setSystemTime(Date.UTC(2026, 9, 2, 2, 43));
    await t.mutation(internal.maintenance.countUsage, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const { usage } = await admin.as.query(api.admin.overview, {});
    expect(usage.days).toMatchObject([{ day: '2026-10-01', tables: 1, actions: busy }]);
  }, 60_000);

  it('warns at the threshold, and days older than 30 drop out of the sum', async () => {
    const t = newBackend();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const atThreshold = Math.ceil((QUOTA_CALLS_PER_MONTH * QUOTA_WARN_AT) / CALLS_PER_ACTION);
    await t.run(async (ctx) => {
      await ctx.db.insert('usage', { day: '2026-08-01', tables: 1, actions: 10_000_000, games: 0 });
      await ctx.db.insert('usage', { day: '2026-10-01', tables: 1, actions: atThreshold - 1, games: 0 });
    });
    let { usage } = await admin.as.query(api.admin.overview, {});
    expect(usage.days.map((d) => d.day)).toEqual(['2026-10-01']);
    expect(usage.warn).toBe(false);
    await t.run(async (ctx) => {
      await ctx.db.insert('usage', { day: '2026-09-30', tables: 0, actions: 1, games: 0 });
    });
    ({ usage } = await admin.as.query(api.admin.overview, {}));
    expect(usage.warn).toBe(true);
  });
});

describe('structured logs', () => {
  it('are JSON lines with ids, never seeds, hands, tokens or emails', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
    try {
      const t = newBackend();
      const host = await signUp(t, 'Host');
      const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
      await host.as.mutation(api.tables.start, { code: c });
      await host.as.mutation(api.tables.leave, { code: c });
    } finally {
      spy.mockRestore();
    }
    const events = lines.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(events.map((e) => e.event)).toEqual(expect.arrayContaining(['table.created', 'table.started']));
    for (const e of events) {
      expect(e.tableId ?? e.gameId).toBeDefined();
      for (const secret of ['seed', 'hand', 'hands', 'state', 'token', 'email', 'talon']) expect(e).not.toHaveProperty(secret);
    }
  });
});
