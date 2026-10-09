import { describe, expect, it } from 'vitest';
import { advance, applyHumanAction, emptySeats, fillWithBots, startState, timeoutFor, type Seat } from '../../convex/lib/tableLogic';
import { NEXT_HAND_TIMEOUT_MS, RECONNECT_GRACE_MS, TIMER_PROFILES, TURN_TIMEOUT_MS } from '../../convex/lib/config';
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

describe('timer profiles (architecture §14.3)', () => {
  it('"normal" is today\'s 90 s grace, 45 s per move and 30 s on the hand summary', () => {
    expect(TIMER_PROFILES.normal).toEqual({ graceMs: RECONNECT_GRACE_MS, turnMs: TURN_TIMEOUT_MS, nextHandMs: NEXT_HAND_TIMEOUT_MS });
    expect([RECONNECT_GRACE_MS, TURN_TIMEOUT_MS, NEXT_HAND_TIMEOUT_MS]).toEqual([90_000, 45_000, 30_000]);
  });

  it('relaxed gives more time than normal, quick less, for every timing', () => {
    for (const k of ['graceMs', 'turnMs', 'nextHandMs'] as const) {
      expect(TIMER_PROFILES.relaxed[k]).toBeGreaterThan(TIMER_PROFILES.normal[k]);
      expect(TIMER_PROFILES.quick[k]).toBeLessThan(TIMER_PROFILES.normal[k]);
    }
  });

  it('timeoutFor uses the table\'s profile', () => {
    const s = startState(opts, 3);
    expect(timeoutFor(s, withHost, TIMER_PROFILES.quick)).toEqual({ seat: 0, ms: TIMER_PROFILES.quick.turnMs });
    const summary = { ...s, phase: 'handOver' as const };
    expect(timeoutFor(summary, withHost, TIMER_PROFILES.relaxed)).toEqual({ seat: null, ms: TIMER_PROFILES.relaxed.nextHandMs });
  });
});
