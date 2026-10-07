import type { Suit } from '../../core/cards';
import { BELA_VALUE, STIGLJA_BONUS } from './rules';
import type { BelaState, HandResult } from './state';

/** Score a finished hand (all 8 tricks played). Pure. */
export function scoreHand(s: BelaState): HandResult {
  const trump = s.trump as Suit;
  const caller = (s.callerSeat as number) % 2;
  const other = 1 - caller;

  const cardPoints: [number, number] = [s.cardPoints[0], s.cardPoints[1]];
  const declarations: [number, number] = [0, 0];
  if (s.declarationTeam !== null) {
    declarations[s.declarationTeam] = s.declarations
      .filter((d) => d.seat % 2 === s.declarationTeam && d.kind !== 'belot')
      .reduce((sum, d) => sum + d.value, 0);
  }
  const bela: [number, number] = [s.belaCalled[0] * BELA_VALUE, s.belaCalled[1] * BELA_VALUE];

  let stiglja: number | null = null;
  if (s.tricksTaken[0] === 8) stiglja = 0;
  if (s.tricksTaken[1] === 8) stiglja = 1;
  if (stiglja !== null) cardPoints[stiglja] += STIGLJA_BONUS;

  const belotDecl = s.declarations.find((d) => d.kind === 'belot');
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

  return { caller, trump, cardPoints, declarations, bela, stiglja, fell, hung, belot, score };
}
