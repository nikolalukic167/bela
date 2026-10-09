import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

/** True when the user and anyone in `others` has blocked the other (used by `tables.join`). */
export async function blockedBetween(ctx: QueryCtx, userId: Id<'users'>, others: Id<'users'>[]): Promise<boolean> {
  if (others.length === 0) return false;
  const mine = await ctx.db.query('blocks').withIndex('by_user', (q) => q.eq('userId', userId)).collect();
  const theirs = await ctx.db.query('blocks').withIndex('by_blocked', (q) => q.eq('blockedId', userId)).collect();
  const ids = new Set<Id<'users'>>([...mine.map((b) => b.blockedId), ...theirs.map((b) => b.userId)]);
  return others.some((o) => ids.has(o));
}
