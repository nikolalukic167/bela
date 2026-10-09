// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { INVITE_TTL_MS, PUBLIC_LOBBY_SIZE } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const errCode = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as { data?: { code?: string } } | null)?.data?.code;

describe('public lobby (architecture §14.6)', () => {
  it('lists public lobbies with a free seat: what a joiner needs, and no user ids', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Hostess', { isAnonymous: false });
    const visitor = await signUp(t, 'Visitor');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true, timerProfile: 'quick' });
    const list = await visitor.as.query(api.tables.publicLobby, {});
    expect(list).toEqual([
      {
        code: c,
        host: 'Hostess',
        target: 501,
        direction: 'ccw',
        belaAlwaysCounts: false,
        tie: 'hangs',
        botLevel: 'medium',
        timerProfile: 'quick',
        rated: false,
        seatsTaken: 1,
        createdAt: Date.now(),
      },
    ]);
    expect(JSON.stringify(list)).not.toContain(host.userId);
    expect((await host.as.query(api.tables.watch, { code: c }))?.isPublic).toBe(true);
  });

  it('a visitor joins from the list without being given a code', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const visitor = await signUp(t, 'Visitor');
    await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true });
    const [entry] = await visitor.as.query(api.tables.publicLobby, {});
    expect(await visitor.as.mutation(api.tables.join, { code: entry.code })).toBe(entry.code);
    expect((await host.as.query(api.tables.watch, { code: entry.code }))?.seats.map((s) => s.kind)).toEqual(['user', 'user', 'empty', 'empty']);
    expect((await visitor.as.query(api.tables.publicLobby, {}))[0].seatsTaken).toBe(2);
  });

  it('never lists private, full, started, expired or test tables', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const visitor = await signUp(t, 'Visitor');
    const host = await signUp(t, 'Host');
    await host.as.mutation(api.tables.create, { options: OPTIONS }); // private (the default)
    const full = await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true });
    for (const n of ['A', 'B', 'C']) await (await signUp(t, n)).as.mutation(api.tables.join, { code: full });
    const started = await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true });
    await host.as.mutation(api.tables.start, { code: started });
    await admin.as.mutation(api.admin.seed, {}); // test tables, one an open lobby
    await t.run(async (ctx) => {
      for (const table of await ctx.db.query('tables').collect()) if (table.isTest) await ctx.db.patch(table._id, { isPublic: true });
    });
    expect(await visitor.as.query(api.tables.publicLobby, {})).toEqual([]);
    const fresh = await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true });
    expect((await visitor.as.query(api.tables.publicLobby, {})).map((x) => x.code)).toEqual([fresh]);
    vi.advanceTimersByTime(INVITE_TTL_MS + 1);
    expect(await visitor.as.query(api.tables.publicLobby, {})).toEqual([]);
  });

  it('is newest first and capped', async () => {
    const t = newBackend();
    const visitor = await signUp(t, 'Visitor');
    const codes: string[] = [];
    for (let h = 0; h * 5 < PUBLIC_LOBBY_SIZE + 5; h++) {
      const host = await signUp(t, `Host${h}`);
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        codes.push(await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true }));
      }
    }
    const list = await visitor.as.query(api.tables.publicLobby, {});
    expect(list).toHaveLength(PUBLIC_LOBBY_SIZE);
    expect(list.map((x) => x.code)).toEqual(codes.reverse().slice(0, PUBLIC_LOBBY_SIZE));
  });

  it('a rated public table only seats account holders', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host', { isAnonymous: false });
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS, isPublic: true, rated: true });
    const guest = await signUp(t, 'Guest');
    const [entry] = await guest.as.query(api.tables.publicLobby, {});
    expect(entry.rated).toBe(true);
    expect(await errCode(guest.as.mutation(api.tables.join, { code: c }))).toBe('RATED_NEEDS_ACCOUNTS');
    const member = await signUp(t, 'Member', { isAnonymous: false });
    expect(await member.as.mutation(api.tables.join, { code: c })).toBe(c);
  });

  it('requires a signed-in user', async () => {
    const t = newBackend();
    expect(await errCode(t.query(api.tables.publicLobby, {}))).toBe('UNAUTHENTICATED');
  });
});
