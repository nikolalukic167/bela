import { describe, expect, it } from 'vitest';
import { STALE_TABLE_MS } from '../../convex/lib/config';
import { emptySeats, fillWithBots, isAbandoned, rematchSeats, standIn, type Seat } from '../../convex/lib/tableLogic';

const human = (userId: string): Seat => ({ kind: 'user', userId: userId as never, name: userId });
const DAY = STALE_TABLE_MS;

describe('rematchSeats', () => {
  it('keeps everyone in their seat, bots included, and brings away players back in person', () => {
    const seats = standIn([human('a'), human('b'), ...fillWithBots(emptySeats(), 'hard').slice(2)], 1, 'hard');
    expect(rematchSeats(seats)).toEqual([human('a'), human('b'), seats[2], seats[3]]);
  });

  it('frees the seat of anyone who can’t take another table', () => {
    const seats = [human('a'), human('b'), human('c'), human('d')];
    expect(rematchSeats(seats, (id) => id !== 'c')).toEqual([human('a'), human('b'), { kind: 'empty' }, human('d')]);
  });
});

describe('isAbandoned', () => {
  const now = 10 * DAY;
  it('a lobby nobody started within a day', () => {
    expect(isAbandoned({ status: 'lobby', seats: [human('a')], createdAt: now - DAY, lastMoveAt: null }, now)).toBe(true);
    expect(isAbandoned({ status: 'lobby', seats: [human('a')], createdAt: now - DAY + 1, lastMoveAt: null }, now)).toBe(false);
  });

  it('a running table whose humans have all been away for a day', () => {
    const away = standIn([human('a'), ...fillWithBots(emptySeats(), 'easy').slice(1)], 0, 'easy');
    expect(isAbandoned({ status: 'playing', seats: away, createdAt: 0, lastMoveAt: now - DAY }, now)).toBe(true);
    expect(isAbandoned({ status: 'playing', seats: away, createdAt: 0, lastMoveAt: now - 1000 }, now)).toBe(false);
  });

  it('never a table someone still sits at in person, a bot-only test match, or a finished game (it is history)', () => {
    const seated = [human('a'), ...fillWithBots(emptySeats(), 'easy').slice(1)];
    expect(isAbandoned({ status: 'playing', seats: seated, createdAt: 0, lastMoveAt: 0 }, now)).toBe(false);
    expect(isAbandoned({ status: 'playing', seats: fillWithBots(emptySeats(), 'easy'), createdAt: 0, lastMoveAt: 0 }, now)).toBe(false);
    expect(isAbandoned({ status: 'finished', seats: seated, createdAt: 0, lastMoveAt: 0 }, now)).toBe(false);
  });
});
