// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HEARTBEAT_MS, RECONNECT_GRACE_MS } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Player = Awaited<ReturnType<typeof signUp>>;
const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

/** Four account holders at a rated table, seated in signup order. */
async function ratedTable(t: Backend, names = ['Ana', 'Bruno', 'Cvita', 'Duje']) {
  const players: Player[] = [];
  for (const n of names) players.push(await signUp(t, n, { isAnonymous: false }));
  const c = await players[0].as.mutation(api.tables.create, { options: OPTIONS, rated: true });
  for (const p of players.slice(1)) await p.as.mutation(api.tables.join, { code: c });
  return { players, c };
}

/** Lets time pass with the given players' tabs open. */
const keepAlive = (t: Backend, c: string, ms: number, present: Player[], tick = 500) =>
  elapse(t, ms, async (at) => {
    if (at % HEARTBEAT_MS === 0) for (const p of present) await p.as.mutation(api.tables.heartbeat, { code: c });
  }, tick);

/** Puts both teams one hand from the target, so the next hand ends the match. */
const nearTheEnd = (t: Backend) =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query('tableStates').first())!;
    await ctx.db.patch(row._id, { state: { ...row.state, scores: [495, 495] } });
  });

describe('rated tables', () => {
  it('start only with four different players who have accounts', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host', { isAnonymous: false });
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, rated: true });
    expect((await host.as.query(api.tables.watch, { code: c }))?.rated).toBe(true);
    expect(await errCode(host.as.mutation(api.tables.addBot, { code: c }))).toBe('RATED_NEEDS_FOUR');
    expect(await errCode(host.as.mutation(api.tables.start, { code: c }))).toBe('RATED_NEEDS_FOUR');
    for (const n of ['B', 'C']) await (await signUp(t, n, { isAnonymous: false })).as.mutation(api.tables.join, { code: c });
    await (await signUp(t, 'Guest')).as.mutation(api.tables.join, { code: c });
    expect(await errCode(host.as.mutation(api.tables.start, { code: c }))).toBe('RATED_NEEDS_ACCOUNTS');
  });

  it('a finished rated match updates every player’s rating and history, atomically with the game record', async () => {
    const t = newBackend();
    const { players, c } = await ratedTable(t);
    await players[0].as.mutation(api.tables.start, { code: c });
    await nearTheEnd(t);
    await keepAlive(t, c, 60 * 60_000, players, 5000); // turn timers play for everyone
    const w = await players[0].as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('finished');
    const winners = w!.result!.winner;
    const mine = await Promise.all(players.map((p) => p.as.query(api.ratings.mine, {})));
    for (const [seat, r] of mine.entries()) {
      expect(r?.games).toBe(1);
      expect(r?.provisional).toBe(true);
      expect(r?.history).toHaveLength(1);
      expect(r!.history[0].delta > 0).toBe(seat % 2 === winners);
    }
    const games = await t.run((ctx) => ctx.db.query('games').collect());
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ rated: true, endReason: 'normal', winner: winners });
  });

  it('a player who abandons a rated game takes the loss, and their partner keeps their rating', async () => {
    const t = newBackend();
    const { players, c } = await ratedTable(t);
    await players[0].as.mutation(api.tables.start, { code: c });
    await keepAlive(t, c, 2 * RECONNECT_GRACE_MS, [players[0], players[1], players[3]]); // Cvita (seat 2) drops
    const w = await players[0].as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('finished');
    expect(w?.result?.winner).toBe(1);
    const [ana, bruno, cvita] = await Promise.all(players.slice(0, 3).map((p) => p.as.query(api.ratings.mine, {})));
    expect(cvita!.history[0].delta).toBeLessThan(0);
    expect(bruno!.history[0].delta).toBeGreaterThan(0);
    expect(ana).toBeNull(); // the partner left behind is not rated
    expect((await t.run((ctx) => ctx.db.query('games').collect()))[0]).toMatchObject({ endReason: 'abandoned', rated: true });
  });

  it('leaving a rated game in progress abandons it too', async () => {
    const t = newBackend();
    const { players, c } = await ratedTable(t);
    await players[0].as.mutation(api.tables.start, { code: c });
    await players[1].as.mutation(api.tables.leave, { code: c });
    const w = await players[0].as.query(api.tables.watch, { code: c });
    expect(w).toMatchObject({ status: 'finished', result: { winner: 0 } });
  });
});

describe('unrated games', () => {
  it('are recorded as games but change no rating', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host', { isAnonymous: false });
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    await nearTheEnd(t);
    await keepAlive(t, c, 60 * 60_000, [host], 5000);
    expect((await host.as.query(api.tables.watch, { code: c }))?.status).toBe('finished');
    expect(await t.run((ctx) => ctx.db.query('games').collect())).toMatchObject([{ rated: false, endReason: 'normal' }]);
    expect(await host.as.query(api.ratings.mine, {})).toBeNull();
  });
});

describe('leaderboard', () => {
  it('is public, sorted by display rating, and lists only established players by name', async () => {
    const t = newBackend();
    const names = ['Low', 'High', 'New'];
    await t.run(async (ctx) => {
      for (const [i, name] of names.entries()) {
        const userId = await ctx.db.insert('users', { name, isAnonymous: false });
        const r = [{ mu: 22, sigma: 3 }, { mu: 30, sigma: 3 }, { mu: 40, sigma: 3 }][i];
        const games = name === 'New' ? 2 : 40;
        await ctx.db.insert('ratings', { userId, ...r, gamesPlayed: games, lastPlayedAt: 0, display: r.mu - 3 * r.sigma });
      }
    });
    const board = await t.query(api.ratings.leaderboard, {});
    expect(board.map((r) => [r.rank, r.name])).toEqual([
      [1, 'High'],
      [2, 'Low'],
    ]);
    expect(Object.keys(board[0]).sort()).toEqual(['games', 'name', 'rank', 'rating']);
  });
});
