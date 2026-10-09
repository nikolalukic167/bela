// The guided first hand (architecture §2, Phase 1): a fixed deal against bots with a tip for
// each moment worth explaining. Pure, so the lesson is tested like the rest of the engine.
import type { Card } from '../../core/cards';
import { setup } from './engine';
import type { BelaAction, BelaOptions, BelaState } from './state';
import { DEFAULT_RULES } from './state';
import { cards } from './testkit';
import type { SeatView } from './view';

export const TUTORIAL_SEAT = 0;

/**
 * Seat by seat, six cards in hand then two in the talon (see `deal` in engine.ts). The learner
 * holds J and 9 of hearts, and the talon brings K and Q: after a hearts call that is a
 * four-card sequence (50) and bela (20). Nobody else holds a declaration.
 */
const SEATS = [
  'Jh 9h Ah 10s As 7d Kh Qh',
  '7h 8s 9s Kd Qc 8c 10d 7c',
  '10h 8h Ks Ac 10c Ad 9d Js',
  'Qs 7s 8d Jd Jc 9c Kc Qd',
].map(cards);
export const TUTORIAL_DECK: Card[] = [...SEATS.flatMap((h) => h.slice(0, 6)), ...SEATS.flatMap((h) => h.slice(6))];

export const TUTORIAL_OPTIONS: BelaOptions = { target: 1001, direction: 'ccw', ...DEFAULT_RULES, botLevel: 'easy' };

export const tutorialSetup = (): BelaState => setup(TUTORIAL_OPTIONS, 1, TUTORIAL_DECK);

/** The learner's trump call is scripted so the declarations and bela happen as the tips say. */
export function guidedActions(s: Pick<BelaState, 'phase' | 'handNo'>, legal: BelaAction[]): BelaAction[] {
  if (s.phase !== 'trump' || s.handNo !== 0) return legal;
  return legal.filter((a) => a.type === 'call' && a.suit === 'hearts');
}

export type TutorialTip = 'trump' | 'lead' | 'follow' | 'declarations' | 'play' | 'scoring';

/** Which tip fits the moment, or null while the bots are busy. */
export function tutorialTip(v: SeatView): TutorialTip | null {
  if (v.phase === 'handOver' || v.phase === 'matchOver') return 'scoring';
  if (v.phase === 'trump') return v.isMyTurn ? 'trump' : null;
  const myTurn = v.isMyTurn && v.phase === 'play';
  // Following suit is explained the first time someone else leads to the learner.
  const followedBefore = v.tricks.some((t) => t[0].seat !== v.seat);
  if (myTurn && v.trick.length > 0 && !followedBefore) return 'follow';
  if (v.tricks.length === 1 && v.declarations) return 'declarations';
  if (myTurn && v.tricks.length === 0) return 'lead';
  return myTurn ? 'play' : null;
}
