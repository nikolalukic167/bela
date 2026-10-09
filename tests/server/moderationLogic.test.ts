import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { seatTarget, humanAt } from '../../convex/lib/moderationLogic';
import type { Seat } from '../../convex/lib/tableLogic';

const id = (s: string) => s as Id<'users'>;
const seats: Seat[] = [
  { kind: 'user', userId: id('ana'), name: 'Ana' },
  { kind: 'bot', name: 'Bruno', level: 'medium', standInFor: id('bruno') },
  { kind: 'bot', name: 'Marko', level: 'medium' },
  { kind: 'empty' },
];

describe('humanAt', () => {
  it('is the player at a seat, also while a bot stands in for them', () => {
    expect(humanAt(seats, 0)).toBe('ana');
    expect(humanAt(seats, 1)).toBe('bruno');
    expect(humanAt(seats, 2)).toBeNull();
    expect(humanAt(seats, 3)).toBeNull();
    expect(humanAt(seats, 9)).toBeNull();
  });
});

describe('seatTarget', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
      return null;
    } catch (e) {
      return (e as { data?: { code?: string } }).data?.code;
    }
  };

  it('needs the caller at the table and another human at the seat', () => {
    expect(seatTarget(seats, 1, id('ana'))).toBe('bruno');
    expect(seatTarget(seats, 0, id('bruno'))).toBe('ana'); // an away player still sits there
    expect(code(() => seatTarget(seats, 0, id('ana')))).toBe('INVALID_INPUT');
    expect(code(() => seatTarget(seats, 2, id('ana')))).toBe('INVALID_INPUT');
    expect(code(() => seatTarget(seats, 3, id('ana')))).toBe('INVALID_INPUT');
    expect(code(() => seatTarget(seats, 0, id('stranger')))).toBe('FORBIDDEN');
  });
});
