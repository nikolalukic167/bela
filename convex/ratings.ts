import type { Doc, Id } from './_generated/dataModel';
import { query, type MutationCtx } from './_generated/server';
import { requireUser } from './lib/auth';
import { DAILY_GAIN_CAP, DAILY_GAIN_WINDOW_MS, LEADERBOARD_MIN_AGE_MS, LEADERBOARD_MIN_GAMES, LEADERBOARD_SIZE } from './lib/config';
import { gainsByOpponent, quartetKey, settleMatch } from './lib/ratingLogic';
import { logEvent } from './lib/log';
import type { Seat } from './lib/tableLogic';
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
  };
  const ids = players.filter((p): p is Id<'users'> => p !== null);
  // Rated or not was settled when the table was created (architecture §1.6); the ratings flag
  // only stops new rated tables, so a rated match that finishes after it is switched off still counts.
  if (!table.rated || ids.length !== 4) {
    const gameId = await ctx.db.insert('games', { ...base, rated: false });
    logEvent('game.finished', { tableId: table._id, gameId, rated: false, endReason: base.endReason });
    return;
  }

  const key = quartetKey(ids);
  const recent = await ctx.db
    .query('games')
    .withIndex('by_quartet', (q) => q.eq('quartetKey', key).gt('endedAt', now - DEFAULT_CONFIG.quartetWindowMs))
    .collect();
  const rows = new Map<string, Doc<'ratings'> | null>();
  for (const id of ids) rows.set(id, await ratingRow(ctx, id));
  const gainedToday: Record<string, Record<string, number>> = {};
  for (const id of ids) gainedToday[id] = await recentGains(ctx, id, now);
  const current: RatingBook = Object.fromEntries([...rows].flatMap(([id, r]) => (r ? [[id, toRating(r)]] : [])));
  const settled = settleMatch({
    players: ids,
    scores: result.scores,
    winner: result.winner,
    playedAt: now,
    current,
    recentQuartetGames: recent.filter((g) => g.rated).length,
    abandonedBy: result.abandonedBy,
    gainCap: DAILY_GAIN_CAP,
    gainedToday,
  });
  const gameId = await ctx.db.insert('games', { ...base, rated: settled.rated, quartetKey: key });
  logEvent('game.finished', { tableId: table._id, gameId, rated: settled.rated, endReason: base.endReason });
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

/** What `userId` gained off each opponent inside the daily window (for the win-trading cap). */
async function recentGains(ctx: MutationCtx, userId: Id<'users'>, now: number) {
  const points = await ctx.db
    .query('ratingHistory')
    .withIndex('by_user', (q) => q.eq('userId', userId).gt('at', now - DAILY_GAIN_WINDOW_MS))
    .collect();
  const games = [];
  for (const h of points) {
    if (h.delta <= 0) continue;
    const g = await ctx.db.get(h.gameId);
    if (g) games.push({ players: g.players, delta: h.delta });
  }
  return gainsByOpponent(userId, games);
}

/**
 * Public (architecture §9.2): established players only (LEADERBOARD_MIN_GAMES rated games and an
 * account LEADERBOARD_MIN_AGE_MS old), by name; no ids or emails.
 */
export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('ratings').withIndex('by_display').order('desc').take(LEADERBOARD_SIZE * 4);
    const out = [];
    for (const r of rows) {
      if (r.gamesPlayed < LEADERBOARD_MIN_GAMES) continue;
      const user = await ctx.db.get(r.userId);
      if (!user || user.isTest || Date.now() - user._creationTime < LEADERBOARD_MIN_AGE_MS) continue;
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
