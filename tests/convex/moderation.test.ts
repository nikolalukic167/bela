// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { REPORT_LIMIT } from '../../convex/lib/config';
import { newBackend, OPTIONS, signUp, type Backend } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
async function failsWith(p: Promise<unknown>, expected: string) {
  const err = await p.then(() => null, (e) => e);
  expect(code(err)).toBe(expected);
}

/** Ana hosts (seat 0) and Bruno joins (seat 1). */
async function twoAtATable(t: Backend) {
  const ana = await signUp(t, 'Ana');
  const bruno = await signUp(t, 'Bruno');
  const c = await ana.as.mutation(api.tables.create, { options: OPTIONS });
  await bruno.as.mutation(api.tables.join, { code: c });
  return { ana, bruno, c };
}

describe('block', () => {
  it('a blocked player cannot join your tables, and you cannot join theirs', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    await ana.as.mutation(api.moderation.block, { code: c, seat: 1 });
    await bruno.as.mutation(api.tables.leave, { code: c });
    await failsWith(bruno.as.mutation(api.tables.join, { code: c }), 'BLOCKED');

    const brunos = await bruno.as.mutation(api.tables.create, { options: OPTIONS });
    await failsWith(ana.as.mutation(api.tables.join, { code: brunos }), 'BLOCKED');

    // Others are unaffected.
    const cila = await signUp(t, 'Cila');
    await cila.as.mutation(api.tables.join, { code: c });
    await cila.as.mutation(api.tables.join, { code: brunos });
  });

  it('is listed and can be undone', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    await ana.as.mutation(api.moderation.block, { code: c, seat: 1 });
    await ana.as.mutation(api.moderation.block, { code: c, seat: 1 }); // idempotent
    const lists = await ana.as.query(api.moderation.lists, {});
    expect(lists.blocked).toEqual([{ userId: bruno.userId, name: 'Bruno' }]);
    await ana.as.mutation(api.moderation.unblock, { userId: bruno.userId });
    expect((await ana.as.query(api.moderation.lists, {})).blocked).toEqual([]);
    await bruno.as.mutation(api.tables.leave, { code: c });
    await bruno.as.mutation(api.tables.join, { code: c });
  });

  it('targets only another human at a table you sit at', async () => {
    const t = newBackend();
    const { ana, c } = await twoAtATable(t);
    await failsWith(ana.as.mutation(api.moderation.block, { code: c, seat: 0 }), 'INVALID_INPUT'); // yourself
    await failsWith(ana.as.mutation(api.moderation.block, { code: c, seat: 2 }), 'INVALID_INPUT'); // empty
    await ana.as.mutation(api.tables.addBot, { code: c });
    await failsWith(ana.as.mutation(api.moderation.block, { code: c, seat: 2 }), 'INVALID_INPUT'); // bot
    const stranger = await signUp(t, 'Stranger');
    await failsWith(stranger.as.mutation(api.moderation.block, { code: c, seat: 0 }), 'FORBIDDEN');
    await failsWith(t.mutation(api.moderation.block, { code: c, seat: 1 }), 'UNAUTHENTICATED');
  });
});

describe('mute', () => {
  it('lists the muted seats at a table for the caller only', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    expect(await ana.as.query(api.moderation.mutedSeats, { code: c })).toEqual([]);
    await ana.as.mutation(api.moderation.mute, { code: c, seat: 1, muted: true });
    expect(await ana.as.query(api.moderation.mutedSeats, { code: c })).toEqual([1]);
    expect(await bruno.as.query(api.moderation.mutedSeats, { code: c })).toEqual([]);
    expect((await ana.as.query(api.moderation.lists, {})).muted).toEqual([{ userId: bruno.userId, name: 'Bruno' }]);
    await ana.as.mutation(api.moderation.mute, { code: c, seat: 1, muted: false });
    expect(await ana.as.query(api.moderation.mutedSeats, { code: c })).toEqual([]);
    await ana.as.mutation(api.moderation.mute, { code: c, seat: 1, muted: true });
    await ana.as.mutation(api.moderation.unmute, { userId: bruno.userId }); // from the account page
    expect(await ana.as.query(api.moderation.mutedSeats, { code: c })).toEqual([]);
  });

  it('a mute does not keep anyone off a table', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    await ana.as.mutation(api.moderation.mute, { code: c, seat: 1, muted: true });
    await bruno.as.mutation(api.tables.leave, { code: c });
    await bruno.as.mutation(api.tables.join, { code: c });
  });
});

describe('report', () => {
  it('stores user, reason and table in the admin list, and logs it', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'name' });
    const open = await admin.as.query(api.moderation.reports, { status: 'open' });
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ reporter: 'Ana', reported: 'Bruno', reportedId: bruno.userId, reason: 'name', tableCode: c, status: 'open' });
    const log = await admin.as.query(api.moderation.log, {});
    expect(log.map((l) => l.action)).toEqual(['report']);
  });

  it('one open report per player and reporter; at most REPORT_LIMIT a day', async () => {
    const t = newBackend();
    const { ana, c } = await twoAtATable(t);
    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'name' });
    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'abuse' }); // deduplicated
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    expect(await admin.as.query(api.moderation.reports, { status: 'open' })).toHaveLength(1);

    for (let i = 1; i < REPORT_LIMIT; i++) {
      const other = await signUp(t, `P${i}`);
      const oc = await other.as.mutation(api.tables.create, { options: OPTIONS });
      await ana.as.mutation(api.tables.join, { code: oc });
      await ana.as.mutation(api.moderation.report, { code: oc, seat: 0, reason: 'abuse' });
      await ana.as.mutation(api.tables.leave, { code: oc });
    }
    const last = await signUp(t, 'Last');
    const lc = await last.as.mutation(api.tables.create, { options: OPTIONS });
    await ana.as.mutation(api.tables.join, { code: lc });
    await failsWith(ana.as.mutation(api.moderation.report, { code: lc, seat: 0, reason: 'abuse' }), 'RATE_LIMITED');
  });

  it('admins resolve reports: dismiss, or reset an offensive name; each step is logged', async () => {
    const t = newBackend();
    const { ana, bruno, c } = await twoAtATable(t);
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'name' });
    const [r] = await admin.as.query(api.moderation.reports, { status: 'open' });
    await admin.as.mutation(api.moderation.resolve, { reportId: r.id, action: 'resetName' });
    expect((await bruno.as.query(api.users.me, {}))?.name).toBe('Igrač');
    expect(await admin.as.query(api.moderation.reports, { status: 'open' })).toEqual([]);
    expect((await admin.as.query(api.moderation.reports, { status: 'resolved' }))[0]).toMatchObject({ resolution: 'resetName' });
    const log = await admin.as.query(api.moderation.log, {});
    expect(log.map((l) => l.action)).toEqual(['resetName', 'report']); // newest first
    expect(log[0]).toMatchObject({ actor: 'Boss', target: 'Igrač' });

    await ana.as.mutation(api.moderation.report, { code: c, seat: 1, reason: 'abuse' });
    const [r2] = await admin.as.query(api.moderation.reports, { status: 'open' });
    await admin.as.mutation(api.moderation.resolve, { reportId: r2.id, action: 'dismiss' });
    expect((await bruno.as.query(api.users.me, {}))?.name).toBe('Igrač');
  });

  it('the report list and log are NOT_FOUND for non-admins', async () => {
    const t = newBackend();
    const { ana } = await twoAtATable(t);
    await failsWith(ana.as.query(api.moderation.reports, { status: 'open' }), 'NOT_FOUND');
    await failsWith(ana.as.query(api.moderation.log, {}), 'NOT_FOUND');
  });
});
