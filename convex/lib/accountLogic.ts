// Pure helpers for account deletion (architecture §9.2).
import type { Id } from '../_generated/dataModel';
import type { Seat } from './tableLogic';

/**
 * The seats with a deleted player's name replaced. Their seat keeps its user id, so finished
 * games still count for the others; a bot standing in for them forgets whom it stood in for.
 * Null when they are not at the table.
 */
export function anonymiseSeats(seats: Seat[], userId: Id<'users'>, name: string): Seat[] | null {
  let changed = false;
  const out = seats.map((s): Seat => {
    if (s.kind === 'user' && s.userId === userId) {
      changed = true;
      return { ...s, name };
    }
    if (s.kind === 'bot' && s.standInFor === userId) {
      changed = true;
      return { kind: 'bot', name, level: s.level, ...(s.userId && { userId: s.userId }) };
    }
    return s;
  });
  return changed ? out : null;
}
