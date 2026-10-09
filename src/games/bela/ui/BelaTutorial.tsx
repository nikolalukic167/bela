import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt, useI18n } from '../../../i18n/i18n';
import { useCardNames } from '../../../ui/decks';
import { SPEED_DELAYS, useSettings } from '../../../ui/settings';
import { saveJson } from '../../../ui/storage';
import type { GamePort } from '../../../ui/gamePort';
import { useGame } from '../../../ui/useGame';
import { belaGame } from '../game';
import type { BelaAction } from '../state';
import { TUTORIAL_SEAT, guidedActions, tutorialSetup, tutorialTip } from '../tutorial';
import type { SeatView } from '../view';
import { TableScreen } from './BelaTable';

export const TUTORIAL_DONE_KEY = 'bela:tutorialDone';

/** One guided hand against bots on a fixed deal, with a tip for each step (architecture §2, Phase 1). */
export function BelaTutorial() {
  const { t } = useI18n();
  // Tips name cards the way the player's deck prints them (U/O on Hungarian cards, J/Q on French).
  const names = useCardNames();
  const navigate = useNavigate();
  const { speed } = useSettings();
  const game = useGame(belaGame, {
    humanSeat: TUTORIAL_SEAT,
    // Slower than the chosen speed, so a learner can watch the bots answer.
    botDelay: SPEED_DELAYS[speed].bot * 1.5,
    autoDelay: SPEED_DELAYS[speed].auto * 1.5,
    storageKey: 'bela:tutorial',
  });
  const { view, load } = game;
  useEffect(() => load(tutorialSetup()), [load]);

  const finish = () => {
    saveJson(TUTORIAL_DONE_KEY, true);
    navigate('/');
  };

  if (!view) return null;
  const legalActions = guidedActions(view, game.legalActions);
  const guided: GamePort<BelaAction, SeatView> & { view: SeatView } = {
    view,
    legalActions,
    // The tutorial is one hand: "next" on the summary ends it.
    act: (a) => (a.type === 'next' ? finish() : game.act(a)),
  };
  const tip = tutorialTip(view);
  const coach = tip && (
    <aside className="flex items-start gap-3 border-b-2 border-info bg-base-300 px-4 py-3 text-base-content" aria-live="polite" aria-label={t('tut.label')}>
      <p className="flex-1 text-sm leading-snug">
        <strong className="mr-1 text-info">{t('tut.title')}:</strong>
        {fmt(t(`tut.${tip}`), {
          J: names.rank('J'),
          Q: names.rank('Q'),
          K: names.rank('K'),
          A: names.rank('A'),
          suit: names.suit('hearts').toLowerCase(),
        })}
      </p>
    </aside>
  );

  return (
    <TableScreen
      game={guided}
      coach={coach}
      nextLabel={t('tut.finish')}
      onMatchEnd={finish}
      gameActions={[{ label: t('tut.skip'), onClick: finish }]}
    />
  );
}
