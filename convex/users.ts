import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { cleanName, requireUser } from './lib/auth';
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from './lib/config';

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

export const rename = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { name: cleanName(name, MIN_NAME_LENGTH, MAX_NAME_LENGTH) });
  },
});
