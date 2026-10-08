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
  | 'RATE_LIMITED';

export class TableError extends ConvexError<{ code: TableErrorCode }> {
  constructor(code: TableErrorCode) {
    super({ code });
  }
}
