import { describe, expect, it } from 'vitest';
import {
  advance,
  emptySeats,
  fillWithBots,
  moverOf,
  ownSeat,
  presenceCheck,
  reclaimSeat,
  standIn,
  startState,
  type Seat,
} from '../../convex/lib/tableLogic';
import { belaGame } from '../../src/games/bela/game';

const human = (userId: string): Seat => ({ kind: 'user', userId: userId as never, name: userId });
const opts = { ...belaGame.defaultOptions, target: 501 as const, botLevel: 'medium' as const };
const GRACE = 90_000;

describe('presenceCheck', () => {
  it('keeps a seat while the last heartbeat is within the grace period, and says when to look again', () => {
    expect(presenceCheck(1_000, 1_000, GRACE)).toEqual({ expired: false, recheckAt: 91_000 });
    expect(presenceCheck(1_000, 90_999, GRACE)).toEqual({ expired: false, recheckAt: 91_000 });
  });

  it('expires once the grace period has passed without a heartbeat', () => {
    expect(presenceCheck(1_000, 91_000, GRACE)).toEqual({ expired: true });
  });
});

describe('standIn and reclaimSeat', () => {
  const seats: Seat[] = [human('a'), human('b'), ...fillWithBots(emptySeats(), 'easy').slice(2)];

  it('a bot stands in for an away player, keeping their name and remembering whose seat it is', () => {
    const away = standIn(seats, 1, 'hard');
    expect(away[1]).toEqual({ kind: 'bot', name: 'b', level: 'hard', standInFor: 'b' });
    expect(away[0]).toBe(seats[0]);
    expect(seats[1].kind).toBe('user'); // input untouched
  });

  it('only stands in for a seated human', () => {
    expect(standIn(seats, 2, 'hard')).toBe(seats);
  });

  it('the returning player gets their seat back', () => {
    const away = standIn(seats, 1, 'hard');
    expect(reclaimSeat(away, 'b' as never)).toEqual({ seats, seat: 1 });
    expect(reclaimSeat(seats, 'b' as never)).toBeNull(); // nothing to reclaim
    expect(reclaimSeat(away, 'c' as never)).toBeNull();
  });

  it('ownSeat finds a player whether they sit in person or a bot stands in', () => {
    const away = standIn(seats, 1, 'hard');
    expect(ownSeat(away, 'b' as never)).toBe(1);
    expect(ownSeat(away, 'a' as never)).toBe(0);
    expect(ownSeat(away, 'z' as never)).toBe(-1);
  });
});

describe('moverOf with away players', () => {
  it('stand-in bots play for away players while someone is still at the table', () => {
    const seats = standIn([human('a'), ...fillWithBots(emptySeats(), 'easy').slice(1)], 0, 'easy');
    const s = startState(opts, 3);
    expect(belaGame.currentPlayer(s)).toBe(0);
    // Everyone is a bot or away now: the table waits instead of playing a match nobody watches.
    expect(moverOf(s, seats)).toEqual({ kind: 'none' });
    const withFriend = standIn([human('a'), human('b'), ...fillWithBots(emptySeats(), 'easy').slice(2)], 0, 'easy');
    expect(moverOf(s, withFriend)).toEqual({ kind: 'bot', seat: 0 });
  });

  it('bot-only tables without stand-ins still play by themselves', () => {
    const seats = fillWithBots(emptySeats(), 'easy');
    expect(advance(startState(opts, 3), seats, 0, 10).moves).toHaveLength(10);
  });
});
