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
  if (!user) throw new TableError('UNAUTHENTICATED');
  return user;
}

/** Admin-only functions. Non-admins get NOT_FOUND so the panel's existence isn't advertised. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<'users'>> {
  const id = await getAuthUserId(ctx);
  const user = id === null ? null : await ctx.db.get(id);
  if (!user?.isAdmin) throw new TableError('NOT_FOUND');
  return user;
}

/** 2–24 chars, no control characters. Used for every user-chosen name. */
export function cleanName(raw: unknown, min: number, max: number): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  // eslint-disable-next-line no-control-regex
  if (name.length < min || name.length > max || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new TableError('INVALID_INPUT');
  }
  return name;
}
