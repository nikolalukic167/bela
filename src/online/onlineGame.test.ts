import { describe, expect, it } from 'vitest';
import { COUNTDOWN_FROM_S, needsHeartbeat, secondsLeft, serverAction } from './onlineGame';

const turn = { isMyTurn: true, phase: 'play' as const };
const waiting = { isMyTurn: false, phase: 'play' as const };

describe('secondsLeft', () => {
  it('counts down the last seconds of this player\'s own turn', () => {
    expect(secondsLeft(10_000, 0, turn)).toBe(10);
    expect(secondsLeft(10_000, 9_001, turn)).toBe(1);
    expect(secondsLeft(10_000, 12_000, turn)).toBe(0);
  });

  it('stays hidden until the countdown window', () => {
    expect(secondsLeft((COUNTDOWN_FROM_S + 1) * 1000, 0, turn)).toBeNull();
    expect(secondsLeft(COUNTDOWN_FROM_S * 1000, 0, turn)).toBe(COUNTDOWN_FROM_S);
  });

  it('is shown on the hand summary, where anyone may deal on', () => {
    expect(secondsLeft(5_000, 0, { isMyTurn: false, phase: 'handOver' })).toBe(5);
  });

  it('is hidden on other players\' turns, without a deadline or without a view', () => {
    expect(secondsLeft(5_000, 0, waiting)).toBeNull();
    expect(secondsLeft(null, 0, turn)).toBeNull();
    expect(secondsLeft(5_000, 0, null)).toBeNull();
  });
});

describe('needsHeartbeat', () => {
  it('beats only for a seated player at a running table', () => {
    expect(needsHeartbeat({ status: 'playing', mySeat: 2 })).toBe(true);
    expect(needsHeartbeat({ status: 'playing', mySeat: null })).toBe(false);
    expect(needsHeartbeat({ status: 'lobby', mySeat: 0 })).toBe(false);
    expect(needsHeartbeat({ status: 'finished', mySeat: 0 })).toBe(false);
    expect(needsHeartbeat(null)).toBe(false);
    expect(needsHeartbeat(undefined)).toBe(false);
  });
});

describe('serverAction', () => {
  it('sends player moves and drops trick collection, which is the server\'s job', () => {
    expect(serverAction({ type: 'pass' })).toEqual({ type: 'pass' });
    expect(serverAction({ type: 'next' })).toEqual({ type: 'next' });
    expect(serverAction({ type: 'collect' })).toBeNull();
  });
});
