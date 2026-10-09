import type { MutationCtx } from '../_generated/server';
import { TableError } from './errors';

export interface Limit {
  /** Requests allowed back to back. */
  burst: number;
  /** One token comes back per this many ms. */
  refillMs: number;
}

/**
 * Token bucket (pure). `at` only advances by whole refill intervals, so the part of a
 * token already earned is kept. A refused request changes nothing.
 */
export function takeToken(
  bucket: { tokens: number; at: number } | null,
  now: number,
  limit: Limit,
): { ok: true; tokens: number; at: number } | { ok: false } {
  if (!bucket) return { ok: true, tokens: limit.burst - 1, at: now };
  const earned = Math.floor((now - bucket.at) / limit.refillMs);
  const tokens = Math.min(limit.burst, bucket.tokens + earned);
  const at = tokens === limit.burst ? now : bucket.at + earned * limit.refillMs;
  return tokens > 0 ? { ok: true, tokens: tokens - 1, at } : { ok: false };
}

/**
 * Spends one token from the bucket `key`, or throws RATE_LIMITED. Convex rolls a failed
 * mutation back, so a request rejected later in the same mutation gets its token back:
 * the bucket counts accepted requests (and caps them), not every attempt.
 */
export async function consume(ctx: MutationCtx, key: string, limit: Limit): Promise<void> {
  const row = await ctx.db.query('rateLimits').withIndex('by_key', (q) => q.eq('key', key)).unique();
  const next = takeToken(row, Date.now(), limit);
  if (!next.ok) throw new TableError('RATE_LIMITED');
  if (row) await ctx.db.patch(row._id, { tokens: next.tokens, at: next.at });
  else await ctx.db.insert('rateLimits', { key, tokens: next.tokens, at: next.at });
}
