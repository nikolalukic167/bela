// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { replay } from '../../convex/lib/tableLogic';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets zero-delay (fast) matches finish while the live match is still on its first moves. */
async function settleFastMatches(t: ReturnType<typeof newBackend>) {
  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(10);
    await t.finishInProgressScheduledFunctions();
  }
}

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

describe('admin access', () => {
  it('is NOT_FOUND for guests, regular users and signed-out callers', async () => {
    const t = newBackend();
    const user = await signUp(t, 'Regular');
    for (const caller of [user.as, t]) {
      await failsWith(caller.query(api.admin.overview, {}), 'NOT_FOUND');
      await failsWith(caller.mutation(api.admin.seed, {}), 'NOT_FOUND');
      await failsWith(caller.mutation(api.admin.startBotMatch, { level: 'easy', speed: 'fast', target: 501 }), 'NOT_FOUND');
      await failsWith(caller.mutation(api.admin.clearTestData, {}), 'NOT_FOUND');
    }
  });

  it('users.me exposes isAdmin only to the admin themself', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const user = await signUp(t, 'Regular');
    expect((await admin.as.query(api.users.me, {}))?.isAdmin).toBe(true);
    expect((await user.as.query(api.users.me, {}))?.isAdmin).toBe(false);
  });

  it('setAdmin is internal and grants by username', async () => {
    const t = newBackend();
    await t.run((ctx) => ctx.db.insert('users', { name: 'nikola', email: 'nikola@users.karte.invalid' }));
    await t.mutation(internal.admin.setAdmin, { username: 'Nikola', admin: true });
    const flagged = await t.run((ctx) => ctx.db.query('users').withIndex('email', (q) => q.eq('email', 'nikola@users.karte.invalid')).unique());
    expect(flagged?.isAdmin).toBe(true);
    await failsWith(t.mutation(internal.admin.setAdmin, { username: 'ghost', admin: true }), 'NOT_FOUND');
  });
});

describe('bot matches and test data', () => {
  it('a fast bot match plays itself to the end and records the result', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const c = await admin.as.mutation(api.admin.startBotMatch, { level: 'hard', speed: 'fast', target: 501 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const w = await admin.as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('finished');
    expect(w?.spectating).toBe(true);
    expect(Math.max(...w!.result!.scores)).toBeGreaterThanOrEqual(501);
    const log = await t.run((ctx) => ctx.db.query('actions').collect());
    // At least two whole hands (one hand can't reach 501), each 32 cards played and 8 tricks collected.
    // A fixed 100 failed now and then: a lucky deal ends a 501 match in under 100 moves.
    expect(log.length).toBeGreaterThanOrEqual(2 * (32 + 8));
    expect(log.map((a) => a.seq)).toEqual(log.map((_, i) => i));
  });

  it('the stored action log rebuilds the stored game exactly (replay in CI, architecture §11)', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    await admin.as.mutation(api.admin.startBotMatch, { level: 'medium', speed: 'fast', target: 501 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const { table, row, log } = await t.run(async (ctx) => ({
      table: (await ctx.db.query('tables').first())!,
      row: (await ctx.db.query('tableStates').first())!,
      log: await ctx.db.query('actions').collect(),
    }));
    const sorted = log.sort((x, y) => x.seq - y.seq).map((a) => a.action);
    expect(replay(table.options, row.state.seed, sorted)).toEqual(row.state);
  });

  it('a live bot match keeps going one move per tick', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const c = await admin.as.mutation(api.admin.startBotMatch, { level: 'medium', speed: 'live', target: 501 });
    await vi.advanceTimersByTimeAsync(5000);
    await t.finishInProgressScheduledFunctions();
    const w = await admin.as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('playing');
    const v = await t.run(async (ctx) => (await ctx.db.query('tableStates').first())!.version);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(40);
  });

  it('seed creates test accounts and tables; clear removes exactly those', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const real = await signUp(t, 'Real');
    const realCode = await real.as.mutation(api.tables.create, { options: OPTIONS });
    const codes = await admin.as.mutation(api.admin.seed, {});
    await settleFastMatches(t);
    await failsWith(admin.as.mutation(api.admin.seed, {}), 'WRONG_STATE');

    let o = await admin.as.query(api.admin.overview, {});
    expect(o.testUsers).toBe(6);
    expect(o.tables).toHaveLength(4);
    expect(o.realTables).toBe(1);
    expect(o.tables.find((x) => x.code === codes.lobby)?.status).toBe('lobby');
    expect(o.tables.find((x) => x.code === codes.finishedA)?.status).toBe('finished');
    expect(o.tables.find((x) => x.code === codes.finishedB)?.status).toBe('finished');

    expect(await admin.as.mutation(api.admin.clearTestData, {})).toEqual({ tables: 4, users: 6 });
    o = await admin.as.query(api.admin.overview, {});
    expect(o).toMatchObject({ testUsers: 0, realTables: 1 });
    expect(o.tables).toHaveLength(0);
    expect(await real.as.query(api.tables.watch, { code: realCode })).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.query('actions').collect())).length).toBe(0);
  });

  it('test tables and bot accounts are invisible and unjoinable for real users', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const real = await signUp(t, 'Real');
    const codes = await admin.as.mutation(api.admin.seed, {});
    await settleFastMatches(t);
    for (const c of Object.values(codes)) {
      expect(await real.as.query(api.tables.watch, { code: c })).toBeNull();
      expect(await real.as.mutation(api.tables.join, { code: c })).toBeNull(); // same answer as an unknown code
      await failsWith(real.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }), 'NOT_FOUND');
    }
    expect(await real.as.query(api.tables.mine, {})).toEqual([]);
    // The admin can join the open test lobby to try the human flow.
    await admin.as.mutation(api.tables.join, { code: codes.lobby });
    expect((await admin.as.query(api.tables.watch, { code: codes.lobby }))?.mySeat).toBe(2);
  });

  it('spectating is limited to test tables: an admin sees no cards at a real table', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const real = await signUp(t, 'Real');
    const c = await real.as.mutation(api.tables.create, { options: OPTIONS });
    await real.as.mutation(api.tables.start, { code: c });
    const w = await admin.as.query(api.tables.watch, { code: c });
    expect(w?.view).toBeNull();
    expect(w?.spectating).toBe(false);
  });
});
