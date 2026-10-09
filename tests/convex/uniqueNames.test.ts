// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DELETED_NAME, NEUTRAL_NAME } from '../../convex/lib/config';
import { onUserStored } from '../../convex/lib/uniqueNames';
import { newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

/** What Convex Auth does on sign-in: insert (or update) the user, then call our callback in the same mutation. */
async function authStores(t: Backend, provider: 'anonymous' | 'password' | 'google', name: string, existing?: Id<'users'>) {
  return t.run(async (ctx) => {
    const userId = existing ?? (await ctx.db.insert('users', { name, ...(provider === 'anonymous' && { isAnonymous: true }) }));
    if (existing) await ctx.db.patch(existing, { name });
    await onUserStored(ctx, {
      userId,
      existingUserId: existing ?? null,
      type: provider === 'google' ? 'oauth' : 'credentials',
      provider: { id: provider },
    });
    return (await ctx.db.get(userId))!;
  });
}

describe('unique display names', () => {
  it('rename refuses a name someone else has, ignoring case and spacing', async () => {
    const t = newBackend();
    await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    for (const name of ['Ana', 'ana', '  ANA ']) await failsWith(bruno.as.mutation(api.users.rename, { name }), 'NAME_TAKEN');
    expect((await bruno.as.query(api.users.me, {}))?.name).toBe('Bruno');
  });

  it('a refused name does not use up a rename, and changing your own name\'s case is fine', async () => {
    const t = newBackend();
    await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    for (let i = 0; i < 5; i++) await failsWith(bruno.as.mutation(api.users.rename, { name: 'Ana' }), 'NAME_TAKEN');
    await bruno.as.mutation(api.users.rename, { name: 'BRUNO' });
    expect((await bruno.as.query(api.users.me, {}))?.name).toBe('BRUNO');
  });

  it('a renamed player frees their old name', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    await ana.as.mutation(api.users.rename, { name: 'Ana Marija' });
    await bruno.as.mutation(api.users.rename, { name: 'ana' });
  });

  it('guest and username sign-up refuse a taken name with NAME_TAKEN, and nothing is stored', async () => {
    const t = newBackend();
    await signUp(t, 'Ana');
    for (const provider of ['anonymous', 'password'] as const) {
      await failsWith(authStores(t, provider, ' ANA'), 'NAME_TAKEN');
    }
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(1);
    const ok = await authStores(t, 'anonymous', 'Bruno');
    expect(ok.nameKey).toBe('bruno');
  });

  it('Google sign-in keeps the Google name, or takes the first free variant', async () => {
    const t = newBackend();
    await signUp(t, 'Ana Horvat');
    await signUp(t, 'Ana Horvat 2');
    const first = await authStores(t, 'google', 'Ana Horvat');
    expect(first.name).toBe('Ana Horvat 3');
    expect(first.nameKey).toBe('ana horvat 3');
    const free = await authStores(t, 'google', 'Ivo Ivić');
    expect(free.name).toBe('Ivo Ivić');
    // Signing in again keeps their own name rather than colliding with themself.
    expect((await authStores(t, 'google', 'Ivo Ivić', free._id)).name).toBe('Ivo Ivić');
  });

  it('deleted accounts and reset names never block anyone, and nobody can pick them', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    await ana.as.mutation(api.users.deleteAccount, {});
    const bruno = await signUp(t, 'Bruno');
    await bruno.as.mutation(api.users.rename, { name: 'Ana' }); // the deleted Ana's name is free again
    for (const name of [DELETED_NAME, NEUTRAL_NAME, 'igrač']) await failsWith(bruno.as.mutation(api.users.rename, { name }), 'NAME_TAKEN');
  });

  it('an admin name reset frees the old name and gives a name that blocks nobody', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    const bruno = await signUp(t, 'Bruno');
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const c = await ana.as.mutation(api.tables.create, { options: OPTIONS });
    await bruno.as.mutation(api.tables.join, { code: c });
    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'name' });
    const [r] = await admin.as.query(api.moderation.reports, { status: 'open' });
    await admin.as.mutation(api.moderation.resolve, { reportId: r.id, action: 'resetName' });
    const reset = await t.run((ctx) => ctx.db.get(bruno.userId));
    expect(reset).toMatchObject({ name: NEUTRAL_NAME });
    expect(reset?.nameKey).toBeUndefined();
    const cila = await signUp(t, 'Cila');
    await cila.as.mutation(api.users.rename, { name: 'Bruno' });
  });

  it('suggestName offers the first free variant, and null when the name is free', async () => {
    const t = newBackend();
    await signUp(t, 'Ana');
    await signUp(t, 'Ana 2');
    expect(await t.query(api.users.suggestName, { name: ' ana ' })).toBe('ana 3');
    expect(await t.query(api.users.suggestName, { name: 'Bruno' })).toBeNull();
  });

  it('backfill gives existing players a name key; later duplicates get a free variant', async () => {
    const t = newBackend();
    const ids = await t.run(async (ctx) => [
      await ctx.db.insert('users', { name: 'Ana' }),
      await ctx.db.insert('users', { name: 'ana' }),
      await ctx.db.insert('users', { name: 'Bot Ana', isBot: true, isTest: true }),
      await ctx.db.insert('users', { name: DELETED_NAME, deletedAt: 1 }),
      await ctx.db.insert('users', { name: NEUTRAL_NAME }),
    ]);
    expect(await t.mutation(internal.users.backfillNameKeys, {})).toMatchObject({ updated: 2, renamed: 1, isDone: true });
    const rows = await t.run(async (ctx) => Promise.all(ids.map((id) => ctx.db.get(id))));
    expect(rows.map((r) => [r?.name, r?.nameKey])).toEqual([
      ['Ana', 'ana'],
      ['ana 2', 'ana 2'],
      ['Bot Ana', undefined],
      [DELETED_NAME, undefined],
      [NEUTRAL_NAME, undefined],
    ]);
    expect(await t.mutation(internal.users.backfillNameKeys, {})).toMatchObject({ updated: 0, renamed: 0, isDone: true });
  });
});
