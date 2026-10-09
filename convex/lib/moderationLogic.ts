// Pure rules for block / mute / report (architecture §9.4). Targets are picked by seat at a
// shared table, never by a user id from the client (§9.3).
import type { Id } from '../_generated/dataModel';
import { TableError } from './errors';
import { ownSeat, type Seat } from './tableLogic';

/** The human at a seat (also while a bot stands in for them), or null for bots and empty seats. */
export function humanAt(seats: Seat[], seat: number): Id<'users'> | null {
  const s = seats[seat];
  if (s?.kind === 'user') return s.userId;
  if (s?.kind === 'bot' && s.standInFor) return s.standInFor;
  return null;
}

/** Whom the caller means: another human at a table the caller sits at. */
export function seatTarget(seats: Seat[], seat: number, me: Id<'users'>): Id<'users'> {
  if (ownSeat(seats, me) < 0) throw new TableError('FORBIDDEN');
  const target = humanAt(seats, seat);
  if (!target || target === me) throw new TableError('INVALID_INPUT');
  return target;
}
