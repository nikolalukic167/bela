import type { QueryCtx } from '../_generated/server';

/** Kill switches for risky features (architecture §12), stored in `config`. A missing row means on. */
export const FLAGS = ['ratings', 'rematch', 'chat'] as const;
export type Flag = (typeof FLAGS)[number];

export async function flagOn(ctx: QueryCtx, flag: Flag): Promise<boolean> {
  const row = await ctx.db.query('config').withIndex('by_key', (q) => q.eq('key', flag)).unique();
  return row?.on ?? true;
}

export async function allFlags(ctx: QueryCtx): Promise<Record<Flag, boolean>> {
  const out = {} as Record<Flag, boolean>;
  for (const f of FLAGS) out[f] = await flagOn(ctx, f);
  return out;
}
