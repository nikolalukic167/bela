import type { Suit } from '../../core/cards';
import type { Declaration } from './declarations';
import { BELA_VALUE, LAST_TRICK_BONUS, STIGLJA_BONUS } from './rules';
import type { HandResult } from './state';

/** Everything a finished hand contributes to scoring. */
export interface HandTally {
  trump: Suit;
  callerTeam: number;
  /** Card points won in tricks, without the last-trick bonus. */
  trickPoints: [number, number];
  tricksTaken: [number, number];
  lastTrickTeam: number;
  declarations: Declaration[];
  /** Team whose declarations count, or null if nobody declared. */
  declarationTeam: number | null;
  /** Number of bela announcements per team. */
  belaCalled: [number, number];
}

export interface MatchScore {
  scores: [number, number];
  /** Caller points left hanging after a tied contract (visi). */
  hanging: number;
  winner: number | null;
}

/** Score one hand: last trick, štiglja, declarations, bela, and the contract (pad / visi). */
export function scoreHand(t: HandTally): HandResult {
  const caller = t.callerTeam;
  const other = 1 - caller;

  const cardPoints: [number, number] = [t.trickPoints[0], t.trickPoints[1]];
  cardPoints[t.lastTrickTeam] += LAST_TRICK_BONUS;

  let stiglja: number | null = null;
  if (t.tricksTaken[0] === 8) stiglja = 0;
  if (t.tricksTaken[1] === 8) stiglja = 1;
  if (stiglja !== null) cardPoints[stiglja] += STIGLJA_BONUS;

  const declarations: [number, number] = [0, 0];
  if (t.declarationTeam !== null) {
    declarations[t.declarationTeam] = t.declarations
      .filter((d) => d.seat % 2 === t.declarationTeam && d.kind !== 'belot')
      .reduce((sum, d) => sum + d.value, 0);
  }
  const bela: [number, number] = [t.belaCalled[0] * BELA_VALUE, t.belaCalled[1] * BELA_VALUE];

  const belotDecl = t.declarations.find((d) => d.kind === 'belot');
  const belot = belotDecl ? belotDecl.seat % 2 : null;

  const totals: [number, number] = [
    cardPoints[0] + declarations[0] + bela[0],
    cardPoints[1] + declarations[1] + bela[1],
  ];
  const all = totals[0] + totals[1];

  const score: [number, number] = [0, 0];
  let fell = false;
  let hung = false;
  if (totals[caller] * 2 > all) {
    score[0] = totals[0];
    score[1] = totals[1];
  } else if (totals[caller] * 2 < all) {
    fell = true;
    score[other] = all;
  } else {
    hung = true;
    score[other] = totals[other];
  }

  return { caller, trump: t.trump, cardPoints, declarations, bela, stiglja, fell, hung, belot, score, hanging: totals[caller] };
}

/**
 * Write a hand into the match: settles hanging points (visi), detects belot
 * and the match winner. Returns the result as written (incl. settled visi).
 */
export function settleHand(match: MatchScore, hand: HandResult, target: number): { match: MatchScore; result: HandResult } {
  const score: [number, number] = [hand.score[0], hand.score[1]];
  let hanging = match.hanging;
  if (hand.hung) {
    hanging += hand.hanging;
  } else if (hanging > 0) {
    score[hand.fell ? 1 - hand.caller : hand.caller] += hanging;
    hanging = 0;
  }
  const scores: [number, number] = [match.scores[0] + score[0], match.scores[1] + score[1]];

  let winner: number | null = null;
  if (hand.belot !== null) winner = hand.belot;
  else if ((scores[0] >= target || scores[1] >= target) && scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1;

  return { match: { scores, hanging, winner }, result: { ...hand, score } };
}
