import { ordinal, rate, rating } from 'openskill';

/**
 * Player ratings for team card games, using OpenSkill (Weng-Lin, Plackett-Luce).
 *
 * Matches are the source of truth: an append-only list of `MatchRecord`s.
 * Ratings are derived from them with `replay`, so a change to the algorithm
 * or its config is applied by replaying the history. Everything here is pure
 * and JSON-serialisable, so the server is meant to run it; clients only
 * display the results.
 */

export type PlayerId = string;

/** One finished (or abandoned) match: two teams, one winner. */
export interface MatchRecord {
  id: string;
  /** Epoch milliseconds. Replay order is by `playedAt`, then `id`. */
  playedAt: number;
  /** Players per team, e.g. `[[seat0, seat2], [seat1, seat3]]` in Bela. */
  teams: [PlayerId[], PlayerId[]];
  /** Final match score per team, kept for stats; ratings only use the winner. */
  scores: [number, number];
  /** Winning team. Ignored when `abandonedBy` is set. */
  winner: 0 | 1;
  /** Only rated matches change ratings. Unrated ones still count for stats. */
  rated: boolean;
  /** A player who left: their team loses the match. */
  abandonedBy?: PlayerId;
}

export interface PlayerRating {
  mu: number;
  sigma: number;
  /** Rated matches that changed this rating. */
  gamesPlayed: number;
  /** `playedAt` of the last rated match, or null. */
  lastPlayedAt: number | null;
}

export type RatingBook = Record<PlayerId, PlayerRating>;

export interface HistoryEntry {
  playerId: PlayerId;
  matchId: string;
  playedAt: number;
  mu: number;
  sigma: number;
  /** Conservative display rating after this match. */
  ordinal: number;
}

export type SkipReason = 'unrated' | 'quartetCap';

export interface RatingConfig {
  /** Below this many rated matches a player is shown as provisional. */
  provisionalGames: number;
  /** Days without a rated match before uncertainty starts to grow again. */
  inactivityGraceDays: number;
  /** Sigma added per inactive day past the grace period (in quadrature, capped at the initial sigma). */
  inactivitySigmaPerDay: number;
  /** Most rated matches the same four players may play within `quartetWindowMs`; the rest count as unrated. */
  quartetCap: number;
  quartetWindowMs: number;
}

export const DEFAULT_CONFIG: RatingConfig = {
  provisionalGames: 30,
  inactivityGraceDays: 30,
  inactivitySigmaPerDay: 0.1,
  quartetCap: 3,
  quartetWindowMs: 24 * 60 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL = rating();
/** openskill's default performance noise, mu₀ / 6. */
const BETA = INITIAL.mu / 6;

export function newRating(): PlayerRating {
  return { mu: INITIAL.mu, sigma: INITIAL.sigma, gamesPlayed: 0, lastPlayedAt: null };
}

export const getRating = (book: RatingBook, id: PlayerId): PlayerRating => book[id] ?? newRating();

/** Conservative skill, `mu - 3·sigma`: what leaderboards sort and show. */
export const displayRating = (r: PlayerRating): number => ordinal(r);

export const isProvisional = (r: PlayerRating, config = DEFAULT_CONFIG): boolean =>
  r.gamesPlayed < config.provisionalGames;

/** The team that won, after applying `abandonedBy`. */
export function winningTeam(m: MatchRecord): 0 | 1 {
  if (m.abandonedBy === undefined) return m.winner;
  const team = m.teams.findIndex((t) => t.includes(m.abandonedBy as PlayerId));
  if (team < 0) throw new Error(`match ${m.id}: abandonedBy ${m.abandonedBy} is not a player`);
  return team === 0 ? 1 : 0;
}

export function validateMatch(m: MatchRecord): void {
  const players = m.teams.flat();
  if (m.teams.some((t) => t.length === 0)) throw new Error(`match ${m.id}: empty team`);
  if (new Set(players).size !== players.length) throw new Error(`match ${m.id}: a player appears twice`);
  winningTeam(m);
}

/** Uncertainty grows back after a long break, so returning players re-adjust quickly. */
export function withInactivity(r: PlayerRating, now: number, config = DEFAULT_CONFIG): PlayerRating {
  if (r.lastPlayedAt === null) return r;
  const idleDays = (now - r.lastPlayedAt) / DAY_MS - config.inactivityGraceDays;
  if (idleDays <= 0) return r;
  const sigma = Math.min(INITIAL.sigma, Math.sqrt(r.sigma ** 2 + idleDays * config.inactivitySigmaPerDay ** 2));
  return { ...r, sigma };
}

/**
 * Win probability per team, from the current ratings.
 *
 * This is the two-team Plackett-Luce likelihood the ratings are fitted with:
 * a logistic in the mu difference, scaled by c = sqrt(sigmaA² + sigmaB² + 2·beta²).
 * openskill's own `predictWin` puts the same gap through a normal CDF, which
 * is steeper and overconfident for these ratings (see the calibration test).
 */
export function predictMatch(book: RatingBook, teams: [PlayerId[], PlayerId[]], now?: number, config = DEFAULT_CONFIG): [number, number] {
  const team = (ids: PlayerId[]) =>
    ids.reduce(
      (t, id) => {
        const r = now === undefined ? getRating(book, id) : withInactivity(getRating(book, id), now, config);
        return { mu: t.mu + r.mu, sigmaSq: t.sigmaSq + r.sigma ** 2 };
      },
      { mu: 0, sigmaSq: 0 },
    );
  const a = team(teams[0]);
  const b = team(teams[1]);
  const c = Math.sqrt(a.sigmaSq + b.sigmaSq + 2 * BETA ** 2);
  const pA = 1 / (1 + Math.exp((b.mu - a.mu) / c));
  return [pA, 1 - pA];
}

/**
 * Rate one match on top of `book`. Returns the new book and one history entry
 * per player; an unrated match returns the book unchanged and no entries.
 */
export function rateMatch(book: RatingBook, m: MatchRecord, config = DEFAULT_CONFIG): { book: RatingBook; entries: HistoryEntry[] } {
  validateMatch(m);
  if (!m.rated) return { book, entries: [] };

  const before = m.teams.map((t) => t.map((id) => withInactivity(getRating(book, id), m.playedAt, config)));
  const winner = winningTeam(m);
  const after = rate(before, { rank: winner === 0 ? [1, 2] : [2, 1] });

  const next: RatingBook = { ...book };
  const entries: HistoryEntry[] = [];
  m.teams.forEach((team, ti) =>
    team.forEach((id, pi) => {
      const { mu, sigma } = after[ti][pi];
      const prev = before[ti][pi];
      const r: PlayerRating = { mu, sigma, gamesPlayed: prev.gamesPlayed + 1, lastPlayedAt: m.playedAt };
      next[id] = r;
      entries.push({ playerId: id, matchId: m.id, playedAt: m.playedAt, mu, sigma, ordinal: displayRating(r) });
    }),
  );
  return { book: next, entries };
}

export const byPlayOrder = (a: MatchRecord, b: MatchRecord): number =>
  a.playedAt - b.playedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const quartetKey = (m: MatchRecord): string => [...m.teams.flat()].sort().join('|');

export interface ReplayResult {
  book: RatingBook;
  history: HistoryEntry[];
  /** Matches that did not change ratings, and why. */
  skipped: { matchId: string; reason: SkipReason }[];
  /** For each rated match: the winner's predicted chance before it was played. */
  predictions: { matchId: string; predicted: [number, number]; winner: 0 | 1 }[];
}

/**
 * Rebuild every rating from the match history. Input order does not matter.
 * Rated matches beyond the quartet cap (same four players, rolling window)
 * are skipped, which blunts win-trading between friends.
 */
export function replay(matches: MatchRecord[], config = DEFAULT_CONFIG): ReplayResult {
  let book: RatingBook = {};
  const history: HistoryEntry[] = [];
  const skipped: ReplayResult['skipped'] = [];
  const predictions: ReplayResult['predictions'] = [];
  const recent = new Map<string, number[]>();

  for (const m of [...matches].sort(byPlayOrder)) {
    validateMatch(m);
    if (!m.rated) {
      skipped.push({ matchId: m.id, reason: 'unrated' });
      continue;
    }
    const key = quartetKey(m);
    const times = (recent.get(key) ?? []).filter((t) => m.playedAt - t < config.quartetWindowMs);
    if (times.length >= config.quartetCap) {
      recent.set(key, times);
      skipped.push({ matchId: m.id, reason: 'quartetCap' });
      continue;
    }
    recent.set(key, [...times, m.playedAt]);

    predictions.push({ matchId: m.id, predicted: predictMatch(book, m.teams, m.playedAt, config), winner: winningTeam(m) });
    const res = rateMatch(book, m, config);
    book = res.book;
    history.push(...res.entries);
  }
  return { book, history, skipped, predictions };
}

export interface LeaderboardRow {
  playerId: PlayerId;
  rating: number;
  provisional: boolean;
  gamesPlayed: number;
}

/** Players sorted by display rating, best first. */
export function leaderboard(book: RatingBook, now?: number, config = DEFAULT_CONFIG): LeaderboardRow[] {
  return Object.entries(book)
    .map(([playerId, r]) => {
      const cur = now === undefined ? r : withInactivity(r, now, config);
      return { playerId, rating: displayRating(cur), provisional: isProvisional(cur, config), gamesPlayed: cur.gamesPlayed };
    })
    .sort((a, b) => b.rating - a.rating || (a.playerId < b.playerId ? -1 : 1));
}

export interface PartnerStat {
  players: [PlayerId, PlayerId];
  games: number;
  wins: number;
}

/** Results per partnership ("you and Marko win 70%"), rated and unrated matches alike. */
export function partnerStats(matches: MatchRecord[]): PartnerStat[] {
  const stats = new Map<string, PartnerStat>();
  for (const m of matches) {
    const winner = winningTeam(m);
    m.teams.forEach((team, ti) => {
      for (let i = 0; i < team.length; i++)
        for (let j = i + 1; j < team.length; j++) {
          const players = [team[i], team[j]].sort() as [PlayerId, PlayerId];
          const key = players.join('|');
          const s = stats.get(key) ?? { players, games: 0, wins: 0 };
          s.games++;
          if (ti === winner) s.wins++;
          stats.set(key, s);
        }
    });
  }
  return [...stats.values()].sort((a, b) => b.games - a.games || (a.players.join() < b.players.join() ? -1 : 1));
}

/** The split of four players into two pairs whose win chances are closest to 50/50. */
export function balanceTeams(book: RatingBook, players: [PlayerId, PlayerId, PlayerId, PlayerId]): { teams: [PlayerId[], PlayerId[]]; predicted: [number, number] } {
  const [p, q, r, s] = players;
  const splits: [PlayerId[], PlayerId[]][] = [
    [[p, q], [r, s]],
    [[p, r], [q, s]],
    [[p, s], [q, r]],
  ];
  return splits
    .map((teams) => ({ teams, predicted: predictMatch(book, teams) }))
    .reduce((best, cur) => (Math.abs(cur.predicted[0] - 0.5) < Math.abs(best.predicted[0] - 0.5) ? cur : best));
}

export interface CalibrationBucket {
  /** Lower edge of the favourite's predicted win chance, e.g. 0.6 for 60–70%. */
  from: number;
  to: number;
  matches: number;
  /** Mean predicted win chance of the favourite. */
  predicted: number;
  /** How often the favourite actually won. */
  actual: number;
}

/**
 * Does a team given 70% actually win about 70%? Buckets the favourite's
 * predicted chance from `replay(...).predictions` against the outcomes.
 */
export function calibration(predictions: ReplayResult['predictions'], bucketSize = 0.1): CalibrationBucket[] {
  const buckets = new Map<number, { n: number; p: number; won: number }>();
  for (const { predicted, winner } of predictions) {
    const fav = predicted[0] >= predicted[1] ? 0 : 1;
    const p = predicted[fav];
    const idx = Math.min(Math.floor((p - 0.5) / bucketSize), Math.ceil(0.5 / bucketSize) - 1);
    const b = buckets.get(idx) ?? { n: 0, p: 0, won: 0 };
    b.n++;
    b.p += p;
    if (winner === fav) b.won++;
    buckets.set(idx, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, b]) => ({
      from: 0.5 + idx * bucketSize,
      to: Math.min(1, 0.5 + (idx + 1) * bucketSize),
      matches: b.n,
      predicted: b.p / b.n,
      actual: b.won / b.n,
    }));
}
