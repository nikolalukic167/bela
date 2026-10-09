// Who may chat and whom a viewer hears: mutes are owned by moderation.ts, the `chat`
// feature flag by lib/flags.ts.
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { flagOn } from './flags';

/** Users whose messages `viewer` must not see (moderation.mute). Per viewer: the sender is never stopped. */
export async function mutedBy(ctx: QueryCtx, viewer: Id<'users'>): Promise<Set<string>> {
  const rows = await ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', viewer)).collect();
  return new Set(rows.map((r) => r.mutedId));
}

/** The `chat` feature flag (architecture §12); a missing row means on. */
export const chatEnabled = (ctx: QueryCtx): Promise<boolean> => flagOn(ctx, 'chat');
