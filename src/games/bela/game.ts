import type { GameDefinition } from '../../core/game';
import { chooseAction } from './bot';
import { apply, autoAction, currentPlayer, legalActions, setup } from './engine';
import { DEFAULT_RULES, type BelaAction, type BelaOptions, type BelaState } from './state';
import { viewFor, type SeatView } from './view';

export const belaGame: GameDefinition<BelaState, BelaAction, BelaOptions, SeatView> = {
  id: 'bela',
  defaultOptions: { target: 1001, direction: 'ccw', ...DEFAULT_RULES },
  setup,
  currentPlayer,
  legalActions,
  apply,
  autoAction,
  isOver: (s) => s.phase === 'matchOver',
  view: viewFor,
  bot: chooseAction,
};
