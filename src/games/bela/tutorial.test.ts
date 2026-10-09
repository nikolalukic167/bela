import { describe, expect, it } from 'vitest';
import { cardId } from '../../core/cards';
import { createRng } from '../../core/rng';
import { apply, autoAction, currentPlayer } from './engine';
import { belaGame } from './game';
import { ids } from './testkit';
import { TUTORIAL_DECK, TUTORIAL_SEAT, guidedActions, tutorialSetup, tutorialTip, type TutorialTip } from './tutorial';
import { viewFor } from './view';
import type { BelaState } from './state';

describe('tutorial deal', () => {
  it('is a full 32-card deck', () => {
    expect(new Set(TUTORIAL_DECK.map(cardId)).size).toBe(32);
  });

  it('lets the learner speak first, holding the two best hearts', () => {
    const s = tutorialSetup();
    expect(currentPlayer(s)).toBe(TUTORIAL_SEAT);
    expect(ids(s.hands[TUTORIAL_SEAT])).toEqual(expect.arrayContaining(['Jh', '9h']));
  });

  it('only offers the hearts call, so the declarations and bela come out as explained', () => {
    const s = tutorialSetup();
    expect(guidedActions(s, belaGame.legalActions(s, TUTORIAL_SEAT))).toEqual([{ type: 'call', suit: 'hearts' }]);
    const called = apply(s, { type: 'call', suit: 'hearts' });
    expect(called.belaHolder).toBe(TUTORIAL_SEAT);
    expect(called.declarationTeam).toBe(0);
    expect(called.declarations.filter((d) => d.seat === TUTORIAL_SEAT).map((d) => d.value)).toEqual([50]);
    // Other declarations would muddy the lesson.
    expect(called.declarations.every((d) => d.seat === TUTORIAL_SEAT)).toBe(true);
  });

  it('leaves later moves free', () => {
    const s = apply(tutorialSetup(), { type: 'call', suit: 'hearts' });
    const legal = belaGame.legalActions(s, TUTORIAL_SEAT);
    expect(guidedActions(s, legal)).toEqual(legal);
  });
});

describe('tutorialTip', () => {
  /** Plays the tutorial hand: the learner takes the first legal move, bots play the rest. */
  function tipsOfOneHand(seed: number): TutorialTip[] {
    let s: BelaState = tutorialSetup();
    const tips: TutorialTip[] = [];
    const rng = createRng(seed);
    for (let n = 0; n < 200 && s.phase !== 'handOver' && s.phase !== 'matchOver'; n++) {
      const tip = tutorialTip(viewFor(s, TUTORIAL_SEAT));
      if (tip && tips[tips.length - 1] !== tip) tips.push(tip);
      const auto = autoAction(s);
      const seat = currentPlayer(s);
      if (auto) s = apply(s, auto);
      else if (seat === TUTORIAL_SEAT) s = apply(s, guidedActions(s, belaGame.legalActions(s, seat))[0]);
      else s = apply(s, belaGame.bot(viewFor(s, seat as number), rng));
    }
    const last = tutorialTip(viewFor(s, TUTORIAL_SEAT));
    if (last) tips.push(last);
    return tips;
  }

  it('walks through trump, leading, declarations and scoring in order', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const tips = tipsOfOneHand(seed);
      const order = ['trump', 'lead', 'declarations', 'scoring'];
      expect(tips.filter((t) => order.includes(t))).toEqual(order);
    }
  });

  it('explains following suit the first time someone else leads', () => {
    let s = apply(tutorialSetup(), { type: 'call', suit: 'hearts' });
    // The learner leads the 7 of diamonds; seat 2's ace wins and leads the next trick.
    s = apply(s, { type: 'play', card: { rank: '7', suit: 'diamonds' } });
    s = apply(s, { type: 'play', card: { rank: 'K', suit: 'diamonds' } });
    s = apply(s, { type: 'play', card: { rank: 'A', suit: 'diamonds' } });
    s = apply(s, { type: 'play', card: { rank: '8', suit: 'diamonds' } });
    s = apply(s, { type: 'collect' });
    expect(s.turn).toBe(2);
    expect(tutorialTip(viewFor(s, TUTORIAL_SEAT))).toBe('declarations');
    s = apply(s, { type: 'play', card: { rank: 'K', suit: 'spades' } });
    s = apply(s, { type: 'play', card: { rank: 'Q', suit: 'spades' } });
    expect(tutorialTip(viewFor(s, TUTORIAL_SEAT))).toBe('follow');
  });
});
