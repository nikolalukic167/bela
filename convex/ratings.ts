import type { Doc, Id } from './_generated/dataModel';
import { query, type MutationCtx } from './_generated/server';
import { requireUser } from './lib/auth';
import { LEADERBOARD_MIN_GAMES, LEADERBOARD_SIZE } from './lib/config';
import { quartetKey, settleMatch } from './lib/ratingLogic';
import type { Seat } from './lib/tableLogic';
import type { HandLine } from '../src/games/bela/stats';
import { DEFAULT_CONFIG, displayRating, isProvisional, newRating, type PlayerRating, type RatingBook } from '../src/ratings/ratings';

const toRating = (r: Doc<'ratings'>): PlayerRating => ({ mu: r.mu, sigma: r.sigma, gamesPlayed: r.gamesPlayed, lastPlayedAt: r.lastPlayedAt });

async function ratingRow(ctx: MutationCtx, userId: Id<'users'>) {
  return ctx.db.query('ratings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
}

/**
 * Records a finished online match and, for a rated table, updates ratings and their history
 * in the same mutation (architecture §7: atomically). Test tables leave no record.
 */
export async function recordGame(
  ctx: MutationCtx,
  table: Doc<'tables'>,
  result: { scores: [number, number]; winner: 0 | 1; abandonedBy?: Id<'users'> },
  hands: HandLine[] = [],
) {
  if (table.isTest) return;
  const now = Date.now();
  const players = (table.seats as Seat[]).map((s) => (s.kind === 'user' ? s.userId : s.kind === 'bot' ? (s.standInFor ?? null) : null));
  const base = {
    tableId: table._id,
    players,
    scores: [...result.scores],
    winner: result.winner,
    endReason: result.abandonedBy ? ('abandoned' as const) : ('normal' as const),
    ...(result.abandonedBy && { abandonedBy: result.abandonedBy }),
    endedAt: now,
    hands,
  };
  const ids = players.filter((p): p is Id<'users'> => p !== null);
  if (!table.rated || ids.length !== 4) {
    await ctx.db.insert('games', { ...base, rated: false });
    return;
  }

  const key = quartetKey(ids);
  const recent = await ctx.db
    .query('games')
    .withIndex('by_quartet', (q) => q.eq('quartetKey', key).gt('endedAt', now - DEFAULT_CONFIG.quartetWindowMs))
    .collect();
  const rows = new Map<string, Doc<'ratings'> | null>();
  for (const id of ids) rows.set(id, await ratingRow(ctx, id));
  const current: RatingBook = Object.fromEntries([...rows].flatMap(([id, r]) => (r ? [[id, toRating(r)]] : [])));
  const settled = settleMatch({
    players: ids,
    scores: result.scores,
    winner: result.winner,
    playedAt: now,
    current,
    recentQuartetGames: recent.filter((g) => g.rated).length,
    abandonedBy: result.abandonedBy,
  });
  const gameId = await ctx.db.insert('games', { ...base, rated: settled.rated, quartetKey: key });
  for (const [id, r] of Object.entries(settled.updates)) {
    const userId = id as Id<'users'>;
    const before = displayRating(current[id] ?? newRating());
    const display = displayRating(r);
    const row = rows.get(id);
    const fields = { mu: r.mu, sigma: r.sigma, gamesPlayed: r.gamesPlayed, lastPlayedAt: r.lastPlayedAt, display };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert('ratings', { userId, ...fields });
    await ctx.db.insert('ratingHistory', { userId, gameId, mu: r.mu, sigma: r.sigma, display, delta: display - before, at: now });
  }
}

/** Public (architecture §9.2): established players only, by name; no ids or emails. */
export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('ratings').withIndex('by_display').order('desc').take(LEADERBOARD_SIZE * 4);
    const out = [];
    for (const r of rows) {
      if (r.gamesPlayed < LEADERBOARD_MIN_GAMES) continue;
      const user = await ctx.db.get(r.userId);
      if (!user || user.isTest) continue;
      out.push({ rank: out.length + 1, name: user.name ?? '?', rating: Math.round(r.display * 10) / 10, games: r.gamesPlayed });
      if (out.length === LEADERBOARD_SIZE) break;
    }
    return out;
  },
});

/** The caller's rating and its history (newest last), or null before their first rated game. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const r = await ctx.db.query('ratings').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    if (!r) return null;
    const history = await ctx.db.query('ratingHistory').withIndex('by_user', (q) => q.eq('userId', user._id)).order('desc').take(100);
    return {
      rating: Math.round(r.display * 10) / 10,
      games: r.gamesPlayed,
      provisional: isProvisional(toRating(r)),
      history: history.reverse().map((h) => ({ at: h.at, rating: Math.round(h.display * 10) / 10, delta: Math.round(h.delta * 10) / 10 })),
    };
  },
});
