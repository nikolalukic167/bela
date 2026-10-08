// Deal the unseen cards to the other seats consistently with everything we
// know (counts, voids, forced plays, shown declarations).
import type { Rng } from '../../../core/rng';
import { popcount } from './fast';
import type { Knowledge } from './knowledge';

/**
 * One consistent deal: hand masks for all four seats (ours unchanged), or
 * null if the constraints could not be met (should not happen for valid input).
 */
export function sampleDeal(k: Knowledge, rng: Rng, tries = 64): number[] | null {
  const others = [0, 1, 2, 3].filter((p) => p !== k.seat);
  const cards: number[] = [];
  for (let i = 0; i < 32; i++) if (k.unseen & (1 << i)) cards.push(i);

  for (let attempt = 0; attempt < tries; attempt++) {
    const hands = [0, 0, 0, 0];
    hands[k.seat] = k.hand;
    const room = k.counts.slice();
    room[k.seat] = 0;
    // Most constrained cards first, random among equals.
    const order = cards
      .map((c) => ({ c, n: others.filter((p) => k.canHold[p] & (1 << c)).length, r: rng() }))
      .sort((a, b) => a.n - b.n || a.r - b.r);
    let ok = true;
    for (const { c } of order) {
      let total = 0;
      for (const p of others) if (room[p] > 0 && k.canHold[p] & (1 << c)) total += room[p];
      if (total === 0) {
        ok = false;
        break;
      }
      let pick = rng() * total;
      for (const p of others) {
        if (room[p] > 0 && k.canHold[p] & (1 << c)) {
          pick -= room[p];
          if (pick < 0) {
            hands[p] |= 1 << c;
            room[p]--;
            break;
          }
        }
      }
    }
    if (ok && others.every((p) => popcount(hands[p]) === k.counts[p])) return hands;
  }
  return null;
}

/** Like sampleDeal, but falls back to ignoring inferences rather than failing. */
export function sampleDealLoose(k: Knowledge, rng: Rng): number[] {
  const strict = sampleDeal(k, rng);
  if (strict) return strict;
  const loose: Knowledge = { ...k, canHold: k.canHold.map((m, p) => (p === k.seat ? m : k.unseen | k.mustHold[p])) };
  const hands = sampleDeal(loose, rng, 256);
  if (!hands) throw new Error('No deal fits the card counts');
  return hands;
}
