import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

/** The signed-in user's public profile, or null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { name: user.name ?? user.email ?? 'Igrač', image: user.image ?? null };
  },
});
