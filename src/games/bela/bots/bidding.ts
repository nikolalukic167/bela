// Trump calling. Two hand evaluators:
//  - heuristic: the hand-tuned weights of Level 1 (`trumpScore` in ../bot.ts);
//  - learned: a linear model of the hand score the caller's team can expect,
//    fitted offline on simulated hands (scripts/bots/learn-bidding.ts).
// Both compare against a threshold that can move with the match situation.
import { SUITS, type Card, type Suit } from '../../../core/cards';
import { trumpScore } from '../bot';
import { nextSeat } from '../engine';
import type { BelaAction } from '../state';
import type { SeatView } from '../view';
import { BIDDING_MODEL } from './bidding-model';

export interface BidConfig {
  model: 'heuristic' | 'learned';
  /** Heuristic: minimum trumpScore. Learned: minimum expected hand score difference. */
  threshold: number;
  /** Shift the threshold near the end of the match (safer when ahead, bolder when behind). */
  matchAware: boolean;
}

export const HEURISTIC_BID: BidConfig = { model: 'heuristic', threshold: 6.0, matchAware: false };
export const LEARNED_BID: BidConfig = { model: 'learned', threshold: BIDDING_MODEL.threshold, matchAware: true };

/** Position in the calling order: 0 speaks first, 3 is the dealer. */
export function speakingPosition(v: SeatView): number {
  let p = nextSeat(v.dealer, v);
  for (let i = 0; i < 4; i++, p = nextSeat(p, v)) if (p === v.seat) return i;
  return 3;
}

/** Feature vector for calling `trump` with a six-card hand from `position`. */
export function bidFeatures(hand: Card[], trump: Suit, position: number): number[] {
  const t = hand.filter((c) => c.suit === trump);
  const has = (r: string) => (t.some((c) => c.rank === r) ? 1 : 0);
  const side = hand.filter((c) => c.suit !== trump);
  const sideCount = (r: string) => side.filter((c) => c.rank === r).length;
  const voids = SUITS.filter((s) => s !== trump && !hand.some((c) => c.suit === s)).length;
  const low = t.filter((c) => c.rank === '7' || c.rank === '8').length;
  return [
    1,
    has('J'),
    has('9'),
    has('A'),
    has('10'),
    has('K') + has('Q'),
    has('K') * has('Q'), // bela
    low,
    t.length >= 3 ? 1 : 0,
    has('J') * has('9'),
    sideCount('A'),
    sideCount('10'),
    sideCount('K'),
    voids,
    position === 0 ? 1 : 0,
    position === 3 ? 1 : 0,
  ];
}

export function learnedValue(hand: Card[], trump: Suit, position: number): number {
  const f = bidFeatures(hand, trump, position);
  return f.reduce((sum, x, i) => sum + x * BIDDING_MODEL.weights[i], 0);
}

function matchShift(v: SeatView, scale: number): number {
  const me = v.seat % 2;
  const mine = v.scores[me];
  const theirs = v.scores[1 - me];
  const near = v.options.target - 200;
  if (theirs >= near && theirs > mine) return -scale; // they are about to win: take risks
  if (mine >= near && mine > theirs) return scale; // we are about to win: don't fall
  return 0;
}

export function chooseTrumpCall(v: SeatView, cfg: BidConfig = HEURISTIC_BID): BelaAction {
  const position = speakingPosition(v);
  const value = (s: Suit) => (cfg.model === 'learned' ? learnedValue(v.hand, s, position) : trumpScore(v.hand, s));
  let best: Suit = SUITS[0];
  for (const s of SUITS) if (value(s) > value(best)) best = s;
  const shift = cfg.matchAware ? matchShift(v, cfg.model === 'learned' ? 15 : 0.7) : 0;
  return v.mustCall || value(best) >= cfg.threshold + shift ? { type: 'call', suit: best } : { type: 'pass' };
}
