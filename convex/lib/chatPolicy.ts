// Who may chat and whom a viewer hears. These are seams for the other workstreams:
// block/mute is owned by accounts/safety, the `chat` feature flag by ops.
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

/**
 * Users whose messages `viewer` must not see. TODO(accounts/safety): read the mute/block list
 * once it is in the schema; until then nobody is muted.
 */
export async function mutedBy(_ctx: QueryCtx, _viewer: Id<'users'>): Promise<Set<string>> {
  return new Set();
}

/** TODO(ops): read the `chat` feature flag once it exists; chat is on until then. */
export async function chatEnabled(_ctx: QueryCtx): Promise<boolean> {
  return true;
}
