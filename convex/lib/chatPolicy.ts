// Who may chat and whom a viewer hears. These are seams for the other workstreams:
// block/mute is owned by accounts/safety (nikolalukic167/bela#21, wire up once on main),
// the `chat` feature flag by ops (lib/flags.ts).
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { flagOn } from './flags';

/**
 * Users whose messages `viewer` must not see. Muting is per viewer: the sender is never
 * stopped. TODO(#21): return the `mutedId`s of
 * `ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', viewer))`.
 */
export async function mutedBy(_ctx: QueryCtx, _viewer: Id<'users'>): Promise<Set<string>> {
  return new Set();
}

/** The `chat` feature flag (architecture §12); a missing row means on. */
export const chatEnabled = (ctx: QueryCtx): Promise<boolean> => flagOn(ctx, 'chat');
