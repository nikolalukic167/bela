/** Timings and limits in one place (architecture §10). */
export const BOT_DELAY_MS = 900;
export const AUTO_DELAY_MS = 1100;
/** Bot-only tables wait this long on the hand summary before the next deal. */
export const NEXT_HAND_DELAY_MS = 4000;
/** 'fast' tables play this many moves per scheduled call. */
export const FAST_BATCH = 150;
/** How long a dropped player's seat is held before a bot stands in (architecture §7). */
export const RECONNECT_GRACE_MS = 90_000;
/** Open table pages report in this often; a few missed beats fit inside the grace period. */
export const HEARTBEAT_MS = 20_000;
/** A seated human who doesn't move in time gets a move played for them (architecture §7). */
export const TURN_TIMEOUT_MS = 45_000;
/** Nobody pressed "next" on the hand summary: the server deals on. */
export const NEXT_HAND_TIMEOUT_MS = 30_000;
/** Lobbies never started, and tables everyone walked away from, are deleted after this. */
export const STALE_TABLE_MS = 24 * 60 * 60 * 1000;
/** Rated games a player needs before appearing on the public leaderboard (architecture §9.1). */
export const LEADERBOARD_MIN_GAMES = 10;
/** ...and an account at least this old, so a farm of fresh accounts can't fill the board (§9.1). */
export const LEADERBOARD_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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
