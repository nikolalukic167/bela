// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { elapse, newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

describe('lobby', () => {
  it('creates a table, lets a friend join by code and the host start with bots in the rest', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    expect(c).toMatch(/^[A-Z2-9]{8}$/);
    await friend.as.mutation(api.tables.join, { code: c.toLowerCase() });
    const lobby = await host.as.query(api.tables.watch, { code: c });
    expect(lobby?.seats.map((s) => s.kind)).toEqual(['user', 'user', 'empty', 'empty']);
    expect(lobby?.mySeat).toBe(0);
    expect(lobby?.view).toBeNull();

    await host.as.mutation(api.tables.start, { code: c });
    const playing = await host.as.query(api.tables.watch, { code: c });
    expect(playing?.status).toBe('playing');
    expect(playing?.seats.map((s) => s.kind)).toEqual(['user', 'user', 'bot', 'bot']);
    expect(playing?.view?.hand).toHaveLength(6);
  });

  it('only the host can start, add bots or clear seats', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await friend.as.mutation(api.tables.join, { code: c });
    await failsWith(friend.as.mutation(api.tables.start, { code: c }), 'FORBIDDEN');
    await failsWith(friend.as.mutation(api.tables.addBot, { code: c }), 'FORBIDDEN');
    await failsWith(friend.as.mutation(api.tables.clearSeat, { code: c, seat: 0 }), 'FORBIDDEN');
    await host.as.mutation(api.tables.addBot, { code: c });
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.seats[2].kind).toBe('bot');
    await host.as.mutation(api.tables.clearSeat, { code: c, seat: 2 });
    expect((await host.as.query(api.tables.watch, { code: c }))?.seats[2].kind).toBe('empty');
  });

  it('is full after four players and rejects a fifth', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    for (let i = 0; i < 3; i++) await (await signUp(t, `P${i}`)).as.mutation(api.tables.join, { code: c });
    await failsWith((await signUp(t, 'Late')).as.mutation(api.tables.join, { code: c }), 'TABLE_FULL');
  });

  it('rejoining is idempotent and an unknown code finds nothing', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.join, { code: c });
    expect((await host.as.query(api.tables.watch, { code: c }))?.seats.filter((s) => s.kind === 'user')).toHaveLength(1);
    expect(await host.as.mutation(api.tables.join, { code: 'ZZZZZZZZ' })).toBeNull();
  });

  it('requires a signed-in user', async () => {
    const t = newBackend();
    await failsWith(t.mutation(api.tables.create, { options: OPTIONS }), 'UNAUTHENTICATED');
  });

  it('limits how many unfinished tables one user can hold', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    for (let i = 0; i < 5; i++) await host.as.mutation(api.tables.create, { options: OPTIONS });
    await failsWith(host.as.mutation(api.tables.create, { options: OPTIONS }), 'RATE_LIMITED');
  });

  it('leaving frees a lobby seat, passes the host on and closes an empty table', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await friend.as.mutation(api.tables.join, { code: c });
    await host.as.mutation(api.tables.leave, { code: c });
    const w = await friend.as.query(api.tables.watch, { code: c });
    expect(w?.isHost).toBe(true);
    expect(w?.seats[0].kind).toBe('empty');
    await friend.as.mutation(api.tables.leave, { code: c });
    expect(await friend.as.query(api.tables.watch, { code: c })).toBeNull();
  });
});

describe('playing', () => {
  async function startedTable() {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await friend.as.mutation(api.tables.join, { code: c });
    await host.as.mutation(api.tables.start, { code: c });
    return { t, host, friend, c };
  }

  it('rejects acting out of turn, by outsiders, and with illegal actions', async () => {
    const { t, host, friend, c } = await startedTable();
    const outsider = await signUp(t, 'Outsider');
    // Seat 0 (host) speaks first in trump calling.
    await failsWith(friend.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }), 'NOT_YOUR_TURN');
    await failsWith(outsider.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }), 'FORBIDDEN');
    await failsWith(host.as.mutation(api.tables.act, { code: c, action: { type: 'play', card: { suit: 'hearts', rank: 'A' } } }), 'ILLEGAL_ACTION');
    await failsWith(host.as.mutation(api.tables.act, { code: c, action: { type: 'next' } }), 'ILLEGAL_ACTION');
  });

  it('applies a legal action, then bots answer by themselves via the scheduler', async () => {
    const { t, host, friend, c } = await startedTable();
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    expect((await host.as.query(api.tables.watch, { code: c }))?.view?.isMyTurn).toBe(false);
    // Seat 1 is the friend (human): the game waits for them, no bot acts.
    await elapse(t, 10_000); // bots answer; well inside the reconnect grace period
    const v = (await friend.as.query(api.tables.watch, { code: c }))?.view;
    expect(v?.isMyTurn).toBe(true);
    await friend.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    await elapse(t, 10_000); // bots answer; well inside the reconnect grace period
    // Seats 2 and 3 are bots: by now one of them has called trump (the dealer must).
    const after = (await host.as.query(api.tables.watch, { code: c }))?.view;
    expect(after?.phase).not.toBe('trump');
  });

  it('only returns the caller\'s own seat view, never state, seed or other hands', async () => {
    const { t, host, friend, c } = await startedTable();
    const hostW = await host.as.query(api.tables.watch, { code: c });
    const friendW = await friend.as.query(api.tables.watch, { code: c });
    expect(Object.keys(hostW!).sort()).toEqual(['code', 'codeExpiresAt', 'deadline', 'isHost', 'isPublic', 'isTest', 'mySeat', 'options', 'rated', 'rematchCode', 'result', 'seats', 'seed', 'spectating', 'status', 'timerProfile', 'view']);
    const seed = await t.run(async (ctx) => (await ctx.db.query('tableStates').first())!.state.seed as number);
    for (const json of [JSON.stringify(hostW), JSON.stringify(friendW)]) expect(json).not.toContain(`"seed":${seed}`);
    const hostCards = new Set(hostW!.view!.hand.map((x) => `${x.rank}${x.suit}`));
    for (const x of friendW!.view!.hand) expect(hostCards.has(`${x.rank}${x.suit}`)).toBe(false);
    // A bystander gets the seating but no cards.
    const bystander = await signUp(t, 'Bystander');
    const bw = await bystander.as.query(api.tables.watch, { code: c });
    expect(bw?.view).toBeNull();
  });

  it('a stale scheduled step is a no-op', async () => {
    const { t, host, c } = await startedTable();
    const tableId = await t.run(async (ctx) => (await ctx.db.query('tables').first())!._id);
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }); // version 0 -> 1
    await t.mutation((await import('../../convex/_generated/api')).internal.tables.step, { tableId, version: 0 });
    const version = await t.run(async (ctx) => (await ctx.db.query('tableStates').first())!.version);
    expect(version).toBe(1);
  });

  it('logs every action append-only with consecutive sequence numbers', async () => {
    const { t, host, c } = await startedTable();
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    const log = await t.run((ctx) => ctx.db.query('actions').collect());
    expect(log.map((a) => a.seq)).toEqual([0]);
    expect(log[0]).toMatchObject({ seat: 0, action: { type: 'pass' } });
  });

  it('a player who leaves mid-game is replaced by a bot and the others carry on', async () => {
    const { t, host, friend, c } = await startedTable();
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    await friend.as.mutation(api.tables.leave, { code: c });
    await elapse(t, 10_000); // bots answer; well inside the reconnect grace period
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.seats[1].kind).toBe('bot');
    expect(w?.view?.phase).not.toBe('trump');
  });

  it('lists my unfinished tables', async () => {
    const { host } = await startedTable();
    const mine = await host.as.query(api.tables.mine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: 'playing', players: 2 });
  });
});

describe('history', () => {
  async function finishedTable(patch: { isTest?: boolean } = {}) {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const friend = await signUp(t, 'Friend');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await friend.as.mutation(api.tables.join, { code: c });
    await host.as.mutation(api.tables.start, { code: c });
    await t.run(async (ctx) => {
      const table = await ctx.db.query('tables').withIndex('by_code', (q) => q.eq('code', c)).unique();
      await ctx.db.patch(table!._id, { status: 'finished', result: { scores: [520, 410], winner: 0 }, finishedAt: 5000, ...patch });
    });
    return { t, host, friend, c };
  }

  it('lists a finished match from each player\'s own side, with partner first', async () => {
    const { host, friend, c } = await finishedTable();
    const [h] = await host.as.query(api.tables.history, {});
    expect(h).toMatchObject({ id: `online:${c}`, source: 'online', target: 501, scores: [520, 410], won: true, playedAt: 5000 });
    expect(h.players).toHaveLength(3);
    expect(h.players).not.toContain('Host');
    const [f] = await friend.as.query(api.tables.history, {});
    expect(f).toMatchObject({ scores: [410, 520], won: false });
    expect(f.players[0]).not.toBe('Host'); // Friend's partner is a bot, the host is an opponent
    expect(f.players).toContain('Host');
  });

  it('leaves out unfinished tables, test tables and other people\'s games', async () => {
    const { t, host } = await finishedTable({ isTest: true });
    expect(await host.as.query(api.tables.history, {})).toEqual([]);
    const stranger = await signUp(t, 'Stranger');
    expect(await stranger.as.query(api.tables.history, {})).toEqual([]);
    const live = await signUp(t, 'Live');
    await live.as.mutation(api.tables.create, { options: OPTIONS });
    expect(await live.as.query(api.tables.history, {})).toEqual([]);
  });

  it('requires a signed-in user', async () => {
    const { t } = await finishedTable();
    await failsWith(t.query(api.tables.history, {}), 'UNAUTHENTICATED');
  });

  it('never exposes the game state', async () => {
    const { host } = await finishedTable();
    const json = JSON.stringify(await host.as.query(api.tables.history, {}));
    for (const secret of ['seed', 'hand', 'talon', 'deck', 'actions']) expect(json).not.toContain(secret);
  });
});
