// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { CODE_LENGTH, INVITE_TTL_MS, LOOKUP_LIMIT } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

async function lobby() {
  const t = newBackend();
  const host = await signUp(t, 'Host');
  const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
  return { t, host, c };
}

describe('invite codes', () => {
  it('are 8+ characters from the unambiguous alphabet', async () => {
    const { c } = await lobby();
    expect(CODE_LENGTH).toBeGreaterThanOrEqual(8);
    expect(c).toMatch(new RegExp(`^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{${CODE_LENGTH}}$`));
  });

  it('stop admitting new players after the invite expires; seated players still get back in', async () => {
    const { t, host, c } = await lobby();
    const early = await signUp(t, 'Early');
    await early.as.mutation(api.tables.join, { code: c });
    vi.advanceTimersByTime(INVITE_TTL_MS + 1);
    expect(await errCode((await signUp(t, 'Late')).as.mutation(api.tables.join, { code: c }))).toBe('CODE_EXPIRED');
    expect(await early.as.mutation(api.tables.join, { code: c })).toBe(c);
    expect(await host.as.query(api.tables.watch, { code: c })).not.toBeNull();
  });

  it('the host can revoke a code: the old one stops working, the new one admits players', async () => {
    const { t, host, c } = await lobby();
    const friend = await signUp(t, 'Friend');
    await friend.as.mutation(api.tables.join, { code: c });
    vi.advanceTimersByTime(INVITE_TTL_MS - 1000);
    const fresh = await host.as.mutation(api.tables.newCode, { code: c });
    expect(fresh).not.toBe(c);
    expect(fresh).toHaveLength(CODE_LENGTH);
    const stranger = await signUp(t, 'Stranger');
    expect(await stranger.as.mutation(api.tables.join, { code: c })).toBeNull();
    expect(await stranger.as.query(api.tables.watch, { code: c })).toBeNull();
    // The new code gets a fresh expiry.
    vi.advanceTimersByTime(2000);
    expect(await stranger.as.mutation(api.tables.join, { code: fresh })).toBe(fresh);
    // Players already seated keep finding the table under the old code (their open page moves on).
    expect((await friend.as.query(api.tables.watch, { code: c }))?.code).toBe(fresh);
  });

  it('only the host can revoke', async () => {
    const { t, c } = await lobby();
    const friend = await signUp(t, 'Friend');
    await friend.as.mutation(api.tables.join, { code: c });
    expect(await errCode(friend.as.mutation(api.tables.newCode, { code: c }))).toBe('FORBIDDEN');
  });

  it('rate-limits lookups of unknown codes per user', async () => {
    const t = newBackend();
    const guesser = await signUp(t, 'Guesser');
    for (let i = 0; i < LOOKUP_LIMIT.burst; i++) expect(await guesser.as.mutation(api.tables.join, { code: `ZZZZZZZ${i}` })).toBeNull();
    expect(await errCode(guesser.as.mutation(api.tables.join, { code: 'ZZZZZZZZ' }))).toBe('RATE_LIMITED');
    // Someone else is not affected.
    expect(await (await signUp(t, 'Other')).as.mutation(api.tables.join, { code: 'ZZZZZZZZ' })).toBeNull();
    vi.advanceTimersByTime(LOOKUP_LIMIT.refillMs);
    expect(await guesser.as.mutation(api.tables.join, { code: 'ZZZZZZZZ' })).toBeNull();
  });

  it('old 6-character tables keep working', async () => {
    const { t, host } = await lobby();
    await t.run(async (ctx) => {
      const table = (await ctx.db.query('tables').first())!;
      await ctx.db.patch(table._id, { code: 'ABC234', codeExpiresAt: undefined });
    });
    const friend = await signUp(t, 'Friend');
    vi.advanceTimersByTime(INVITE_TTL_MS * 3); // tables from before expiry existed never expire
    expect(await friend.as.mutation(api.tables.join, { code: 'abc234' })).toBe('ABC234');
    expect((await host.as.query(api.tables.watch, { code: 'ABC234' }))?.seats[1].kind).toBe('user');
  });
});

