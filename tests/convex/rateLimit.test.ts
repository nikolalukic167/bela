// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { ACT_LIMIT } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

describe('tables.act rate limit', () => {
  it('rejects a burst once the bucket is empty, and lets the player move again after a short pause', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    // Someone who just fired a whole burst at this table.
    await t.run(async (ctx) => {
      const tableId = (await ctx.db.query('tables').first())!._id;
      await ctx.db.insert('rateLimits', { key: `act:${tableId}:${host.userId}`, tokens: 0, at: Date.now() });
    });
    expect(await errCode(host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } }))).toBe('RATE_LIMITED');
    vi.advanceTimersByTime(ACT_LIMIT.refillMs);
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    const log = await t.run((ctx) => ctx.db.query('actions').collect());
    expect(log).toHaveLength(1);
  });

  it('normal play never comes near the limit', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    await host.as.mutation(api.tables.act, { code: c, action: { type: 'pass' } });
    const row = await t.run((ctx) => ctx.db.query('rateLimits').first());
    expect(row!.tokens).toBe(ACT_LIMIT.burst - 1);
  });
});
