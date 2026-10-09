import { describe, expect, it } from 'vitest';
import { ratedBlocker, settleMatch } from '../../convex/lib/ratingLogic';
import { emptySeats, fillWithBots, type Seat } from '../../convex/lib/tableLogic';
import { newRating } from '../../src/ratings/ratings';

const human = (userId: string): Seat => ({ kind: 'user', userId: userId as never, name: userId });
const four = ['a', 'b', 'c', 'd'];
const base = { players: four, scores: [1001, 640] as [number, number], winner: 0 as const, playedAt: 1000, current: {}, recentQuartetGames: 0 };

describe('settleMatch', () => {
  it('rates a whole match: partners 0+2 beat 1+3, everyone gets a history point', () => {
    const r = settleMatch(base);
    expect(r.rated).toBe(true);
    expect(r.updates.a.mu).toBeGreaterThan(newRating().mu);
    expect(r.updates.c.mu).toBeGreaterThan(newRating().mu);
    expect(r.updates.b.mu).toBeLessThan(newRating().mu);
    expect(Object.values(r.updates).map((u) => u.gamesPlayed)).toEqual([1, 1, 1, 1]);
    expect(r.entries.map((e) => e.playerId).sort()).toEqual(four);
  });

  it('builds on the players’ current ratings', () => {
    const strong = { ...newRating(), mu: 40, sigma: 2, gamesPlayed: 50, lastPlayedAt: 900 };
    const r = settleMatch({ ...base, current: { b: strong } });
    expect(r.updates.b.gamesPlayed).toBe(51);
    expect(r.updates.b.mu).toBeLessThan(40);
  });

  it('counts beyond the quartet cap as unrated (win-trading between friends)', () => {
    const r = settleMatch({ ...base, recentQuartetGames: 3 });
    expect(r).toEqual({ rated: false, reason: 'quartetCap', updates: {}, entries: [] });
  });

  it('the player who abandons takes the loss; their partner is not penalised', () => {
    const r = settleMatch({ ...base, abandonedBy: 'a' });
    expect(r.updates.a.mu).toBeLessThan(newRating().mu);
    expect(r.updates.b.mu).toBeGreaterThan(newRating().mu); // opponents win
    expect(r.updates.c).toBeUndefined();
    expect(r.entries.map((e) => e.playerId)).not.toContain('c');
  });
});

describe('ratedBlocker', () => {
  const account = { isAnonymous: false };
  it('needs four different people with accounts, no bots or guests', () => {
    const seats = four.map(human);
    expect(ratedBlocker(seats, () => account)).toBeNull();
    expect(ratedBlocker([...seats.slice(0, 3), { kind: 'empty' }], () => account)).toBe('RATED_NEEDS_FOUR');
    expect(ratedBlocker(fillWithBots([human('a'), ...emptySeats().slice(1)], 'easy'), () => account)).toBe('RATED_NEEDS_FOUR');
    expect(ratedBlocker(seats, (id) => ({ isAnonymous: id === 'c' }))).toBe('RATED_NEEDS_ACCOUNTS');
  });
});
