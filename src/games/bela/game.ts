import type { GameDefinition } from '../../core/game';
import { levelBot } from './bots';
import { apply, autoAction, currentPlayer, legalActions, seatCount, setup } from './engine';
import { DEFAULT_RULES, type BelaAction, type BelaOptions, type BelaState } from './state';
import { viewFor, type SeatView } from './view';

export const belaGame: GameDefinition<BelaState, BelaAction, BelaOptions, SeatView> = {
  id: 'bela',
  defaultOptions: { target: 1001, direction: 'ccw', ...DEFAULT_RULES, botLevel: 'medium' },
  seats: seatCount,
  setup,
  currentPlayer,
  legalActions,
  apply,
  autoAction,
  isOver: (s) => s.phase === 'matchOver',
  view: viewFor,
  bot: levelBot,
};
