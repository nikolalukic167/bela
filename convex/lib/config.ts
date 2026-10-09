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
export const LEADERBOARD_SIZE = 50;
export const MAX_ACTIVE_TABLES_PER_USER = 5;
export const MAX_NAME_LENGTH = 24;
export const MIN_NAME_LENGTH = 2;
/** Unambiguous characters only (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
