// Pure rating settlement for online matches (architecture §7, docs/ratings.md). No Convex
// imports besides types, so it is unit-tested directly; ratings.ts only loads and saves.
import type { Id } from '../_generated/dataModel';
import { DEFAULT_CONFIG, displayRating, getRating, rateMatch, type HistoryEntry, type MatchRecord, type PlayerRating, type RatingBook } from '../../src/ratings/ratings';
import type { Seat } from './tableLogic';

export type RatedBlocker = 'RATED_NEEDS_FOUR' | 'RATED_NEEDS_ACCOUNTS';

/**
 * Why a table can't start as rated, or null. Rated play needs four different people with
 * real accounts: bots and guests (a fresh guest is one click away) would make ratings farmable.
 */
export function ratedBlocker(seats: Seat[], userOf: (id: Id<'users'>) => { isAnonymous?: boolean } | null): RatedBlocker | null {
  const ids = seats.flatMap((s) => (s.kind === 'user' ? [s.userId] : []));
  if (ids.length !== 4 || new Set(ids).size !== 4) return 'RATED_NEEDS_FOUR';
  if (ids.some((id) => userOf(id)?.isAnonymous !== false)) return 'RATED_NEEDS_ACCOUNTS';
  return null;
}

export interface Settlement {
  rated: boolean;
  reason?: 'quartetCap';
  /** New ratings, only for players whose rating changes. */
  updates: Record<string, PlayerRating>;
  entries: HistoryEntry[];
}

/**
 * Rates one finished (or abandoned) match by seat order: seats 0+2 vs 1+3.
 * `recentQuartetGames` is how many rated games the same four played inside the cap window.
 */
export function settleMatch(m: {
  players: string[];
  scores: [number, number];
  winner: 0 | 1;
  playedAt: number;
  current: RatingBook;
  recentQuartetGames: number;
  abandonedBy?: string;
  /** Per-opponent daily gain cap (display points); with `gainedToday` from `gainsByOpponent`. */
  gainCap?: number;
  gainedToday?: Record<string, Record<string, number>>;
}): Settlement {
  if (m.recentQuartetGames >= DEFAULT_CONFIG.quartetCap) return { rated: false, reason: 'quartetCap', updates: {}, entries: [] };
  const [p0, p1, p2, p3] = m.players;
  const record: MatchRecord = {
    id: 'match',
    playedAt: m.playedAt,
    teams: [
      [p0, p2],
      [p1, p3],
    ],
    scores: m.scores,
    winner: m.winner,
    rated: true,
    ...(m.abandonedBy !== undefined && { abandonedBy: m.abandonedBy }),
  };
  const { book, entries } = rateMatch(m.current, record);
  // Architecture §7: the leaver takes the loss, their partner is not penalised.
  const leaver = m.abandonedBy === undefined ? -1 : m.players.indexOf(m.abandonedBy);
  const spared = leaver < 0 ? null : m.players[(leaver + 2) % 4];
  const updates: Record<string, PlayerRating> = {};
  for (const [seat, id] of m.players.entries()) {
    if (id === spared) continue;
    const opponents = [m.players[(seat + 1) % 4], m.players[(seat + 3) % 4]];
    updates[id] = m.gainCap === undefined ? book[id] : capGain(getRating(m.current, id), book[id], m.gainCap, opponents, m.gainedToday?.[id] ?? {});
  }
  const kept = entries
    .filter((e) => e.playerId !== spared)
    .map((e) => ({ ...e, mu: updates[e.playerId].mu, ordinal: displayRating(updates[e.playerId]) }));
  return { rated: true, updates, entries: kept };
}

/**
 * Win-trading guard (architecture §9.1): a player may gain at most `cap` display points off
 * any one opponent in 24 h. Past that a win still counts as a game, but the rating rises only
 * by the room left against the opponent they already took most from. The cut comes off `mu`,
 * so the uncertainty update (sigma) is kept. Losses are never touched.
 */
function capGain(before: PlayerRating, after: PlayerRating, cap: number, opponents: string[], gained: Record<string, number>): PlayerRating {
  const gain = displayRating(after) - displayRating(before);
  const room = Math.max(0, cap - Math.max(0, ...opponents.map((o) => gained[o] ?? 0)));
  return gain <= room ? after : { ...after, mu: after.mu - (gain - room) };
}

/**
 * What one player gained off each opponent, from their recent rated games: `players` by seat
 * (seats 0+2 vs 1+3) and the player's display-rating change in that game. Losses count as 0.
 */
export function gainsByOpponent(player: string, games: { players: (string | null)[]; delta: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of games) {
    const seat = g.players.indexOf(player);
    if (seat < 0 || g.delta <= 0) continue;
    for (const o of [g.players[(seat + 1) % 4], g.players[(seat + 3) % 4]]) if (o) out[o] = (out[o] ?? 0) + g.delta;
  }
  return out;
}

/** Same four players in any seating. */
export const quartetKey = (players: string[]): string => [...players].sort().join('|');
