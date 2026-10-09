import { describe, expect, it } from 'vitest';
import { advance, applyHumanAction, emptySeats, fillWithBots, startState, timeoutFor, type Seat } from '../../convex/lib/tableLogic';
import { NEXT_HAND_TIMEOUT_MS, TURN_TIMEOUT_MS } from '../../convex/lib/config';
import { belaGame } from '../../src/games/bela/game';

const human = (userId: string): Seat => ({ kind: 'user', userId: userId as never, name: userId });
const opts = { ...belaGame.defaultOptions, target: 501 as const, botLevel: 'medium' as const };
const withHost: Seat[] = [human('a'), ...fillWithBots(emptySeats(), 'medium').slice(1)];

describe('timeoutFor', () => {
  it('times the human whose turn it is', () => {
    const s = startState(opts, 3);
    expect(belaGame.currentPlayer(s)).toBe(0);
    expect(timeoutFor(s, withHost)).toEqual({ seat: 0, ms: TURN_TIMEOUT_MS });
  });

  it('does not time bots, system steps, or a finished match', () => {
    const s = applyHumanAction(startState(opts, 3), 0, { type: 'pass' }); // a bot's turn
    expect(timeoutFor(s, withHost)).toBeNull();
    const bots = fillWithBots(emptySeats(), 'easy');
    const over = advance(startState(opts, 3), bots, 0, 5000).state;
    expect(timeoutFor(over, withHost)).toBeNull();
  });

  it('gives the table longer to read the hand summary before dealing on', () => {
    const s = { ...startState(opts, 3), phase: 'handOver' as const };
    expect(timeoutFor(s, withHost)).toEqual({ seat: null, ms: NEXT_HAND_TIMEOUT_MS });
  });
});
