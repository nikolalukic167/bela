import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Id, TableNames } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';
import { anonymiseSeats } from './lib/accountLogic';
import { requireUser } from './lib/auth';
import { DELETED_NAME } from './lib/config';
import { TableError } from './lib/errors';
import { acceptName, cleanName, nameKey, renameCheck } from './lib/names';
import { freeName, isReservedName, nameTaken } from './lib/uniqueNames';
import type { Seat } from './lib/tableLogic';
import { leaveTable } from './tables';

/** The signed-in user's public profile, or null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt !== undefined) return null;
    return {
      name: user.name ?? 'Igrač',
      image: user.image ?? null,
      isGuest: user.isAnonymous === true,
      // Only a flag for showing the admin link; every admin function re-checks on the server.
      isAdmin: user.isAdmin === true,
    };
  },
});

/**
 * Changes the display name. Names are filtered (offensive names are refused), unique
 * (architecture §14.1) and rate-limited. Seats at existing tables keep the old name.
 */
export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    // A refused name doesn't count against the limit.
    const accepted = acceptName(name);
    if (await nameTaken(ctx, accepted, user._id)) throw new TableError('NAME_TAKEN');
    const check = renameCheck(user.renameTimes ?? [], Date.now());
    if (!check.ok) throw new TableError('RENAME_TOO_SOON');
    await ctx.db.patch(user._id, { name: accepted, nameKey: nameKey(accepted), renameTimes: check.times });
  },
});

/**
 * A free variant of a taken name ("Ana" → "Ana 2"), or null when the name is free. Public, so
 * the sign-in dialog can offer it; it reveals no more than the names shown at tables.
 */
export const suggestName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    let clean: string;
    try {
      clean = cleanName(name);
    } catch {
      return null;
    }
    if (!(await nameTaken(ctx, clean))) return null;
    return freeName(ctx, clean).catch(() => null);
  },
});

/**
 * One-off, from the Convex dashboard (Functions → users:backfillNameKeys → Run), repeated with
 * the returned `cursor` until `isDone`: gives players from before unique names their key. The
 * earliest holder of a name keeps it; later ones get the first free variant ("Ana 2").
 * Bots, test accounts, deleted accounts and admin-reset names stay without a key.
 */
export const backfillNameKeys = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query('users')
      .withIndex('by_name_key', (q) => q.eq('nameKey', undefined))
      .paginate({ cursor: cursor ?? null, numItems: 200 });
    let updated = 0;
    let renamed = 0;
    for (const user of page.page) {
      if (!user.name || user.isBot || user.isTest || user.deletedAt !== undefined) continue;
      if (isReservedName(user.name)) continue;
      const name = await freeName(ctx, user.name, user._id);
      await ctx.db.patch(user._id, { name, nameKey: nameKey(name) });
      updated++;
      if (name !== user.name) renamed++;
    }
    return { updated, renamed, isDone: page.isDone, cursor: page.continueCursor };
  },
});

/**
 * GDPR deletion (architecture §9.2). The player leaves every table (a friendly game goes on
 * with a bot, a rated one is abandoned), their name disappears from every seat, and their
 * sign-in, rating, blocks, mutes and reports are deleted. The users row stays as an
 * anonymous stub so `games` and other players' histories keep working.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const me = user._id;
    for (const m of await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', me)).collect()) {
      const table = await ctx.db.get(m.tableId);
      if (!table) {
        await ctx.db.delete(m._id);
        continue;
      }
      await leaveTable(ctx, table, me, DELETED_NAME);
      const after = await ctx.db.get(table._id);
      const seats = after && anonymiseSeats(after.seats as Seat[], me, DELETED_NAME);
      if (seats) await ctx.db.patch(table._id, { seats });
      const left = await ctx.db.get(m._id);
      if (left) await ctx.db.delete(m._id);
    }

    const rating = await ctx.db.query('ratings').withIndex('by_user', (q) => q.eq('userId', me)).unique();
    if (rating) await ctx.db.delete(rating._id);
    await deleteAll(ctx, await ctx.db.query('ratingHistory').withIndex('by_user', (q) => q.eq('userId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('blocks').withIndex('by_user', (q) => q.eq('userId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('blocks').withIndex('by_blocked', (q) => q.eq('blockedId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('mutes').withIndex('by_muted', (q) => q.eq('mutedId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('reports').withIndex('by_reporter', (q) => q.eq('reporterId', me)).collect());
    await deleteAll(ctx, await ctx.db.query('reports').withIndex('by_reported', (q) => q.eq('reportedId', me)).collect());
    await deleteSignIn(ctx, me);

    // Only the id and the deletion time remain; the moderation log keeps ids, no names.
    await ctx.db.replace(me, { name: DELETED_NAME, deletedAt: Date.now() });
  },
});

async function deleteAll<T extends TableNames>(ctx: MutationCtx, rows: { _id: Id<T> }[]) {
  for (const r of rows) await ctx.db.delete(r._id);
}

/** Convex Auth's rows for this user: accounts (password hash, Google id), sessions, tokens. */
async function deleteSignIn(ctx: MutationCtx, userId: Id<'users'>) {
  for (const account of await ctx.db.query('authAccounts').withIndex('userIdAndProvider', (q) => q.eq('userId', userId)).collect()) {
    await deleteAll(ctx, await ctx.db.query('authVerificationCodes').withIndex('accountId', (q) => q.eq('accountId', account._id)).collect());
    await ctx.db.delete(account._id);
  }
  for (const session of await ctx.db.query('authSessions').withIndex('userId', (q) => q.eq('userId', userId)).collect()) {
    await deleteAll(ctx, await ctx.db.query('authRefreshTokens').withIndex('sessionId', (q) => q.eq('sessionId', session._id)).collect());
    // Verifiers live for one OAuth round trip, so this short table has no index on the session.
    await deleteAll(ctx, await ctx.db.query('authVerifiers').filter((q) => q.eq(q.field('sessionId'), session._id)).collect());
    await ctx.db.delete(session._id);
  }
}
