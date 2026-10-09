import type { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { requireUser } from './lib/auth';
import { ownSeat, type Seat } from './lib/tableLogic';
import { seatHands, summarizeStats, type HandLine, type StatsGame } from '../src/games/bela/stats';
import { partnerStats, type MatchRecord } from '../src/ratings/ratings';

/**
 * The caller's personal stats from their finished online matches (architecture §2, Phase 3):
 * totals, hand stats (trump calls and falls) where the record has them, and results per
 * human partner. Only aggregates for the caller leave the server.
 */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
    const games: StatsGame[] = [];
    const matches: MatchRecord[] = [];
    for (const m of memberships) {
      const table = await ctx.db.get(m.tableId);
      if (!table || table.isTest || table.status !== 'finished') continue;
      const game = await ctx.db.query('games').withIndex('by_table', (q) => q.eq('tableId', table._id)).first();
      if (!game) continue;
      const seat = ownSeat(table.seats as Seat[], user._id);
      const mySeat = seat >= 0 ? seat : game.players.indexOf(user._id);
      if (mySeat < 0) continue;
      const team = mySeat % 2;
      games.push({
        won: game.winner === team,
        points: game.scores[team],
        hands: game.hands ? seatHands(game.hands as HandLine[], mySeat) : undefined,
      });
      const ids = game.players.map((p) => p as string | null);
      const teamOf = (t: number) => ids.filter((p, i): p is string => p !== null && i % 2 === t);
      matches.push({
        id: game._id,
        playedAt: game.endedAt,
        teams: [teamOf(0), teamOf(1)],
        scores: [game.scores[0], game.scores[1]],
        winner: game.winner === 1 ? 1 : 0,
        rated: game.rated,
      });
    }
    const partners = [];
    for (const p of partnerStats(matches)) {
      if (!p.players.includes(user._id)) continue;
      const other = p.players.find((id) => id !== user._id);
      if (!other) continue;
      const u = await ctx.db.get(other as Id<'users'>);
      partners.push({ name: u?.name ?? '?', games: p.games, wins: p.wins });
    }
    return { summary: summarizeStats(games), partners };
  },
});
