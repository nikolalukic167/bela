import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { anonymiseSeats } from '../../convex/lib/accountLogic';
import type { Seat } from '../../convex/lib/tableLogic';

const id = (s: string) => s as Id<'users'>;

describe('anonymiseSeats', () => {
  it("renames the player's seat and a bot standing in for them, and nothing else", () => {
    const seats: Seat[] = [
      { kind: 'user', userId: id('ana'), name: 'Ana' },
      { kind: 'bot', name: 'Ana', level: 'easy', standInFor: id('ana') },
      { kind: 'bot', name: 'Ana', level: 'easy' },
      { kind: 'user', userId: id('bruno'), name: 'Bruno' },
    ];
    expect(anonymiseSeats(seats, id('ana'), 'X')).toEqual([
      { kind: 'user', userId: id('ana'), name: 'X' },
      { kind: 'bot', name: 'X', level: 'easy' },
      { kind: 'bot', name: 'Ana', level: 'easy' }, // an ordinary bot that happens to share the name
      { kind: 'user', userId: id('bruno'), name: 'Bruno' },
    ]);
  });

  it('returns null when the player is not at the table', () => {
    expect(anonymiseSeats([{ kind: 'empty' }], id('ana'), 'X')).toBeNull();
  });
});
