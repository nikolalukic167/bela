/** Timings and limits in one place (architecture §10). */
export const BOT_DELAY_MS = 900;
export const AUTO_DELAY_MS = 1100;
/** Bot-only tables wait this long on the hand summary before the next deal. */
export const NEXT_HAND_DELAY_MS = 4000;
/** 'fast' tables play this many moves per scheduled call. */
export const FAST_BATCH = 150;
export const MAX_ACTIVE_TABLES_PER_USER = 5;
export const MAX_NAME_LENGTH = 24;
export const MIN_NAME_LENGTH = 2;
/** Unambiguous characters only (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
