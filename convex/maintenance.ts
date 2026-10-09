// Scheduled housekeeping (crons.ts, architecture §12): the quota watch.
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, type QueryCtx } from './_generated/server';
import { CALLS_PER_ACTION, QUOTA_CALLS_PER_MONTH, QUOTA_WARN_AT } from './lib/config';
import { logEvent } from './lib/log';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows read per call, far below Convex's 32,000-documents-scanned limit per mutation. */
const PAGE = 4000;
const WINDOW_DAYS = 30;

/** UTC day `YYYY-MM-DD` of a timestamp. */
export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function countCreated(ctx: QueryCtx, table: 'tables' | 'games', from: number, to: number) {
  const rows = await ctx.db
    .query(table)
    .withIndex('by_creation_time', (q) => q.gte('_creationTime', from).lt('_creationTime', to))
    .take(PAGE);
  return rows.length;
}

/**
 * Daily: counts what was created on a UTC day (default: yesterday) into `usage`. Actions are
 * paged, and the function re-schedules itself with its running total until the day is done.
 */
export const countUsage = internalMutation({
  args: { day: v.optional(v.string()), cursor: v.optional(v.string()), actions: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const day = args.day ?? utcDay(Date.now() - DAY_MS);
    const from = Date.parse(`${day}T00:00:00Z`);
    const to = from + DAY_MS;
    const page = await ctx.db
      .query('actions')
      .withIndex('by_creation_time', (q) => q.gte('_creationTime', from).lt('_creationTime', to))
      .paginate({ cursor: args.cursor ?? null, numItems: PAGE });
    const actions = (args.actions ?? 0) + page.page.length;
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.maintenance.countUsage, { day, cursor: page.continueCursor, actions });
      return;
    }
    const row = { day, tables: await countCreated(ctx, 'tables', from, to), actions, games: await countCreated(ctx, 'games', from, to) };
    const existing = await ctx.db.query('usage').withIndex('by_day', (q) => q.eq('day', day)).unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert('usage', row);
    logEvent('usage.counted', { day, tables: row.tables, actions });
    const report = await usageReport(ctx);
    if (report.warn) logEvent('quota.warning', { estimatedCalls: report.estimatedCalls });
  },
});

/** The last 30 counted days, newest first, and the estimated function calls against the quota. */
export async function usageReport(ctx: QueryCtx) {
  const since = utcDay(Date.now() - WINDOW_DAYS * DAY_MS);
  const days = await ctx.db.query('usage').withIndex('by_day', (q) => q.gt('day', since)).order('desc').collect();
  const actions = days.reduce((n, d) => n + d.actions, 0);
  const estimatedCalls = actions * CALLS_PER_ACTION;
  return {
    days: days.map(({ day, tables, actions, games }) => ({ day, tables, actions, games })),
    tables: days.reduce((n, d) => n + d.tables, 0),
    actions,
    estimatedCalls,
    quota: QUOTA_CALLS_PER_MONTH,
    warn: estimatedCalls >= QUOTA_CALLS_PER_MONTH * QUOTA_WARN_AT,
  };
}
