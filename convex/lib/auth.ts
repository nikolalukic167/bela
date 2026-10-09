import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { TableError } from './errors';

type Ctx = QueryCtx | MutationCtx;

/** Every non-public function starts here, so none can skip authentication by accident. */
export async function requireUser(ctx: Ctx): Promise<Doc<'users'>> {
  const id = await getAuthUserId(ctx);
  if (id === null) throw new TableError('UNAUTHENTICATED');
  const user = await ctx.db.get(id);
  // A deleted account's last token stays valid until it expires; it must not act any more.
  if (!user || user.deletedAt !== undefined) throw new TableError('UNAUTHENTICATED');
  return user;
}

/** Admin-only functions. Non-admins get NOT_FOUND so the panel's existence isn't advertised. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<'users'>> {
  const id = await getAuthUserId(ctx);
  const user = id === null ? null : await ctx.db.get(id);
  if (!user?.isAdmin) throw new TableError('NOT_FOUND');
  return user;
}
