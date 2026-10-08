// A fast heuristic policy over the compact model, for Monte Carlo playouts.
// It sees the sampled world (as PIMC assumes everyone does), so it can tell
// exactly whether a card is safe from later players.
import type { Rng } from '../../../core/rng';
import { LAST_TRICK_BONUS, STIGLJA_BONUS } from '../rules';
import { SUIT_MASK, beatsIdx, legalMask } from './fast';
import type { World } from './solver';

function winningOf(w: World): number {
  let win = w.trick[0];
  for (let i = 1; i < w.trick.length; i++) if (beatsIdx(w.trick[i], win, w.T)) win = w.trick[i];
  return win;
}

/**
 * `seat` is about to play and `card` would then be winning the trick: can an
 * opponent still to act beat it?
 */
function beatableLater(w: World, seat: number, card: number, led: number): boolean {
  let p = w.next[seat];
  for (let i = w.trick.length + 1; i < 4; i++, p = w.next[p]) {
    if (p % 2 === seat % 2) continue;
    const ledCard = led < 0 ? card : led;
    if ((legalMask(w.hands[p], ledCard, card, w.T) & beatMask(w, card)) !== 0) return true;
  }
  return false;
}

function beatMask(w: World, card: number): number {
  return card >> 3 === w.T.trump ? w.T.higher[card] : w.T.higher[card] | SUIT_MASK[w.T.trump];
}

function pick(m: number, score: (c: number) => number): number {
  let best = -1;
  let bestScore = -Infinity;
  while (m !== 0) {
    const b = m & -m;
    m ^= b;
    const c = 31 - Math.clz32(b);
    const s = score(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

/** Heuristic move for the seat to act. `noise` in [0,1] adds randomness. */
export function policyMove(w: World, rng: Rng, noise = 0): number {
  const T = w.T;
  const seat = w.turn;
  const hand = w.hands[seat];
  const jitter = () => (noise > 0 ? rng() * noise * 20 : 0);

  if (w.trick.length === 0) {
    // Lead: a card nobody can beat, richest first; else a cheap side card.
    return pick(hand, (c) => {
      const safe = !beatableLater(w, seat, c, -1);
      const trump = c >> 3 === T.trump;
      return (safe ? 100 + T.points[c] + (trump ? 5 : 0) : -T.points[c] - (trump ? 15 : 0) - T.strength[c] * 0.01) + jitter();
    });
  }

  const led = w.trick[0];
  const win = winningOf(w);
  const winSeat = w.trickSeats[w.trick.indexOf(win)];
  const legal = legalMask(hand, led, win, T);
  const partnerWins = winSeat % 2 === seat % 2 && !beatableLater(w, seat, win, led);
  if (partnerWins) {
    // Smear points, but keep trumps.
    return pick(legal, (c) => T.points[c] - (c >> 3 === T.trump ? 12 : 0) + jitter());
  }
  return pick(legal, (c) => {
    const wins = beatsIdx(c, win, T) && !beatableLater(w, seat, c, led);
    // Win as cheaply as possible; otherwise throw the least valuable card.
    return (wins ? 100 - T.strength[c] * 0.1 : -T.points[c] - (c >> 3 === T.trump ? 8 : 0)) + jitter();
  });
}

export interface Playout {
  /** Card points for team 0 from the start of the playout, incl. last-trick bonus. */
  points0: number;
  took: number;
}

/** Play `card` for the seat to act. Mutates `w`; returns card points team 0 gained. */
export function stepWorld(w: World, card: number): number {
  const seat = w.turn;
  w.hands[seat] &= ~(1 << card);
  w.trick.push(card);
  w.trickSeats.push(seat);
  if (w.trick.length < 4) {
    w.turn = w.next[seat];
    return 0;
  }
  let wi = 0;
  let pts = 0;
  for (let i = 0; i < 4; i++) {
    pts += w.T.points[w.trick[i]];
    if (i > 0 && beatsIdx(w.trick[i], w.trick[wi], w.T)) wi = i;
  }
  const winner = w.trickSeats[wi];
  if ((w.hands[0] | w.hands[1] | w.hands[2] | w.hands[3]) === 0) pts += LAST_TRICK_BONUS;
  w.took |= winner % 2 === 0 ? 1 : 2;
  w.trick = [];
  w.trickSeats = [];
  w.turn = winner;
  return winner % 2 === 0 ? pts : 0;
}

export const isFinished = (w: World) => w.trick.length === 0 && w.hands[w.turn] === 0;

/** Play the hand out with the policy. Mutates `w`. */
export function playout(w: World, rng: Rng, noise = 0, first?: number): Playout {
  let points0 = 0;
  if (first !== undefined) points0 += stepWorld(w, first);
  while (!isFinished(w)) points0 += stepWorld(w, policyMove(w, rng, noise));
  return { points0, took: w.took };
}

/** Solver-style value for team 0 (see solver.ts) from a finished playout. */
export function playoutValue(p: Playout): number {
  if (p.took === 1) return p.points0 + STIGLJA_BONUS;
  if (p.took === 2) return -STIGLJA_BONUS;
  return p.points0;
}
