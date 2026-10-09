// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HEARTBEAT_MS, TURN_TIMEOUT_MS } from '../../convex/lib/config';
import { elapse, newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The host alone with three bots; seat 0 (the host) speaks first. */
async function soloTable() {
  const t = newBackend();
  const host = await signUp(t, 'Host');
  const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
  await host.as.mutation(api.tables.start, { code: c });
  // The host keeps the tab open the whole time: only the turn timer is under test.
  const wait = (ms: number, tick = 500) =>
    elapse(t, ms, async (at) => {
      if (at % HEARTBEAT_MS === 0) await host.as.mutation(api.tables.heartbeat, { code: c });
    }, tick);
  return { t, host, c, wait };
}

const log = (t: Backend) => t.run(async (ctx) => (await ctx.db.query('actions').collect()).sort((a, b) => a.seq - b.seq));

describe('turn timer', () => {
  it('shows the deadline to the table while a human is to move', async () => {
    const { host, c } = await soloTable();
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.deadline).toBe(Date.now() + TURN_TIMEOUT_MS);
  });

  it('plays a move for a present player who lets the clock run out, and keeps their seat', async () => {
    const { t, host, c, wait } = await soloTable();
    await wait(TURN_TIMEOUT_MS - 1000);
    expect(await log(t)).toEqual([]);
    await wait(2000);
    const [first] = await log(t);
    expect(first.seat).toBe(0);
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.seats[0]).toMatchObject({ kind: 'user', away: false });
  });

  it('a move in time makes the pending timer a no-op', async () => {
    const { t, host, c, wait } = await soloTable();
    await wait(TURN_TIMEOUT_MS - 5000);
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'call', suit: 'hearts' } });
    await wait(10_000); // the old timer fires in here; bots answer; it's the host's lead again
    const mine = (await log(t)).filter((a) => a.seat === 0);
    expect(mine).toHaveLength(1);
    expect(mine[0].action).toEqual({ type: 'call', suit: 'hearts' });
  });

  it('a hand nobody plays still finishes, and the next one is dealt without anyone pressing "next"', async () => {
    const { host, c, wait } = await soloTable();
    await wait(20 * 60_000, 5000);
    const v = (await host.as.query(api.tables.watch, { code: c }))?.view;
    expect(v?.handNo).toBeGreaterThan(0);
  });
});
