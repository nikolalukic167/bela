// Headless bot-vs-bot play for experiments. Duplicate format: every deal is
// played twice with the teams swapped, so card luck cancels out.
import { createRng } from '../../../core/rng';
import { apply, autoAction, currentPlayer, setup } from '../engine';
import { DEFAULT_RULES, type BelaOptions, type BelaState } from '../state';
import { viewFor } from '../view';
import type { Bot } from './index';

export const ARENA_OPTIONS: BelaOptions = { target: 1001, direction: 'ccw', ...DEFAULT_RULES };

/** bots[seat]; returns the state once the current hand is scored. */
export function playHand(s: BelaState, bots: Bot[], seed: number): BelaState {
  const rngs = bots.map((_, i) => createRng(seed * 31 + i));
  while (s.phase !== 'handOver' && s.phase !== 'matchOver') {
    const auto = autoAction(s);
    if (auto) {
      s = apply(s, auto);
      continue;
    }
    const seat = currentPlayer(s) as number;
    s = apply(s, bots[seat](viewFor(s, seat), rngs[seat]));
  }
  return s;
}

export interface HandRecord {
  seed: number;
  /** A's team in this half of the pair: 0 = seats 0+2. */
  aTeam: number;
  /** Hand score difference A − B. */
  diff: number;
  aCalled: boolean;
  callerFell: boolean;
  /** Card points A − B (before contract settlement). */
  cardDiff: number;
}

/** One duplicate pair of hands from deal `seed`. */
export function duplicateHand(a: Bot, b: Bot, seed: number, options = ARENA_OPTIONS): HandRecord[] {
  return [0, 1].map((aTeam) => {
    const bots = [0, 1, 2, 3].map((seat) => (seat % 2 === aTeam ? a : b));
    // Different dealers across seeds so every seat gets every speaking position.
    let s = setup(options, seed);
    s = { ...s, dealer: seed % 4 };
    s = { ...s, turn: (s.dealer + 1) % 4 };
    const end = playHand(s, bots, seed);
    const r = end.history[end.history.length - 1];
    const bTeam = 1 - aTeam;
    return {
      seed,
      aTeam,
      diff: r.score[aTeam] - r.score[bTeam],
      aCalled: r.caller === aTeam,
      callerFell: r.fell,
      cardDiff: r.cardPoints[aTeam] - r.cardPoints[bTeam],
    };
  });
}

export interface MatchRecord {
  seed: number;
  aTeam: number;
  aWon: boolean;
  hands: number;
}

/** A full match to the target; A sits at seats aTeam, aTeam+2. */
export function playMatch(a: Bot, b: Bot, seed: number, aTeam: number, options = ARENA_OPTIONS): MatchRecord {
  const bots = [0, 1, 2, 3].map((seat) => (seat % 2 === aTeam ? a : b));
  let s = setup(options, seed);
  let n = 0;
  while (s.phase !== 'matchOver') {
    if (s.phase === 'handOver') s = apply(s, { type: 'next' });
    s = playHand(s, bots, seed * 1009 + n++);
    if (n > 200) throw new Error('match did not finish');
  }
  return { seed, aTeam, aWon: s.winner === aTeam, hands: s.history.length };
}

export interface Summary {
  n: number;
  mean: number;
  /** Standard error of the mean. */
  se: number;
}

export function summarize(xs: number[]): Summary {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  return { n, mean, se: Math.sqrt(variance / n) };
}
