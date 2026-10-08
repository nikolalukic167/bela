import type { HandResult } from '../state';
import type { SeatView } from '../view';

const swap = <T,>(p: [T, T]): [T, T] => [p[1], p[0]];
const flipTeam = (t: number | null) => (t === null ? null : 1 - t);

/**
 * The table UI is written from team 0's point of view ("us" = team 0). A player on
 * team 1 (seats 1 and 3 online) gets the same view with the teams swapped, so no
 * component needs to know which team it is rendering for.
 */
export function perspective(view: SeatView): SeatView {
  if (view.seat % 2 === 0) return view;
  const history: HandResult[] = view.history.map((r) => ({
    ...r,
    caller: 1 - r.caller,
    cardPoints: swap(r.cardPoints),
    declarations: swap(r.declarations),
    bela: swap(r.bela),
    score: swap(r.score),
    stiglja: flipTeam(r.stiglja),
    belot: flipTeam(r.belot),
  }));
  return {
    ...view,
    history,
    scores: swap(view.scores),
    tricksTaken: swap(view.tricksTaken),
    winner: flipTeam(view.winner),
    declarations: view.declarations && { ...view.declarations, team: 1 - view.declarations.team },
  };
}
