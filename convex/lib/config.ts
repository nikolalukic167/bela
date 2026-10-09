/** Timings and limits in one place (architecture §10). */
export const BOT_DELAY_MS = 900;
export const AUTO_DELAY_MS = 1100;
/** Bot-only tables wait this long on the hand summary before the next deal. */
export const NEXT_HAND_DELAY_MS = 4000;
/** 'fast' tables play this many moves per scheduled call. */
export const FAST_BATCH = 150;
/** How long a dropped player's seat is held before a bot stands in (architecture §7). */
export const RECONNECT_GRACE_MS = 60_000;
/** Open table pages report in this often; a few missed beats fit inside the grace period. */
export const HEARTBEAT_MS = 15_000;
/** A seated human who doesn't move in time gets a move played for them (architecture §7). */
export const TURN_TIMEOUT_MS = 30_000;
/** Nobody pressed "next" on the hand summary: the server deals on. */
export const NEXT_HAND_TIMEOUT_MS = 20_000;
/** A table's clock: reconnect grace, time per move, time on the hand summary. */
export interface TimerProfile {
  graceMs: number;
  turnMs: number;
  nextHandMs: number;
}
/**
 * Picked by the host at creation and frozen with the table (architecture §14.3). "normal" is the
 * default for every table (decided in §14; the first version used 90/45/30 s). Even the quick grace
 * period outlasts two heartbeats.
 */
export const TIMER_PROFILES = {
  relaxed: { graceMs: 120_000, turnMs: 60_000, nextHandMs: 40_000 },
  normal: { graceMs: RECONNECT_GRACE_MS, turnMs: TURN_TIMEOUT_MS, nextHandMs: NEXT_HAND_TIMEOUT_MS },
  quick: { graceMs: 30_000, turnMs: 15_000, nextHandMs: 10_000 },
} satisfies Record<string, TimerProfile>;
export type TimerProfileName = keyof typeof TIMER_PROFILES;
/** Lobbies never started, and tables everyone walked away from, are deleted after this. */
export const STALE_TABLE_MS = 24 * 60 * 60 * 1000;
/** Rated games a player needs before appearing on the public leaderboard (architecture §9.1). */
export const LEADERBOARD_MIN_GAMES = 10;
/** ...and an account at least a day old, so a farm of fresh accounts can't fill the board (§9.1, decided §14). */
export const LEADERBOARD_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Most display rating one player can gain off any single opponent in DAILY_GAIN_WINDOW_MS
 * (win-trading, §9.1). A new player's first win is worth about 2.4 points, so this is roughly
 * two honest wins against the same person per day; a rotating-partner farm hits it fast.
 */
export const DAILY_GAIN_CAP = 4;
export const DAILY_GAIN_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Token bucket for `tables.act` per user per table: a burst of 10, then one move per 250 ms.
 * A human never plays that fast; a script hammering the table gets RATE_LIMITED.
 */
export const ACT_LIMIT = { burst: 10, refillMs: 250 };
export const LEADERBOARD_SIZE = 50;
export const MAX_ACTIVE_TABLES_PER_USER = 5;
/** Most open public tables the /online page lists (architecture §14.6). */
export const PUBLIC_LOBBY_SIZE = 30;
export const MAX_NAME_LENGTH = 24;
export const MIN_NAME_LENGTH = 2;
/** Unambiguous characters only (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 31^8 ≈ 8.5·10¹¹ codes: not guessable at LOOKUP_LIMIT's pace (§9.3). Tables from before this kept 6. */
export const CODE_LENGTH = 8;
/** How long an invite code admits new players (seated players can always come back). */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
/** Joins with an unknown code, per user: a burst of 10, then one per 30 s. */
export const LOOKUP_LIMIT = { burst: 10, refillMs: 30_000 };
/** Convex free plan: function calls per month (docs.convex.dev/production/state/limits, Oct 2026). */
export const QUOTA_CALLS_PER_MONTH = 1_000_000;
/** Warn in the admin panel (and log quota.warning) at this share of the quota (architecture §12). */
export const QUOTA_WARN_AT = 0.7;
/** Function calls per stored move: the mutation plus the `watch` re-runs it triggers (~2,300 per match). */
export const CALLS_PER_ACTION = 5;
/** Finished unrated tables lose their move log after this; the games row stays (architecture §12). */
export const ACTION_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
