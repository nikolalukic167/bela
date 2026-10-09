// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DELETED_NAME, RECONNECT_GRACE_MS } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

type Player = Awaited<ReturnType<typeof signUp>>;

async function ratedGame(t: Backend) {
  const players: Player[] = [];
  for (const n of ['Ana', 'Bruno', 'Cvita', 'Duje']) players.push(await signUp(t, n, { isAnonymous: false }));
  const c = await players[0].as.mutation(api.tables.create, { options: OPTIONS, rated: true });
  for (const p of players.slice(1)) await p.as.mutation(api.tables.join, { code: c });
  await players[0].as.mutation(api.tables.start, { code: c });
  return { players, c };
}

/** Gives a user the rows Convex Auth would create for a username account. */
async function authRows(t: Backend, userId: Id<'users'>, email: string) {
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { email });
    const accountId = await ctx.db.insert('authAccounts', { userId, provider: 'password', providerAccountId: email, secret: 'hash' });
    await ctx.db.insert('authVerificationCodes', { accountId, provider: 'password', code: 'c0de', expirationTime: Date.now() + 1000 });
    const sessionId = await ctx.db.insert('authSessions', { userId, expirationTime: Date.now() + 1000 });
    await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: Date.now() + 1000 });
  });
}

/** Every stored row, as JSON text, so a test can check that a name or email appears nowhere. */
const everything = (t: Backend) =>
  t.run(async (ctx) => {
    const names = [
      'users', 'tables', 'tableStates', 'actions', 'presence', 'games', 'ratings', 'ratingHistory', 'memberships',
      'blocks', 'mutes', 'reports', 'moderationLog',
      'authAccounts', 'authSessions', 'authRefreshTokens', 'authVerificationCodes', 'authVerifiers', 'authRateLimits',
    ] as const;
    const out: Record<string, unknown[]> = {};
    for (const n of names) out[n] = await ctx.db.query(n).collect();
    return out;
  });

describe('users.deleteAccount', () => {
  it('leaves nothing that identifies the player, and the session stops working', async () => {
    const t = newBackend();
    const { players, c } = await ratedGame(t);
    const cvita = players[2];
    await authRows(t, cvita.userId, 'cvita@users.karte.invalid');
    await cvita.as.mutation(api.moderation.block, { code: c, seat: 0 });
    await cvita.as.mutation(api.moderation.mute, { code: c, seat: 1, muted: true });
    await cvita.as.mutation(api.moderation.report, { code: c, seat: 3, reason: 'name' });
    await players[0].as.mutation(api.moderation.report, { code: c, seat: 2, reason: 'name' });

    await cvita.as.mutation(api.users.deleteAccount, {});

    const all = await everything(t);
    const text = JSON.stringify(all);
    expect(text).not.toContain('Cvita');
    expect(text).not.toContain('cvita@');
    const me = all.users.find((u) => (u as { _id: string })._id === cvita.userId);
    expect(Object.keys(me as object).sort()).toEqual(['_creationTime', '_id', 'deletedAt', 'name']);
    expect((me as { name: string }).name).toBe(DELETED_NAME);
    const refs = (rows: unknown[], ...fields: string[]) =>
      rows.filter((r) => fields.some((f) => (r as Record<string, unknown>)[f] === cvita.userId));
    expect(refs(all.authAccounts, 'userId')).toEqual([]);
    expect(refs(all.authSessions, 'userId')).toEqual([]);
    expect(all.authRefreshTokens).toEqual([]);
    expect(all.authVerificationCodes).toEqual([]);
    expect(refs(all.ratings, 'userId')).toEqual([]);
    expect(refs(all.ratingHistory, 'userId')).toEqual([]);
    expect(refs(all.memberships, 'userId')).toEqual([]);
    expect(refs(all.presence, 'userId')).toEqual([]);
    expect(refs(all.blocks, 'userId', 'blockedId')).toEqual([]);
    expect(refs(all.mutes, 'userId', 'mutedId')).toEqual([]);
    expect(refs(all.reports, 'reporterId', 'reportedId')).toEqual([]);

    // A token issued before the deletion is no longer accepted.
    expect(await cvita.as.query(api.users.me, {})).toBeNull();
    await failsWith(cvita.as.mutation(api.users.rename, { name: 'Again' }), 'UNAUTHENTICATED');
    await failsWith(cvita.as.mutation(api.tables.create, { options: OPTIONS }), 'UNAUTHENTICATED');
  });

  it('abandons a running rated game: the others keep their rating changes and their history', async () => {
    const t = newBackend();
    const { players, c } = await ratedGame(t);
    await players[2].as.mutation(api.users.deleteAccount, {});
    const w = await players[0].as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('finished');
    expect(w?.result?.winner).toBe(1); // Cvita's team (seat 2) loses
    expect(w?.seats[2].name).toBe(DELETED_NAME);
    const games = await t.run((ctx) => ctx.db.query('games').collect());
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ rated: true, endReason: 'abandoned', abandonedBy: players[2].userId });
    expect((await players[1].as.query(api.ratings.mine, {}))?.games).toBe(1);
    const history = await players[0].as.query(api.tables.history, {});
    expect(history).toHaveLength(1);
    expect(history[0].players).toContain(DELETED_NAME);

    // Bruno deletes too, later: his rating and history go, Ana's record of the game stays.
    await players[1].as.mutation(api.users.deleteAccount, {});
    const again = await players[0].as.query(api.tables.history, {});
    expect(again).toHaveLength(1);
    expect(again[0].players.filter((n) => n === DELETED_NAME)).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(1);
  });

  it('a bot takes over in a running friendly game, under a neutral name, and play goes on', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    const c = await ana.as.mutation(api.tables.create, { options: OPTIONS });
    await bruno.as.mutation(api.tables.join, { code: c });
    await ana.as.mutation(api.tables.start, { code: c });
    await bruno.as.mutation(api.users.deleteAccount, {});
    const w = await ana.as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('playing');
    expect(w?.seats[1]).toMatchObject({ kind: 'bot', name: DELETED_NAME, away: false });
    expect(JSON.stringify(await everything(t))).not.toContain('Bruno');
    await elapse(t, RECONNECT_GRACE_MS, async () => {
      await ana.as.mutation(api.tables.heartbeat, { code: c });
    }, 5000);
    expect((await ana.as.query(api.tables.watch, { code: c }))?.status).toBe('playing');
  });

  it('frees a lobby seat, hands the table to another player, and closes a table left empty', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    const shared = await ana.as.mutation(api.tables.create, { options: OPTIONS });
    await bruno.as.mutation(api.tables.join, { code: shared });
    const alone = await ana.as.mutation(api.tables.create, { options: OPTIONS });
    await ana.as.mutation(api.users.deleteAccount, {});
    const w = await bruno.as.query(api.tables.watch, { code: shared });
    expect(w?.isHost).toBe(true);
    expect(w?.seats.map((s) => s.kind)).toEqual(['empty', 'user', 'empty', 'empty']);
    expect(await bruno.as.query(api.tables.watch, { code: alone })).toBeNull();
  });

  it('needs a signed-in user', async () => {
    const t = newBackend();
    await failsWith(t.mutation(api.users.deleteAccount, {}), 'UNAUTHENTICATED');
  });
});
