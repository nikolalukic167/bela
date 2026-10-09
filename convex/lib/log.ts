// Structured server logs (architecture §12): one JSON line per key event, readable in the Convex
// dashboard and in log streams. The field list is closed on purpose: there is no field for hands,
// game state, live seeds, tokens or emails, so they cannot end up in a log line.
import type { Id } from '../_generated/dataModel';

export type LogEvent =
  | 'table.created'
  | 'table.started'
  | 'table.codeReplaced'
  | 'seat.standIn'
  | 'seat.reclaimed'
  | 'game.finished'
  | 'rateLimited'
  | 'flag.changed'
  | 'cleanup.done'
  | 'usage.counted'
  | 'quota.warning'
  | 'compaction.done';

export interface LogFields {
  tableId?: Id<'tables'>;
  gameId?: Id<'games'>;
  userId?: Id<'users'>;
  seat?: number;
  rated?: boolean;
  endReason?: 'normal' | 'abandoned';
  timerProfile?: 'relaxed' | 'normal' | 'quick';
  /** Rate-limit bucket kind ('act', 'lookup'), never the full key. */
  bucket?: string;
  flag?: string;
  on?: boolean;
  /** UTC day, YYYY-MM-DD. */
  day?: string;
  count?: number;
  tables?: number;
  actions?: number;
  estimatedCalls?: number;
}

export function logEvent(event: LogEvent, fields: LogFields = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}
