// Level 4: Single-observer Information Set MCTS (Cowling, Powley & Whitehouse 2012).
// One tree over our information set: each iteration samples a deal consistent
// with what we know, walks the tree using only moves legal in that deal, and
// finishes with a policy playout. Unlike PIMC it never assumes the other
// players can see the cards.
import type { Card } from '../../../core/cards';
import type { Rng } from '../../../core/rng';
import type { SeatView } from '../view';
import { legalMask, toIdx } from './fast';
import { infer } from './knowledge';
import { DEFAULT_UTILITY, makeScorer, type UtilityOptions } from './outcome';
import { biddingWeight, worldFor } from './pimc';
import { isFinished, playoutValue, policyMove, stepWorld } from './policy';
import { sampleDealLoose } from './sampler';
import type { World } from './solver';

export interface IsmctsConfig {
  iterations: number;
  /** UCB exploration constant (rewards are scaled to about ±1). */
  exploration: number;
  /** Policy noise in playouts. */
  noise: number;
  /** Reject-sample deals by bidding likelihood. */
  biddingEvidence: boolean;
  maxMs: number;
  utility: UtilityOptions;
}

export const ISMCTS_DEFAULT: IsmctsConfig = {
  iterations: 3000,
  exploration: 0.7,
  noise: 0.15,
  biddingEvidence: true,
  maxMs: Infinity,
  utility: DEFAULT_UTILITY,
};

const SCALE = 200;

class Node {
  children: Node[] = [];
  visits = 0;
  avail = 0;
  /** Sum of rewards from the point of view of the seat that made `move`. */
  reward = 0;
  constructor(
    readonly move: number,
    readonly seat: number,
    readonly parent: Node | null,
  ) {}
}

function legalOf(w: World): number {
  if (w.trick.length === 0) return w.hands[w.turn];
  let win = w.trick[0];
  for (let i = 1; i < w.trick.length; i++) {
    const c = w.trick[i];
    if (c >> 3 === win >> 3 ? w.T.strength[c] > w.T.strength[win] : c >> 3 === w.T.trump) win = c;
  }
  return legalMask(w.hands[w.turn], w.trick[0], win, w.T);
}

export function ismctsPlay(v: SeatView, rng: Rng, cfg: IsmctsConfig = ISMCTS_DEFAULT): Card {
  if (v.playable.length === 1) return v.playable[0];
  const k = infer(v);
  const root = new Node(-1, -1, null);
  const myTeam = v.seat % 2;
  const start = Date.now();

  for (let it = 0; it < cfg.iterations; it++) {
    if (it >= 50 && Date.now() - start > cfg.maxMs) break;
    const hands = sampleDealLoose(k, rng);
    if (cfg.biddingEvidence && rng() > biddingWeight(v, k, hands)) {
      it--; // rejected deal: does not count as an iteration
      if (Date.now() - start > cfg.maxMs + 50) break;
      continue;
    }
    const w = worldFor(v, k, hands);
    const score = makeScorer(v, k, hands, cfg.utility);
    let points0 = 0;
    let node = root;

    // Selection and expansion.
    while (!isFinished(w)) {
      const legal = legalOf(w);
      const untried: number[] = [];
      for (let m = legal; m !== 0; ) {
        const b = m & -m;
        m ^= b;
        const c = 31 - Math.clz32(b);
        if (!node.children.some((ch) => ch.move === c)) untried.push(c);
      }
      if (untried.length > 0) {
        const c = untried[Math.floor(rng() * untried.length)];
        const child = new Node(c, w.turn, node);
        node.children.push(child);
        for (const ch of node.children) if (legal & (1 << ch.move)) ch.avail++;
        points0 += stepWorld(w, c);
        node = child;
        break;
      }
      let best: Node | null = null;
      let bestUcb = -Infinity;
      for (const ch of node.children) {
        if (!(legal & (1 << ch.move))) continue;
        ch.avail++;
        const ucb = ch.reward / ch.visits + cfg.exploration * Math.sqrt(Math.log(ch.avail) / ch.visits);
        if (ucb > bestUcb) {
          bestUcb = ucb;
          best = ch;
        }
      }
      node = best as Node;
      points0 += stepWorld(w, node.move);
    }

    // Playout.
    while (!isFinished(w)) points0 += stepWorld(w, policyMove(w, rng, cfg.noise));
    const u = score(playoutValue({ points0, took: w.took })) / SCALE;

    // Backpropagation: u is for our team.
    for (let n: Node | null = node; n && n.parent; n = n.parent) {
      n.visits++;
      n.reward += n.seat % 2 === myTeam ? u : -u;
    }
  }

  let best = root.children[0];
  for (const ch of root.children) if (ch.visits > best.visits) best = ch;
  return v.playable.find((c) => toIdx(c) === best.move) as Card;
}
