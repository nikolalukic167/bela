// Level 3: Perfect Information Monte Carlo (determinization).
// Deal the unseen cards consistently with what we know, solve each deal with
// everything visible, and play the card that scores best on average.
import type { Card, Suit } from '../../../core/cards';
import type { Rng } from '../../../core/rng';
import { trumpScore } from '../bot';
import { nextSeat } from '../engine';
import type { SeatView } from '../view';
import { cardsOf, fromIdx, popcount, toIdx } from './fast';
import { infer, type Knowledge } from './knowledge';
import { DEFAULT_UTILITY, makeScorer, type UtilityOptions } from './outcome';
import { playout, playoutValue } from './policy';
import { sampleDealLoose } from './sampler';
import { Solver, cloneWorld, type World } from './solver';
import { nextSeats } from './world';

export interface PimcConfig {
  /** Sampled deals per decision. */
  samples: number;
  /** Solve exactly once our hand has at most this many cards; earlier, use playouts. */
  exactCards: number;
  /** Policy playouts per move per deal when not solving exactly. */
  rollouts: number;
  /** Weight deals by how well they fit the bidding (caller strong, passers weak). */
  biddingEvidence: boolean;
  /** Stop sampling after this long (ms), keeping at least a few deals. */
  maxMs: number;
  utility: UtilityOptions;
}

export const PIMC_DEFAULT: PimcConfig = {
  samples: 40,
  exactCards: 6,
  rollouts: 4,
  biddingEvidence: true,
  maxMs: Infinity,
  utility: DEFAULT_UTILITY,
};

export function worldFor(v: SeatView, k: Knowledge, hands: number[]): World {
  return {
    T: k.T,
    hands: hands.slice(),
    next: nextSeats(v.options.direction),
    trick: v.trick.map((p) => toIdx(p.card)),
    trickSeats: v.trick.map((p) => p.seat),
    turn: v.seat,
    took: k.took,
  };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Likelihood of a deal given the bidding: the caller chose trump, so deals
 * where it holds good trumps are more likely; seats that spoke before it passed.
 * Scores use all 8 cards, which blurs the 6 seen at the call; it is a soft hint.
 */
export function biddingWeight(v: SeatView, k: Knowledge, hands: number[]): number {
  const caller = v.callerSeat as number;
  const trump = v.trump as Suit;
  const full = (p: number) => cardsOf(hands[p] | k.playedBy[p]);
  let w = 1;
  const speakers: number[] = [];
  for (let p = nextSeat(v.dealer, v), i = 0; i < 4; i++, p = nextSeat(p, v)) {
    if (p === caller) break;
    speakers.push(p);
  }
  const forced = caller === v.dealer && speakers.length === 3;
  if (caller !== v.seat && !forced) w *= sigmoid((trumpScore(full(caller), trump) - 6) * 1.2);
  for (const p of speakers) {
    if (p === v.seat) continue;
    const hand = full(p);
    const best = Math.max(...(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map((s) => trumpScore(hand, s)));
    w *= sigmoid((7.5 - best) * 0.8);
  }
  return w;
}

export interface MoveStats {
  card: Card;
  mean: number;
}

export function pimcEvaluate(v: SeatView, rng: Rng, cfg: PimcConfig = PIMC_DEFAULT): MoveStats[] {
  const k = infer(v);
  const legal = v.playable.map(toIdx);
  const totals = new Map<number, number>(legal.map((c) => [c, 0]));
  let weightSum = 0;
  const exact = popcount(k.hand) <= cfg.exactCards;
  const start = Date.now();

  for (let i = 0; i < cfg.samples; i++) {
    if (i >= 4 && Date.now() - start > cfg.maxMs) break;
    const hands = sampleDealLoose(k, rng);
    const weight = cfg.biddingEvidence ? biddingWeight(v, k, hands) : 1;
    if (weight < 1e-9) continue;
    const world = worldFor(v, k, hands);
    const score = makeScorer(v, k, hands, cfg.utility);
    if (exact) {
      const values = new Solver().moveValues(world);
      for (const c of legal) totals.set(c, (totals.get(c) as number) + weight * score(values.get(c) as number));
    } else {
      for (const c of legal) {
        let sum = 0;
        for (let r = 0; r < cfg.rollouts; r++) sum += score(playoutValue(playout(cloneWorld(world), rng, 0.15, c)));
        totals.set(c, (totals.get(c) as number) + (weight * sum) / cfg.rollouts);
      }
    }
    weightSum += weight;
  }
  return legal.map((c) => ({ card: fromIdx(c), mean: (totals.get(c) as number) / (weightSum || 1) }));
}

export function pimcPlay(v: SeatView, rng: Rng, cfg: PimcConfig = PIMC_DEFAULT): Card {
  if (v.playable.length === 1) return v.playable[0];
  const stats = pimcEvaluate(v, rng, cfg);
  let best = stats[0];
  for (const s of stats) if (s.mean > best.mean) best = s;
  return v.playable.find((c) => c.suit === best.card.suit && c.rank === best.card.rank) as Card;
}
