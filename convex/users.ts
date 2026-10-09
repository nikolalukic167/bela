import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUser } from './lib/auth';
import { TableError } from './lib/errors';
import { acceptName, renameCheck } from './lib/names';

/** The signed-in user's public profile, or null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
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
 * Changes the display name. Names are filtered (offensive names are refused) and rate-limited;
 * they are not unique (open decision, architecture §14.1). Seats at existing tables keep the old name.
 */
export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    const accepted = acceptName(name); // a refused name doesn't count against the limit
    const check = renameCheck(user.renameTimes ?? [], Date.now());
    if (!check.ok) throw new TableError('RENAME_TOO_SOON');
    await ctx.db.patch(user._id, { name: accepted, renameTimes: check.times });
  },
});
