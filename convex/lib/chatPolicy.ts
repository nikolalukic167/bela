// Who may chat and whom a viewer hears. These are seams for the other workstreams:
// block/mute is owned by accounts/safety (nikolalukic167/bela#21), the `chat` feature
// flag by ops (nikolalukic167/bela#10). Wire them up once those are on main.
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

/**
 * Users whose messages `viewer` must not see. Muting is per viewer: the sender is never
 * stopped. TODO(#21): return the `mutedId`s of
 * `ctx.db.query('mutes').withIndex('by_user', (q) => q.eq('userId', viewer))`.
 */
export async function mutedBy(_ctx: QueryCtx, _viewer: Id<'users'>): Promise<Set<string>> {
  return new Set();
}

/**
 * TODO(#10): read the `chat` flag from the `config` table the way `convex/flags.ts` does, and
 * have `chat.send` throw `FEATURE_OFF` (instead of FORBIDDEN) when it is off.
 */
export async function chatEnabled(_ctx: QueryCtx): Promise<boolean> {
  return true;
}
