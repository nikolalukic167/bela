// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { RENAME_LIMIT, RENAME_WINDOW_MS } from '../../convex/lib/config';
import { newBackend, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

describe('users.rename', () => {
  it('changes the name, trimmed', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    await ana.as.mutation(api.users.rename, { name: '  Ana  Marija ' });
    expect((await ana.as.query(api.users.me, {}))?.name).toBe('Ana Marija');
  });

  it('refuses offensive names, also in leetspeak', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    await failsWith(ana.as.mutation(api.users.rename, { name: 'kur4c' }), 'NAME_NOT_ALLOWED');
    await failsWith(ana.as.mutation(api.users.rename, { name: 'F.u.c.k' }), 'NAME_NOT_ALLOWED');
    expect((await ana.as.query(api.users.me, {}))?.name).toBe('Ana');
  });

  it(`allows ${RENAME_LIMIT} renames a day, then RENAME_TOO_SOON until the window passes`, async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    for (let i = 0; i < RENAME_LIMIT; i++) await ana.as.mutation(api.users.rename, { name: `Ana ${i}` });
    await failsWith(ana.as.mutation(api.users.rename, { name: 'Ana X' }), 'RENAME_TOO_SOON');
    vi.advanceTimersByTime(RENAME_WINDOW_MS);
    await ana.as.mutation(api.users.rename, { name: 'Ana X' });
    expect((await ana.as.query(api.users.me, {}))?.name).toBe('Ana X');
  });

  it('a refused name does not use up a rename', async () => {
    const t = newBackend();
    const ana = await signUp(t, 'Ana');
    for (let i = 0; i < RENAME_LIMIT; i++) await failsWith(ana.as.mutation(api.users.rename, { name: 'shit' }), 'NAME_NOT_ALLOWED');
    await ana.as.mutation(api.users.rename, { name: 'Ana B' });
  });

  it('needs a signed-in user', async () => {
    const t = newBackend();
    await failsWith(t.mutation(api.users.rename, { name: 'Ana' }), 'UNAUTHENTICATED');
  });
});
