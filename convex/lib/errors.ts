import { ConvexError } from 'convex/values';

/** Typed error codes; the client maps them to translated messages (architecture §7). */
export type TableErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TABLE_FULL'
  | 'ALREADY_SEATED'
  | 'NOT_YOUR_TURN'
  | 'ILLEGAL_ACTION'
  | 'WRONG_STATE'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'CODE_EXPIRED'
  | 'FEATURE_OFF'
  | 'RATED_NEEDS_FOUR'
  | 'RATED_NEEDS_ACCOUNTS'
  | 'CHAT_TOO_FAST'
  | 'NAME_NOT_ALLOWED'
  | 'RENAME_TOO_SOON'
  | 'BLOCKED'
  | 'NAME_TAKEN';

export class TableError extends ConvexError<{ code: TableErrorCode }> {
  constructor(code: TableErrorCode) {
    super({ code });
  }
}
