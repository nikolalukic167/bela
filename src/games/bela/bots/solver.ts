// Perfect-information ("double dummy") solver for the rest of a Bela hand:
// alpha-beta over the remaining tricks with a transposition table at trick
// boundaries. Team 0 maximises, team 1 minimises.
import { LAST_TRICK_BONUS, STIGLJA_BONUS } from '../rules';
import { SUIT_MASK, beatsIdx, legalMask, popcount, type TrumpTables } from './fast';

/** A fully visible position: everything the solver needs. */
export interface World {
  T: TrumpTables;
  hands: number[];
  /** Next seat in play order. */
  next: number[];
  /** Cards of the trick in progress and who played them. */
  trick: number[];
  trickSeats: number[];
  turn: number;
  /** Bit 1: team 0 took a trick this hand, bit 2: team 1 did. */
  took: number;
}

export function cloneWorld(w: World): World {
  return { ...w, hands: w.hands.slice(), trick: w.trick.slice(), trickSeats: w.trickSeats.slice() };
}

/**
 * Value of a finished line for team 0: its card points from here on, plus 90
 * when it takes every trick; −90 when team 1 does. Monotone in team 0's final
 * score, so minimax over it equals minimax over the hand score.
 */
export const STIGLJA_FOR_1 = -STIGLJA_BONUS;

interface TTEntry {
  lo: number;
  hi: number;
}

export class Solver {
  nodes = 0;
  private tt = new Map<string, TTEntry>();
  constructor(private readonly nodeLimit = Infinity) {}

  /** Value (see above) of the position for team 0. */
  value(w: World): number {
    return this.search(w, -1000, 1000);
  }

  /** Exact value of each legal move of the player to act. */
  moveValues(w: World): Map<number, number> {
    const out = new Map<number, number>();
    const led = w.trick.length > 0 ? w.trick[0] : -1;
    const win = led < 0 ? -1 : this.winningCard(w);
    let m = legalMask(w.hands[w.turn], led, win, w.T);
    while (m !== 0) {
      const b = m & -m;
      m ^= b;
      const card = 31 - Math.clz32(b);
      out.set(card, this.play(w, card, -1000, 1000));
    }
    return out;
  }

  get exhausted(): boolean {
    return this.nodes > this.nodeLimit;
  }

  private winningCard(w: World): number {
    let win = w.trick[0];
    for (let i = 1; i < w.trick.length; i++) if (beatsIdx(w.trick[i], win, w.T)) win = w.trick[i];
    return win;
  }

  private search(w: World, alpha: number, beta: number): number {
    this.nodes++;
    const seat = w.turn;
    const atStart = w.trick.length === 0;
    if (atStart && w.hands[seat] === 0) {
      if (w.took === 1) return STIGLJA_BONUS;
      if (w.took === 2) return STIGLJA_FOR_1;
      return 0;
    }

    let key = '';
    const a0 = alpha;
    const b0 = beta;
    if (atStart) {
      key = `${w.hands[0]},${w.hands[1]},${w.hands[2]},${w.hands[3]},${seat},${w.took}`;
      const e = this.tt.get(key);
      if (e) {
        if (e.lo >= beta) return e.lo;
        if (e.hi <= alpha) return e.hi;
        if (e.lo === e.hi) return e.lo;
        if (e.lo > alpha) alpha = e.lo;
        if (e.hi < beta) beta = e.hi;
      }
    }

    const led = atStart ? -1 : w.trick[0];
    const win = atStart ? -1 : this.winningCard(w);
    const moves = this.orderedMoves(w, legalMask(w.hands[seat], led, win, w.T), win);
    const count = moves[8];
    const maximize = seat % 2 === 0;
    let best = maximize ? -1000 : 1000;
    for (let i = 0; i < count; i++) {
      const card = moves[i];
      const v = this.play(w, card, alpha, beta);
      if (maximize) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta || this.nodes > this.nodeLimit) break;
    }

    if (atStart) {
      const e = this.tt.get(key) ?? { lo: -1000, hi: 1000 };
      if (best <= a0) e.hi = Math.min(e.hi, best);
      else if (best >= b0) e.lo = Math.max(e.lo, best);
      else e.lo = e.hi = best;
      this.tt.set(key, e);
    }
    return best;
  }

  /** Play `card` for the seat to act, search on, undo; returns the value. */
  private play(w: World, card: number, alpha: number, beta: number): number {
    const seat = w.turn;
    w.hands[seat] &= ~(1 << card);
    w.trick.push(card);
    w.trickSeats.push(seat);
    let v: number;
    if (w.trick.length < 4) {
      w.turn = w.next[seat];
      v = this.search(w, alpha, beta);
      w.turn = seat;
    } else {
      let wi = 0;
      let pts = 0;
      for (let i = 0; i < 4; i++) {
        pts += w.T.points[w.trick[i]];
        if (i > 0 && beatsIdx(w.trick[i], w.trick[wi], w.T)) wi = i;
      }
      const winner = w.trickSeats[wi];
      const last = w.hands[0] === 0 && w.hands[1] === 0 && w.hands[2] === 0 && w.hands[3] === 0;
      if (last) pts += LAST_TRICK_BONUS;
      const gain = winner % 2 === 0 ? pts : 0;
      const savedTrick = w.trick;
      const savedSeats = w.trickSeats;
      const savedTook = w.took;
      w.trick = [];
      w.trickSeats = [];
      w.took |= winner % 2 === 0 ? 1 : 2;
      w.turn = winner;
      // Shift the window by what this trick already gives team 0.
      v = gain + this.search(w, alpha - gain, beta - gain);
      w.trick = savedTrick;
      w.trickSeats = savedSeats;
      w.took = savedTook;
      w.turn = seat;
    }
    w.trick.pop();
    w.trickSeats.pop();
    w.hands[seat] |= 1 << card;
    return v;
  }

  /**
   * Cheap move ordering plus equivalence pruning: of two cards in one suit
   * that are adjacent among the cards still out and worth the same points,
   * only one needs to be searched. Writes into a buffer per depth.
   */
  private orderedMoves(w: World, legal: number, win: number): Int8Array {
    const T = w.T;
    // Cards on the table break equivalence too: they are what we must beat.
    let inPlay = w.hands[0] | w.hands[1] | w.hands[2] | w.hands[3];
    for (const c of w.trick) inPlay |= 1 << c;
    const depth = 32 - popcount(inPlay) + w.trick.length;
    const buf = (this.buffers[depth] ??= new Int8Array(9));
    let n = 0;
    for (let s = 0; s < 4; s++) {
      if ((legal & SUIT_MASK[s]) === 0) continue;
      let prev = -1;
      for (const c of T.order[s]) {
        if ((inPlay & (1 << c)) === 0) continue;
        const mine = (legal & (1 << c)) !== 0;
        if (mine && !(prev >= 0 && T.points[prev] === T.points[c])) buf[n++] = c;
        prev = mine ? c : -1;
      }
    }
    // Cards that win the trick now first, strongest first: they produce cutoffs early.
    for (let i = 1; i < n; i++) {
      const c = buf[i];
      const k = this.rank(c, win, T);
      let j = i - 1;
      while (j >= 0 && this.rank(buf[j], win, T) < k) {
        buf[j + 1] = buf[j];
        j--;
      }
      buf[j + 1] = c;
    }
    buf[8] = n;
    return buf;
  }

  private rank(c: number, win: number, T: TrumpTables): number {
    return (win < 0 || beatsIdx(c, win, T) ? 1000 : 0) + T.strength[c];
  }

  private buffers: Int8Array[] = [];
}
