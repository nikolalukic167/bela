// Pure rating settlement for online matches (architecture §7, docs/ratings.md). No Convex
// imports besides types, so it is unit-tested directly; ratings.ts only loads and saves.
import type { Id } from '../_generated/dataModel';
import { DEFAULT_CONFIG, rateMatch, type HistoryEntry, type MatchRecord, type PlayerRating, type RatingBook } from '../../src/ratings/ratings';
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
  const updates = Object.fromEntries(m.players.filter((id) => id !== spared).map((id) => [id, book[id]]));
  return { rated: true, updates, entries: entries.filter((e) => e.playerId !== spared) };
}

/** Same four players in any seating. */
export const quartetKey = (players: string[]): string => [...players].sort().join('|');
