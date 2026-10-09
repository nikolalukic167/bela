// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HEARTBEAT_MS, RECONNECT_GRACE_MS, TURN_TIMEOUT_MS } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Player = Awaited<ReturnType<typeof signUp>>;

async function startedTable() {
  const t = newBackend();
  const host = await signUp(t, 'Host');
  const friend = await signUp(t, 'Friend');
  const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
  await friend.as.mutation(api.tables.join, { code: c });
  await host.as.mutation(api.tables.start, { code: c });
  return { t, host, friend, c };
}

/** Lets `ms` pass while the given players keep their tabs open (heartbeat on schedule). */
const passTime = (t: Backend, c: string, ms: number, present: Player[] = []) =>
  elapse(t, ms, async (at) => {
    if (at % HEARTBEAT_MS === 0) for (const p of present) await p.as.mutation(api.tables.heartbeat, { code: c });
  });

const version = (t: Backend) => t.run(async (ctx) => (await ctx.db.query('tableStates').first())!.version);
const seatsOf = async (p: Player, c: string) => (await p.as.query(api.tables.watch, { code: c }))!.seats;

describe('reconnect', () => {
  it('keeps the seats of players whose tabs stay open', async () => {
    const { t, host, friend, c } = await startedTable();
    await passTime(t, c, 3 * RECONNECT_GRACE_MS, [host, friend]);
    expect((await seatsOf(host, c)).map((s) => [s.kind, s.away])).toEqual([
      ['user', false],
      ['user', false],
      ['bot', false],
      ['bot', false],
    ]);
  });

  it('a bot stands in for a player who drops, so the others can play on', async () => {
    const { t, host, c } = await startedTable();
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }); // now the friend's turn
    await passTime(t, c, RECONNECT_GRACE_MS - HEARTBEAT_MS, [host]);
    expect((await seatsOf(host, c))[1].kind).toBe('user'); // still within the grace period
    const before = await version(t);

    await passTime(t, c, 2 * HEARTBEAT_MS, [host]);
    const seat = (await seatsOf(host, c))[1];
    expect(seat).toMatchObject({ kind: 'bot', name: 'Friend', away: true });
    expect(await version(t)).toBeGreaterThan(before); // the stand-in took the friend's turn
  });

  it('the returning player takes the seat back with the first heartbeat', async () => {
    const { t, host, friend, c } = await startedTable();
    await passTime(t, c, 2 * RECONNECT_GRACE_MS, [host]);
    const away = await friend.as.query(api.tables.watch, { code: c });
    expect(away?.mySeat).toBe(1); // still their seat: no flash of the lobby while reconnecting
    expect(away?.view?.seat).toBe(1);

    await friend.as.mutation(api.tables.heartbeat, { code: c });
    expect((await seatsOf(host, c))[1]).toMatchObject({ kind: 'user', name: 'Friend', isMe: false, away: false });
    // And they are timed out again if they drop a second time.
    await passTime(t, c, 2 * RECONNECT_GRACE_MS, [host]);
    expect((await seatsOf(host, c))[1].away).toBe(true);
  });

  it('a table where every human is away waits instead of playing on, and resumes on return', async () => {
    const { t, host, friend, c } = await startedTable();
    await passTime(t, c, 2 * RECONNECT_GRACE_MS);
    expect((await seatsOf(host, c)).slice(0, 2).map((s) => s.away)).toEqual([true, true]);
    const paused = await version(t);
    await passTime(t, c, 5 * RECONNECT_GRACE_MS);
    expect(await version(t)).toBe(paused);

    await friend.as.mutation(api.tables.heartbeat, { code: c });
    // Play resumes: the host's stand-in moves, or the friend's own turn timer runs out.
    await passTime(t, c, TURN_TIMEOUT_MS + 10_000, [friend]);
    expect(await version(t)).toBeGreaterThan(paused);
    expect((await seatsOf(host, c))[0].away).toBe(true);
  });

  it('leaving while away hands the seat to the bot for good', async () => {
    const { t, host, friend, c } = await startedTable();
    await passTime(t, c, 2 * RECONNECT_GRACE_MS, [host]);
    await friend.as.mutation(api.tables.leave, { code: c });
    await friend.as.mutation(api.tables.heartbeat, { code: c });
    expect((await seatsOf(host, c))[1]).toMatchObject({ kind: 'bot', away: false });
    expect(await friend.as.query(api.tables.mine, {})).toEqual([]);
  });

  it('heartbeats from outsiders or for lobbies change nothing, and need a signed-in user', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.heartbeat, { code: c });
    await (await signUp(t, 'Outsider')).as.mutation(api.tables.heartbeat, { code: c });
    expect(await t.run((ctx) => ctx.db.query('presence').collect())).toEqual([]);
    const err = await t.mutation(api.tables.heartbeat, { code: c }).then(() => null, (e) => e);
    expect(err?.data?.code).toBe('UNAUTHENTICATED');
  });

  it('deleting a table removes its presence rows', async () => {
    const { t, host, friend, c } = await startedTable();
    expect(await t.run((ctx) => ctx.db.query('presence').collect())).toHaveLength(2);
    await friend.as.mutation(api.tables.leave, { code: c });
    await host.as.mutation(api.tables.leave, { code: c });
    expect(await t.run((ctx) => ctx.db.query('presence').collect())).toEqual([]);
  });
});
