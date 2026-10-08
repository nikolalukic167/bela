// Level 2: the Level 1 heuristics, but deciding with tracked knowledge:
// which trumps are out, who is void where, and whether a later opponent can
// still beat a card (instead of assuming the worst).
import type { Card } from '../../../core/cards';
import type { BelaAction } from '../state';
import type { SeatView } from '../view';
import { chooseTrumpCall } from './bidding';
import type { Rng } from '../../../core/rng';
import { SUIT_MASK, beatsIdx, fromIdx, legalMask, toIdx } from './fast';
import { infer, type Knowledge } from './knowledge';
import { sampleDealLoose } from './sampler';

/** Opponents of `seat` who still play in this trick after `seat`. */
function opponentsAfter(v: SeatView, seat: number): number[] {
  const out: number[] = [];
  const order = v.options.direction === 'ccw' ? [1, 2, 3, 0] : [3, 0, 1, 2];
  let p = order[seat];
  for (let i = v.trick.length + 1; i < 4; i++, p = order[p]) if (p % 2 !== seat % 2) out.push(p);
  return out;
}

/** Could an opponent still to act beat `card` if it were winning the trick? */
function threatened(v: SeatView, k: Knowledge, card: number, ledSuit: number): boolean {
  return opponentsAfter(v, v.seat).some((p) => {
    const can = k.canHold[p] & k.unseen;
    const mayFollow = (can & SUIT_MASK[ledSuit]) !== 0;
    const mayBeVoid = !surelyHolds(k, p, ledSuit);
    const higher = (can & k.T.higher[card]) !== 0;
    if (card >> 3 === ledSuit) {
      if (mayFollow && higher) return true;
      // A plain card can also be ruffed by a seat that may be void.
      return ledSuit !== k.trump && mayBeVoid && (can & SUIT_MASK[k.trump]) !== 0;
    }
    // Our card is a ruff: only a void seat with a higher trump beats it.
    return mayBeVoid && higher;
  });
}

/**
 * Do we know `p` holds a card of the suit? True when the suit's outstanding
 * cards that only `p` can hold are more than zero.
 */
function surelyHolds(k: Knowledge, p: number, suit: number): boolean {
  let others = 0;
  for (let q = 0; q < 4; q++) if (q !== p && q !== k.seat) others |= k.canHold[q];
  return (k.unseen & SUIT_MASK[suit] & k.canHold[p] & ~others) !== 0;
}

/**
 * Probability that an opponent still to act in this trick beats `card`
 * (were it winning), over deals sampled consistently with what we know.
 */
function beatProbability(v: SeatView, k: Knowledge, card: number, rng: Rng, n: number): number {
  const opps = opponentsAfter(v, v.seat);
  if (opps.length === 0) return 0;
  const led = v.trick.length > 0 ? toIdx(v.trick[0].card) : card;
  const beat = card >> 3 === k.trump ? k.T.higher[card] : k.T.higher[card] | SUIT_MASK[k.trump];
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const hands = sampleDealLoose(k, rng);
    if (opps.some((p) => (legalMask(hands[p], led, card, k.T) & beat) !== 0)) hits++;
  }
  return hits / n;
}

/** Probability that leading `card` gets ruffed by an opponent. */
function ruffProbability(v: SeatView, k: Knowledge, card: number, rng: Rng, n: number): number {
  const opps = [0, 1, 2, 3].filter((p) => p % 2 !== v.seat % 2);
  const suit = SUIT_MASK[card >> 3];
  const trumps = SUIT_MASK[k.trump];
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const hands = sampleDealLoose(k, rng);
    if (opps.some((p) => (hands[p] & suit) === 0 && (hands[p] & trumps) !== 0)) hits++;
  }
  return hits / n;
}

/** True if no unseen card of the same suit can beat `card`. */
function isBoss(k: Knowledge, card: number): boolean {
  return (k.unseen & k.T.higher[card]) === 0;
}

const pts = (k: Knowledge) => (c: number) => k.T.points[c];
const cheapest = (k: Knowledge, cs: number[]) =>
  cs.slice().sort((a, b) => pts(k)(a) - pts(k)(b) || k.T.strength[a] - k.T.strength[b])[0];
const richest = (k: Knowledge, cs: number[]) =>
  cs.slice().sort((a, b) => pts(k)(b) - pts(k)(a) || k.T.strength[b] - k.T.strength[a])[0];

/**
 * Knowledge features layered on the Level 1 play rules, each switchable so
 * its effect can be measured on its own (docs/bots/report.md).
 */
export interface TrackerFeatures {
  /** Draw trumps only while an opponent may still hold one; also lead other boss trumps. */
  drawTrumps: boolean;
  /** Cash side-suit bosses only when no opponent can ruff them. */
  ruffSafeBosses: boolean;
  /** Lead a low card into partner's known void so partner can ruff. */
  partnerRuff: boolean;
  /** Smear on partner's trick when no later opponent can beat it (inferred, not assumed). */
  safeSmear: boolean;
  /** Win with a card no later opponent can beat (inferred). */
  safeWin: boolean;
  /**
   * Judge the three safety rules above by sampled probability rather than by
   * what is merely possible. 0 = possibility only; otherwise the sample count.
   */
  samples: number;
  /** Risk accepted when smearing, cashing or winning (probability of being beaten). */
  risk: number;
}

export const ALL_FEATURES: TrackerFeatures = {
  drawTrumps: true,
  ruffSafeBosses: false, // measured harmful: cashing aces early pays even at ruff risk
  partnerRuff: true,
  safeSmear: true,
  safeWin: true,
  samples: 24,
  risk: 0.35,
};

function chooseLead(v: SeatView, k: Knowledge, legal: number[], f: TrackerFeatures, rng: Rng): number {
  const trumpsOut = k.unseen & SUIT_MASK[k.trump];
  const opps = [0, 1, 2, 3].filter((p) => p % 2 !== v.seat % 2);
  const partner = (v.seat + 2) % 4;
  const oppTrumps = opps.some((p) => (k.canHold[p] & trumpsOut) !== 0);
  const myTrumps = legal.filter((c) => c >> 3 === k.trump);
  const side = legal.filter((c) => c >> 3 !== k.trump);
  const ourCall = (v.callerSeat as number) % 2 === v.seat % 2;

  if (f.drawTrumps) {
    const bossTrump = myTrumps.find((c) => isBoss(k, c));
    if (ourCall && oppTrumps && bossTrump !== undefined) return bossTrump;
  } else {
    const trumpJ = myTrumps.find((c) => (c & 7) === 4);
    if (ourCall && trumpJ !== undefined) return trumpJ;
  }

  let bosses = side.filter((c) => isBoss(k, c));
  if (f.ruffSafeBosses) {
    bosses = bosses.filter((c) =>
      f.samples > 0
        ? ruffProbability(v, k, c, rng, f.samples) <= f.risk
        : opps.every((p) => (k.canHold[p] & trumpsOut) === 0 || surelyHolds(k, p, c >> 3)),
    );
  }
  if (bosses.length > 0) return richest(k, bosses);

  if (f.partnerRuff && !ourCall) {
    const partnerCan = k.canHold[partner] & k.unseen;
    const ruffs = side.filter(
      (c) => (partnerCan & SUIT_MASK[c >> 3]) === 0 && (partnerCan & trumpsOut) !== 0 && k.T.points[c] <= 4,
    );
    if (ruffs.length > 0) return cheapest(k, ruffs);
  }

  return cheapest(k, side.length > 0 ? side : legal);
}

function chooseFollow(v: SeatView, k: Knowledge, legal: number[], f: TrackerFeatures, rng: Rng): number {
  const trick = v.trick.map((p) => toIdx(p.card));
  const ledSuit = trick[0] >> 3;
  let wi = 0;
  for (let i = 1; i < trick.length; i++) if (beatsIdx(trick[i], trick[wi], k.T)) wi = i;
  const win = trick[wi];
  const partnerWinning = v.trick[wi].seat % 2 === v.seat % 2;
  const trickPoints = trick.reduce((s, c) => s + k.T.points[c], 0);
  const last = trick.length === 3;
  const side = legal.filter((c) => c >> 3 !== k.trump);
  const unbeaten = (c: number) =>
    last || (f.samples > 0 ? beatProbability(v, k, c, rng, f.samples) <= f.risk : !threatened(v, k, c, ledSuit));

  if (partnerWinning) {
    const safe = f.safeSmear
      ? unbeaten(win)
      : last || (isBoss(k, win) && (win >> 3 === k.trump || trick.length === 2));
    if (safe) return richest(k, side.length > 0 ? side : legal);
    return cheapest(k, legal);
  }

  const winners = legal.filter((c) => beatsIdx(c, win, k.T));
  const sure = f.safeWin
    ? winners.filter(unbeaten)
    : last
      ? winners
      : winners.filter((c) => isBoss(k, c));
  if (winners.length > 0 && (last || trickPoints >= 10 || sure.length > 0)) {
    return cheapest(k, sure.length > 0 ? sure : winners);
  }
  return cheapest(k, side.length > 0 ? side : legal);
}

export function trackerAction(v: SeatView, rng: Rng, f: TrackerFeatures = ALL_FEATURES): BelaAction {
  switch (v.phase) {
    case 'trump':
      return chooseTrumpCall(v);
    case 'play': {
      const legal = v.playable.map(toIdx);
      if (legal.length === 1) return { type: 'play', card: v.playable[0] };
      const k = infer(v);
      const c = v.trick.length === 0 ? chooseLead(v, k, legal, f, rng) : chooseFollow(v, k, legal, f, rng);
      return { type: 'play', card: fromIdx(c) as Card };
    }
    case 'handOver':
      return { type: 'next' };
    default:
      throw new Error(`Bot has nothing to do in phase ${v.phase}`);
  }
}
