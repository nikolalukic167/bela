// Turn the result of a searched or simulated hand into the score that hand
// writes, from one seat's point of view. Uses the real scoring module, so the
// bots value pad, visi, štiglja, declarations and bela exactly like the engine.
import type { Suit } from '../../../core/cards';
import { declarationWinner, findDeclarations, type Declaration } from '../declarations';
import { playOrder } from '../engine';
import { LAST_TRICK_BONUS, STIGLJA_BONUS } from '../rules';
import { scoreHand } from '../scoring';
import type { BelaState } from '../state';
import type { SeatView } from '../view';
import { cardsOf, forBits, toIdx } from './fast';
import type { Knowledge } from './knowledge';
import { STIGLJA_FOR_1 } from './solver';

export interface UtilityOptions {
  /** Extra utility for a hand that wins the match (and minus for losing it). 0 = hand score only. */
  matchBonus: number;
}

export const DEFAULT_UTILITY: UtilityOptions = { matchBonus: 250 };

/**
 * For one sampled world (all four current hands), returns a function mapping
 * the solver value of the rest of the hand to our utility.
 */
export function makeScorer(v: SeatView, k: Knowledge, hands: number[], opts: UtilityOptions = DEFAULT_UTILITY) {
  const trump = v.trump as Suit;
  const T = k.T;
  const myTeam = v.seat % 2;
  const full = hands.map((h, p) => h | k.playedBy[p]);

  let remaining = LAST_TRICK_BONUS;
  for (let p = 0; p < 4; p++) forBits(hands[p], (c) => (remaining += T.points[c]));
  for (const t of v.trick) remaining += T.points[toIdx(t.card)];

  let declarations: Declaration[];
  let declarationTeam: number | null;
  if (v.tricks.length > 0) {
    declarations = v.declarations?.declarations ?? [];
    declarationTeam = v.declarations?.team ?? null;
  } else {
    // Not shown yet: what the sampled hands would declare.
    declarations = full.flatMap((m, seat) => findDeclarations(cardsOf(m), seat));
    const order = (seat: number) =>
      playOrder({ dealer: v.dealer, options: v.options } as BelaState, seat);
    declarationTeam = declarationWinner(declarations, trump, order);
  }

  const kq = (1 << ((k.trump << 3) + 5)) | (1 << ((k.trump << 3) + 6));
  const belaCalled: [number, number] = [0, 0];
  for (let p = 0; p < 4; p++) if ((full[p] & kq) === kq) belaCalled[p % 2] = 1;

  return (value0: number): number => {
    let rem0 = value0;
    let tricksTaken: [number, number] = [1, 1];
    if (value0 === STIGLJA_FOR_1) {
      rem0 = 0;
      tricksTaken = [0, 8];
    } else if (value0 > remaining) {
      rem0 = value0 - STIGLJA_BONUS;
      tricksTaken = [8, 0];
    }
    const pts0 = k.teamPoints[0] + rem0;
    const pts1 = k.teamPoints[1] + remaining - rem0;
    const hand = scoreHand(
      {
        trump,
        callerTeam: (v.callerSeat as number) % 2,
        // The last-trick bonus is already inside the totals: book it to team 0.
        trickPoints: [pts0 - LAST_TRICK_BONUS, pts1],
        tricksTaken,
        lastTrickTeam: 0,
        declarations,
        declarationTeam,
        belaCalled,
      },
      v.options,
    );
    let u = hand.score[myTeam] - hand.score[1 - myTeam];
    if (opts.matchBonus) {
      const a = v.scores[myTeam] + hand.score[myTeam];
      const b = v.scores[1 - myTeam] + hand.score[1 - myTeam];
      if ((a >= v.options.target || b >= v.options.target) && a !== b) u += a > b ? opts.matchBonus : -opts.matchBonus;
    }
    return u;
  };
}
