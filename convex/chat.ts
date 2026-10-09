import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireUser } from './lib/auth';
import { cleanChatText, isPhrase, rateLimited, textAllowed, visibleMessages } from './lib/chatLogic';
import { chatEnabled, mutedBy } from './lib/chatPolicy';
import { CHAT_TTL_MS, CHAT_WINDOW_MS } from './lib/config';
import { TableError } from './lib/errors';
import { ownSeat, type Seat } from './lib/tableLogic';
import { tableByCode, visibleTo } from './tables';

/** The caller's table and seat. Chat is for the people seated there, nobody else. */
async function memberOf(ctx: QueryCtx, code: string) {
  const user = await requireUser(ctx);
  const table = await tableByCode(ctx, code);
  if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
  const seat = ownSeat(table.seats as Seat[], user._id);
  if (seat < 0) throw new TableError('FORBIDDEN');
  return { user, table, seat };
}

const nameAt = (table: Doc<'tables'>, seat: number, user: Doc<'users'>) => {
  const s = (table.seats as Seat[])[seat];
  return s.kind === 'user' ? s.name : (user.name ?? '?');
};

/** Sends a quick phrase (any time) or free text (lobby of an unrated table only). */
export const send = mutation({
  args: { code: v.string(), phrase: v.optional(v.string()), text: v.optional(v.string()) },
  handler: async (ctx, { code, phrase, text }) => {
    const { user, table, seat } = await memberOf(ctx, code);
    if (!(await chatEnabled(ctx))) throw new TableError('FORBIDDEN');
    if ((phrase === undefined) === (text === undefined)) throw new TableError('INVALID_INPUT');
    let entry: { phrase: string } | { text: string };
    if (phrase !== undefined) {
      if (!isPhrase(phrase)) throw new TableError('INVALID_INPUT');
      entry = { phrase };
    } else {
      if (!textAllowed({ status: table.status, rated: table.rated === true })) throw new TableError('FORBIDDEN');
      const clean = cleanChatText(text);
      if (clean === null) throw new TableError('INVALID_INPUT');
      entry = { text: clean };
    }
    const now = Date.now();
    const recent = await ctx.db
      .query('chat')
      .withIndex('by_table_user', (q) => q.eq('tableId', table._id).eq('userId', user._id).gt('at', now - CHAT_WINDOW_MS))
      .collect();
    if (rateLimited(recent.map((r) => r.at), now)) throw new TableError('CHAT_TOO_FAST');
    await ctx.db.insert('chat', { tableId: table._id, userId: user._id, seat, name: nameAt(table, seat, user), ...entry, at: now, expiresAt: now + CHAT_TTL_MS });
  },
});

/** Recent unexpired messages at the caller's table, without authors the caller muted. */
export const list = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, table } = await memberOf(ctx, code);
    if (!(await chatEnabled(ctx))) return [];
    const now = Date.now();
    const rows = await ctx.db
      .query('chat')
      .withIndex('by_table', (q) => q.eq('tableId', table._id).gt('at', now - CHAT_TTL_MS))
      .collect();
    return visibleMessages(rows, now, await mutedBy(ctx, user._id)).map((r) => ({
      id: r._id,
      seat: r.seat,
      name: r.name,
      phrase: r.phrase ?? null,
      text: r.text ?? null,
      at: r.at,
      mine: r.userId === user._id,
    }));
  },
});

const PURGE_BATCH = 500;

/** Deletes expired entries (cron); reschedules itself while there is more to delete. */
export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('chat')
      .withIndex('by_expiry', (q) => q.lte('expiresAt', Date.now()))
      .take(PURGE_BATCH);
    for (const r of expired) await ctx.db.delete(r._id);
    if (expired.length === PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.chat.purge, {});
  },
});
