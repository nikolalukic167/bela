// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { elapse, newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const nearTheEnd = (t: Backend) =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query('tableStates').first())!;
    await ctx.db.patch(row._id, { state: { ...row.state, scores: [495, 495] } });
  });

describe('personal stats', () => {
  it('count a finished online match with its hands, and the record keeps who called each hand', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    const c = await ana.as.mutation(api.tables.create, { options: OPTIONS });
    await ana.as.mutation(api.tables.start, { code: c });
    await nearTheEnd(t);
    await elapse(t, 60 * 60_000, async (at) => {
      if (at % 20_000 === 0) await ana.as.mutation(api.tables.heartbeat, { code: c }).catch(() => {});
    }, 5000);
    expect((await ana.as.query(api.tables.watch, { code: c }))?.status).toBe('finished');

    const game = await t.run(async (ctx) => (await ctx.db.query('games').first())!);
    expect(game.hands?.length).toBeGreaterThan(0);
    for (const h of game.hands!) expect([0, 1, 2, 3]).toContain(h.callerSeat);

    const s = await ana.as.query(api.stats.mine, {});
    expect(s.summary.games).toBe(1);
    expect(s.summary.hands).toBe(game.hands!.length);
    expect(s.summary.calls).toBe(game.hands!.filter((h) => h.callerSeat === 0).length);
    expect(s.summary.gamesWithHands).toBe(1);
    expect(s.partners).toEqual([]); // the partner was a bot
  });

  it('list partners by name with games and wins, from the caller\'s matches only', async () => {
    const t = newBackend();
    const [ana, bruno, cvita, duje] = await Promise.all(['Ana', 'Bruno', 'Cvita', 'Duje'].map((n) => signUp(t, n)));
    // Ana+Cvita beat Bruno+Duje twice; then Ana+Bruno lose once. A game without Ana must not count.
    const game = (players: Id<'users'>[], winner: number, scores = winner === 0 ? [1001, 500] : [500, 1001]) =>
      t.run(async (ctx) => {
        const tableId = await ctx.db.insert('tables', {
          code: Math.random().toString(36).slice(2, 8).toUpperCase(),
          hostId: players[0],
          options: OPTIONS,
          status: 'finished',
          seats: players.map((userId, i) => ({ kind: 'user' as const, userId, name: ['A', 'B', 'C', 'D'][i] })),
          isTest: false,
          speed: 'live',
          createdAt: Date.now(),
          result: { scores, winner },
        });
        for (const userId of players) await ctx.db.insert('memberships', { userId, tableId });
        await ctx.db.insert('games', { tableId, players, scores, winner, rated: false, endReason: 'normal', endedAt: Date.now() });
      });
    await game([ana.userId, bruno.userId, cvita.userId, duje.userId], 0);
    await game([ana.userId, bruno.userId, cvita.userId, duje.userId], 0);
    await game([ana.userId, cvita.userId, bruno.userId, duje.userId], 1);
    await game([bruno.userId, cvita.userId, duje.userId, duje.userId], 0);

    const s = await ana.as.query(api.stats.mine, {});
    expect(s.summary).toMatchObject({ games: 3, wins: 2, winRate: 67, gamesWithHands: 0 });
    expect(s.partners).toEqual([
      { name: 'Cvita', games: 2, wins: 2 },
      { name: 'Bruno', games: 1, wins: 0 },
    ]);
  });
});
