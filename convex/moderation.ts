// Block, mute and report (architecture §9.4). Players act on a seat at a table they share;
// admins review reports in the admin panel. Every step except muting is logged.
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireAdmin, requireUser } from './lib/auth';
import { NEUTRAL_NAME, REPORT_LIMIT, REPORT_WINDOW_MS } from './lib/config';
import { TableError } from './lib/errors';
import { humanAt, seatTarget } from './lib/moderationLogic';
import type { Seat } from './lib/tableLogic';
import { findTable } from './tables';

const seatArgs = { code: v.string(), seat: v.number() };
const reasonValidator = v.union(v.literal('name'), v.literal('abuse'), v.literal('cheating'), v.literal('other'));

/** The human at `seat` of a table the caller sits at. */
async function target(ctx: QueryCtx, user: Doc<'users'>, code: string, seat: number): Promise<{ table: Doc<'tables'>; userId: Id<'users'> }> {
  const table = await findTable(ctx, code, user);
  if (!table) throw new TableError('NOT_FOUND');
  return { table, userId: seatTarget(table.seats as Seat[], seat, user._id) };
}

async function logAction(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  action: Doc<'moderationLog'>['action'],
  targetId?: Id<'users'>,
  reportId?: Id<'reports'>,
) {
  await ctx.db.insert('moderationLog', { actorId, action, targetId, reportId, at: Date.now() });
}

const blockRow = (ctx: QueryCtx, userId: Id<'users'>, blockedId: Id<'users'>) =>
  ctx.db.query('blocks').withIndex('by_user', (q) => q.eq('userId', userId).eq('blockedId', blockedId)).unique();
const muteRow = (ctx: QueryCtx, userId: Id<'users'>, mutedId: Id<'users'>) =>
  ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', userId).eq('mutedId', mutedId)).unique();

// ---------- players ----------

export const block = mutation({
  args: seatArgs,
  handler: async (ctx, { code, seat }) => {
    const user = await requireUser(ctx);
    const { userId } = await target(ctx, user, code, seat);
    if (await blockRow(ctx, user._id, userId)) return;
    await ctx.db.insert('blocks', { userId: user._id, blockedId: userId, createdAt: Date.now() });
    await logAction(ctx, user._id, 'block', userId);
  },
});

/** Takes an id from the caller's own `lists`; it only ever removes the caller's own row. */
export const unblock = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await requireUser(ctx);
    const row = await blockRow(ctx, user._id, userId);
    if (!row) return;
    await ctx.db.delete(row._id);
    await logAction(ctx, user._id, 'unblock', userId);
  },
});

/** Mutes (or, with `muted: false`, unmutes) the player at a seat. */
export const mute = mutation({
  args: { ...seatArgs, muted: v.boolean() },
  handler: async (ctx, { code, seat, muted }) => {
    const user = await requireUser(ctx);
    const { userId } = await target(ctx, user, code, seat);
    const row = await muteRow(ctx, user._id, userId);
    if (muted && !row) await ctx.db.insert('mutes', { userId: user._id, mutedId: userId, createdAt: Date.now() });
    if (!muted && row) await ctx.db.delete(row._id);
  },
});

export const unmute = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await requireUser(ctx);
    const row = await muteRow(ctx, user._id, userId);
    if (row) await ctx.db.delete(row._id);
  },
});

/**
 * Seats at this table whose player the caller has muted. The table page hides emotes and
 * quick phrases from these seats; nothing changes for anyone else.
 */
export const mutedSeats = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await findTable(ctx, code, user);
    if (!table) return [];
    const muted = new Set((await ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()).map((m) => m.mutedId));
    const seats = table.seats as Seat[];
    return seats.flatMap((_, seat) => {
      const id = humanAt(seats, seat);
      return id && muted.has(id) ? [seat] : [];
    });
  },
});

/** The caller's blocked and muted players, for the account page. */
export const lists = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const named = async (ids: Id<'users'>[]) => {
      const out = [];
      for (const id of ids) out.push({ userId: id, name: (await ctx.db.get(id))?.name ?? NEUTRAL_NAME });
      return out;
    };
    const blocks = await ctx.db.query('blocks').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
    const mutes = await ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
    return { blocked: await named(blocks.map((b) => b.blockedId)), muted: await named(mutes.map((m) => m.mutedId)) };
  },
});

export const report = mutation({
  args: { ...seatArgs, reason: reasonValidator },
  handler: async (ctx, { code, seat, reason }) => {
    const user = await requireUser(ctx);
    const { table, userId } = await target(ctx, user, code, seat);
    const now = Date.now();
    const recent = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', user._id).gt('createdAt', now - REPORT_WINDOW_MS))
      .collect();
    // One open report per player is enough for an admin to look; repeats are not news.
    const open = await ctx.db.query('reports').withIndex('by_reported', (q) => q.eq('reportedId', userId)).collect();
    if (open.some((r) => r.reporterId === user._id && r.status === 'open')) return;
    if (recent.length >= REPORT_LIMIT) throw new TableError('RATE_LIMITED');
    const reportId = await ctx.db.insert('reports', { reporterId: user._id, reportedId: userId, reason, tableCode: table.code, status: 'open', createdAt: now });
    await logAction(ctx, user._id, 'report', userId, reportId);
  },
});

// ---------- admins ----------

const nameOf = async (ctx: QueryCtx, id: Id<'users'> | undefined) => (id ? ((await ctx.db.get(id))?.name ?? NEUTRAL_NAME) : null);

export const reports = query({
  args: { status: v.union(v.literal('open'), v.literal('resolved')) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query('reports').withIndex('by_status', (q) => q.eq('status', status)).order('desc').take(100);
    const out = [];
    for (const r of rows) {
      out.push({
        id: r._id,
        reporter: await nameOf(ctx, r.reporterId),
        reported: await nameOf(ctx, r.reportedId),
        reportedId: r.reportedId,
        reason: r.reason,
        tableCode: r.tableCode ?? null,
        status: r.status,
        resolution: r.resolution ?? null,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

/** Closes a report. `resetName` also gives the reported player a neutral name. */
export const resolve = mutation({
  args: { reportId: v.id('reports'), action: v.union(v.literal('dismiss'), v.literal('resetName')) },
  handler: async (ctx, { reportId, action }) => {
    const admin = await requireAdmin(ctx);
    const r = await ctx.db.get(reportId);
    if (!r || r.status !== 'open') throw new TableError('WRONG_STATE');
    // The neutral name has no key: it frees the old name and blocks nobody.
    if (action === 'resetName') await ctx.db.patch(r.reportedId, { name: NEUTRAL_NAME, nameKey: undefined });
    await ctx.db.patch(r._id, { status: 'resolved', resolution: action });
    await logAction(ctx, admin._id, action, r.reportedId, r._id);
  },
});

/** The newest moderation actions. */
export const log = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query('moderationLog').withIndex('by_at').order('desc').take(100);
    const out = [];
    for (const l of rows) out.push({ id: l._id, action: l.action, actor: await nameOf(ctx, l.actorId), target: await nameOf(ctx, l.targetId), at: l.at });
    return out;
  },
});
