// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { CHAT_BURST, CHAT_TTL_MS, CHAT_WINDOW_MS } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

async function lobby(rated = false) {
  const t = newBackend();
  const ana = await signUp(t, 'Ana');
  const bruno = await signUp(t, 'Bruno');
  const code = await ana.as.mutation(api.tables.create, { options: OPTIONS, rated });
  await bruno.as.mutation(api.tables.join, { code });
  return { t, ana, bruno, code };
}

describe('chat', () => {
  it('delivers a quick phrase to everyone at the table, with seat and name', async () => {
    const { ana, bruno, code } = await lobby();
    await ana.as.mutation(api.chat.send, { code, phrase: 'hello' });
    const list = await bruno.as.query(api.chat.list, { code });
    expect(list).toMatchObject([{ seat: 0, name: 'Ana', phrase: 'hello', text: null }]);
  });

  it('rejects phrases outside the fixed list', async () => {
    const { ana, code } = await lobby();
    expect(await errCode(ana.as.mutation(api.chat.send, { code, phrase: 'I hold the J of hearts' }))).toBe('INVALID_INPUT');
  });

  it('is for members only, both ways', async () => {
    const { t, ana, code } = await lobby();
    await ana.as.mutation(api.chat.send, { code, phrase: 'hello' });
    const outsider = await signUp(t, 'Eve');
    expect(await errCode(outsider.as.mutation(api.chat.send, { code, phrase: 'hello' }))).toBe('FORBIDDEN');
    expect(await errCode(outsider.as.query(api.chat.list, { code }))).toBe('FORBIDDEN');
  });

  it('allows free text only in the lobby of an unrated table', async () => {
    const { ana, bruno, code } = await lobby();
    await ana.as.mutation(api.chat.send, { code, text: '  idemo   za 5 min ' });
    expect((await bruno.as.query(api.chat.list, { code }))[0]).toMatchObject({ text: 'idemo za 5 min', phrase: null });
    await ana.as.mutation(api.tables.start, { code });
    expect(await errCode(ana.as.mutation(api.chat.send, { code, text: 'imam dečka' }))).toBe('FORBIDDEN');
    await ana.as.mutation(api.chat.send, { code, phrase: 'goodLuck' });

    const rated = await lobby(true);
    expect(await errCode(rated.ana.as.mutation(api.chat.send, { code: rated.code, text: 'bok' }))).toBe('FORBIDDEN');
  });

  it('needs exactly one of phrase or text', async () => {
    const { ana, code } = await lobby();
    expect(await errCode(ana.as.mutation(api.chat.send, { code }))).toBe('INVALID_INPUT');
    expect(await errCode(ana.as.mutation(api.chat.send, { code, phrase: 'hello', text: 'bok' }))).toBe('INVALID_INPUT');
  });

  it(`is rate-limited to ${CHAT_BURST} messages per window per player`, async () => {
    const { ana, bruno, code } = await lobby();
    for (let i = 0; i < CHAT_BURST; i++) await ana.as.mutation(api.chat.send, { code, phrase: 'oops' });
    expect(await errCode(ana.as.mutation(api.chat.send, { code, phrase: 'oops' }))).toBe('CHAT_TOO_FAST');
    await bruno.as.mutation(api.chat.send, { code, phrase: 'oops' }); // others are not affected
    vi.advanceTimersByTime(CHAT_WINDOW_MS);
    await ana.as.mutation(api.chat.send, { code, phrase: 'oops' });
  });

  it('expires entries: hidden after the TTL and deleted by the purge', async () => {
    const { t, ana, bruno, code } = await lobby();
    await ana.as.mutation(api.chat.send, { code, phrase: 'hello' });
    vi.advanceTimersByTime(CHAT_TTL_MS + 1);
    expect(await bruno.as.query(api.chat.list, { code })).toEqual([]);
    await t.mutation(internal.chat.purge, {});
    expect(await t.run(async (ctx) => (await ctx.db.query('chat').collect()).length)).toBe(0);
  });

  it('is switched off by the chat feature flag: sending fails with FEATURE_OFF, reading returns nothing', async () => {
    const { t, ana, bruno, code } = await lobby();
    await ana.as.mutation(api.chat.send, { code, phrase: 'hello' });
    await t.run((ctx) => ctx.db.insert('config', { key: 'chat', on: false }));
    expect(await errCode(ana.as.mutation(api.chat.send, { code, phrase: 'hello' }))).toBe('FEATURE_OFF');
    expect(await bruno.as.query(api.chat.list, { code })).toEqual([]);
  });

  it('hides a muted player from the muter only; the sender is never stopped', async () => {
    const { t, ana, bruno, code } = await lobby();
    const cvita = await signUp(t, 'Cvita');
    await cvita.as.mutation(api.tables.join, { code });
    await bruno.as.mutation(api.moderation.mute, { code, seat: 0, muted: true });
    await ana.as.mutation(api.chat.send, { code, phrase: 'hello' });
    expect(await bruno.as.query(api.chat.list, { code })).toEqual([]);
    expect(await cvita.as.query(api.chat.list, { code })).toHaveLength(1);
    expect(await ana.as.query(api.chat.list, { code })).toHaveLength(1);
  });
});
