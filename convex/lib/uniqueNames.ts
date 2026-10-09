// Unique display names (architecture §14.1). Uniqueness is by `nameKey` (case and spacing
// ignored), looked up through the `by_name_key` index. Rows without a key never block anyone:
// deleted accounts, names reset by an admin, bots and test accounts.
import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { DELETED_NAME, NEUTRAL_NAME } from './config';
import { TableError } from './errors';
import { nameKey, nameVariants } from './names';

/** Names the app gives out itself; nobody can pick them, and they never block anyone. */
const RESERVED = new Set([nameKey(DELETED_NAME), nameKey(NEUTRAL_NAME)]);
export const isReservedName = (name: string) => RESERVED.has(nameKey(name));

export async function nameTaken(ctx: QueryCtx, name: string, self?: Id<'users'>): Promise<boolean> {
  if (isReservedName(name)) return true;
  const key = nameKey(name);
  const rows = await ctx.db.query('users').withIndex('by_name_key', (q) => q.eq('nameKey', key)).take(2);
  return rows.some((r) => r._id !== self);
}

/** The name if it is free, else the first free "Name 2", "Name 3", … */
export async function freeName(ctx: QueryCtx, name: string, self?: Id<'users'>): Promise<string> {
  for (const candidate of nameVariants(name)) if (!(await nameTaken(ctx, candidate, self))) return candidate;
  throw new TableError('NAME_TAKEN');
}

/**
 * Convex Auth's `afterUserCreatedOrUpdated`: runs in the mutation that stores the user, so a
 * refused name stores nothing. Guests and username sign-ups must pick a free name; a Google
 * name is kept when free and otherwise becomes the first free variant.
 */
export async function onUserStored(
  ctx: MutationCtx,
  args: { userId: Id<'users'>; existingUserId: Id<'users'> | null; type: string; provider: { id: string } },
) {
  const user = await ctx.db.get(args.userId);
  if (!user?.name || user.deletedAt !== undefined) return;
  if (args.provider.id === 'google') {
    const name = await freeName(ctx, user.name, user._id);
    await ctx.db.patch(user._id, { name, nameKey: nameKey(name) });
    return;
  }
  if (args.existingUserId === null && (await nameTaken(ctx, user.name, user._id))) throw new TableError('NAME_TAKEN');
  await ctx.db.patch(user._id, { nameKey: nameKey(user.name) });
}
