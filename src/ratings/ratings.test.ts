import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import {
  DEFAULT_CONFIG,
  balanceTeams,
  calibration,
  displayRating,
  getRating,
  isProvisional,
  leaderboard,
  newRating,
  partnerStats,
  predictMatch,
  rateMatch,
  replay,
  withInactivity,
  type MatchRecord,
} from './ratings';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

let nextId = 0;
const match = (a: string[], b: string[], winner: 0 | 1, extra: Partial<MatchRecord> = {}): MatchRecord => ({
  id: `m${String(nextId++).padStart(5, '0')}`,
  playedAt: nextId * DAY,
  teams: [a, b],
  scores: winner === 0 ? [1001, 640] : [640, 1001],
  winner,
  rated: true,
  ...extra,
});

describe('rating one match', () => {
  it('winners go up, losers go down, everyone gets more certain', () => {
    const { book, entries } = rateMatch({}, match(['ana', 'ivo'], ['marko', 'luka'], 0));
    const fresh = newRating();
    for (const id of ['ana', 'ivo']) expect(book[id].mu).toBeGreaterThan(fresh.mu);
    for (const id of ['marko', 'luka']) expect(book[id].mu).toBeLessThan(fresh.mu);
    for (const id of ['ana', 'ivo', 'marko', 'luka']) {
      expect(book[id].sigma).toBeLessThan(fresh.sigma);
      expect(book[id].gamesPlayed).toBe(1);
    }
    expect(entries.map((e) => e.playerId)).toEqual(['ana', 'ivo', 'marko', 'luka']);
    expect(entries[0].ordinal).toBeCloseTo(displayRating(book.ana));
  });

  it('beating a stronger team moves ratings more than beating a weaker one', () => {
    const strong = { mu: 32, sigma: 3, gamesPlayed: 50, lastPlayedAt: 0 };
    const weak = { mu: 18, sigma: 3, gamesPlayed: 50, lastPlayedAt: 0 };
    const mid = { mu: 25, sigma: 3, gamesPlayed: 50, lastPlayedAt: 0 };
    const base = { a: mid, b: mid };
    const upset = rateMatch({ ...base, s1: strong, s2: strong }, match(['a', 'b'], ['s1', 's2'], 0, { playedAt: 1 }));
    const expected = rateMatch({ ...base, w1: weak, w2: weak }, match(['a', 'b'], ['w1', 'w2'], 0, { playedAt: 1 }));
    expect(upset.book.a.mu - mid.mu).toBeGreaterThan(expected.book.a.mu - mid.mu);
  });

  it('an unrated match changes nothing', () => {
    const { book, entries } = rateMatch({}, match(['a', 'b'], ['c', 'd'], 0, { rated: false }));
    expect(book).toEqual({});
    expect(entries).toEqual([]);
  });

  it('abandoning loses the match for your team, whatever the score said', () => {
    const { book } = rateMatch({}, match(['a', 'b'], ['c', 'd'], 0, { abandonedBy: 'b' }));
    expect(book.c.mu).toBeGreaterThan(book.a.mu);
  });

  it('rejects broken records', () => {
    expect(() => rateMatch({}, match(['a', 'b'], ['b', 'c'], 0))).toThrow(/twice/);
    expect(() => rateMatch({}, match(['a', 'b'], ['c', 'd'], 0, { abandonedBy: 'zz' }))).toThrow(/not a player/);
  });
});

describe('replaying history', () => {
  const history = [
    match(['a', 'b'], ['c', 'd'], 0),
    match(['a', 'c'], ['b', 'd'], 1),
    match(['a', 'd'], ['b', 'c'], 0, { rated: false }),
    match(['b', 'c'], ['a', 'd'], 1),
  ];

  it('equals rating the matches one by one', () => {
    let book = {};
    for (const m of history) book = rateMatch(book, m).book;
    expect(replay(history).book).toEqual(book);
  });

  it('does not depend on the order matches are stored in', () => {
    expect(replay([...history].reverse()).book).toEqual(replay(history).book);
  });

  it('records history per player and why matches were skipped', () => {
    const res = replay(history);
    expect(res.history).toHaveLength(12);
    expect(res.skipped).toEqual([{ matchId: history[2].id, reason: 'unrated' }]);
    expect(res.book.a.gamesPlayed).toBe(3);
    expect(res.predictions.map((p) => p.matchId)).toEqual([history[0].id, history[1].id, history[3].id]);
    expect(res.predictions[0].predicted[0]).toBeCloseTo(0.5);
  });

  it('caps how often the same four players can move ratings in a day', () => {
    const t0 = 100 * DAY;
    const spam = Array.from({ length: 6 }, (_, i) => match(['a', 'b'], ['c', 'd'], 0, { playedAt: t0 + i * HOUR }));
    const res = replay(spam);
    expect(res.book.a.gamesPlayed).toBe(DEFAULT_CONFIG.quartetCap);
    expect(res.skipped.map((s) => s.reason)).toEqual(['quartetCap', 'quartetCap', 'quartetCap']);

    // Same four players, any seating, count towards the same cap; a day later it resets.
    const later = [
      ...spam.slice(0, 3),
      match(['a', 'c'], ['b', 'd'], 0, { playedAt: t0 + 4 * HOUR }),
      match(['a', 'c'], ['b', 'd'], 0, { playedAt: t0 + DAY + HOUR }),
    ];
    expect(replay(later).skipped).toHaveLength(1);
  });
});

describe('display', () => {
  it('a new player shows 0 and is provisional until enough games', () => {
    expect(displayRating(newRating())).toBeCloseTo(0);
    expect(isProvisional(newRating())).toBe(true);
    expect(isProvisional({ ...newRating(), gamesPlayed: DEFAULT_CONFIG.provisionalGames })).toBe(false);
  });

  it('one lucky win does not put a newcomer above a proven player', () => {
    const veteran = { mu: 30, sigma: 1.5, gamesPlayed: 200, lastPlayedAt: 0 };
    const { book } = rateMatch({ veteran }, match(['new1', 'new2'], ['x', 'y'], 0, { playedAt: 1 }));
    expect(leaderboard(book)[0].playerId).toBe('veteran');
  });

  it('uncertainty grows back after a long break, capped at a new player’s', () => {
    const r = { mu: 30, sigma: 2, gamesPlayed: 80, lastPlayedAt: 0 };
    expect(withInactivity(r, 20 * DAY).sigma).toBe(2);
    const year = withInactivity(r, 365 * DAY).sigma;
    expect(year).toBeGreaterThan(2.5);
    expect(withInactivity(r, 100_000 * DAY).sigma).toBeCloseTo(newRating().sigma);
    // The returning player's next result moves them more than if they had never left.
    const fresh = rateMatch({ p: r }, match(['p', 'q'], ['s', 't'], 0, { playedAt: 10 * DAY })).book.p;
    const back = rateMatch({ p: r }, match(['p', 'q'], ['s', 't'], 0, { playedAt: 365 * DAY })).book.p;
    expect(back.mu - r.mu).toBeGreaterThan(fresh.mu - r.mu);
  });
});

describe('stats and matchmaking', () => {
  it('counts wins per partnership', () => {
    const ms = [
      match(['ana', 'marko'], ['c', 'd'], 0),
      match(['marko', 'ana'], ['c', 'd'], 1),
      match(['ana', 'marko'], ['c', 'd'], 0, { rated: false }),
    ];
    const pair = partnerStats(ms).find((s) => s.players.join() === 'ana,marko');
    expect(pair).toEqual({ players: ['ana', 'marko'], games: 3, wins: 2 });
  });

  it('balances four players as strongest + weakest against the middle two', () => {
    const r = (mu: number) => ({ mu, sigma: 2, gamesPlayed: 50, lastPlayedAt: 0 });
    const book = { s1: r(35), s2: r(28), s3: r(22), s4: r(15) };
    const { teams, predicted } = balanceTeams(book, ['s1', 's2', 's3', 's4']);
    expect(teams.map((t) => [...t].sort())).toEqual([['s1', 's4'], ['s2', 's3']]);
    expect(Math.abs(predicted[0] - 0.5)).toBeLessThan(0.1);
    expect(predictMatch(book, [['s1', 's2'], ['s3', 's4']])[0]).toBeGreaterThan(0.8);
  });
});

/**
 * Simulated league: players with a hidden true skill play random 2v2 matches
 * whose outcome is noisy (Bela is a game with a lot of luck). The ratings
 * should recover the true order and their win predictions should be honest.
 */
describe('simulated league', () => {
  const rng = createRng(2026);
  const N = 16;
  const truth = Array.from({ length: N }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, skill: (i - (N - 1) / 2) / 3 }));
  const matches: MatchRecord[] = [];
  for (let k = 0; k < 2500; k++) {
    const pool = [...truth];
    const four = Array.from({ length: 4 }, () => pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    const diff = four[0].skill + four[1].skill - four[2].skill - four[3].skill;
    const pWinA = 1 / (1 + Math.exp(-diff / 2)); // flat curve: big luck component
    matches.push({
      id: `s${String(k).padStart(5, '0')}`,
      playedAt: k * HOUR,
      teams: [[four[0].id, four[1].id], [four[2].id, four[3].id]],
      scores: [0, 0],
      winner: rng() < pWinA ? 0 : 1,
      rated: true,
    });
  }
  const res = replay(matches, { ...DEFAULT_CONFIG, quartetCap: Infinity });

  it('recovers the true skill order', () => {
    const rank = (xs: number[]) => {
      const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
      const r = new Array<number>(xs.length);
      order.forEach(([, i], pos) => (r[i] = pos));
      return r;
    };
    const t = rank(truth.map((p) => p.skill));
    const m = rank(truth.map((p) => getRating(res.book, p.id).mu));
    const d2 = t.reduce((s, ti, i) => s + (ti - m[i]) ** 2, 0);
    const spearman = 1 - (6 * d2) / (N * (N * N - 1));
    expect(spearman).toBeGreaterThan(0.85);
  });

  it('predicted win chances match how often favourites actually win', () => {
    // Skip the warm-up, when everyone is still unknown.
    const buckets = calibration(res.predictions.slice(500));
    const big = buckets.filter((b) => b.matches >= 100);
    expect(big.length).toBeGreaterThanOrEqual(2);
    for (const b of big) expect(Math.abs(b.actual - b.predicted)).toBeLessThan(0.08);
  });
});
