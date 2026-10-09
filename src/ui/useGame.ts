import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition } from '../core/game';
import type { GamePort } from './gamePort';
import { createRng, randomSeed } from '../core/rng';
import { loadJson, removeKey, saveJson } from './storage';

interface Options {
  humanSeat: number;
  botDelay: number;
  autoDelay: number;
  storageKey: string;
}

/**
 * Drives any GameDefinition: applies human actions, runs bots and automatic
 * system actions with delays, and persists the game to localStorage.
 * The UI only gets the human seat's view.
 */
export function useGame<S, A, O, V>(def: GameDefinition<S, A, O, V>, opts: Options): GamePort<A, V> & {
  newGame: (options: O) => void;
  /** Starts from a prepared state (e.g. the tutorial's fixed deal). */
  load: (state: S) => void;
  quit: () => void;
} {
  const [state, setState] = useState<S | null>(() => loadJson<S>(opts.storageKey));
  const rngRef = useRef(createRng(randomSeed()));

  useEffect(() => {
    if (state) saveJson(opts.storageKey, state);
  }, [state, opts.storageKey]);

  useEffect(() => {
    if (!state || def.isOver(state)) return;
    const auto = def.autoAction(state);
    const player = def.currentPlayer(state);
    const commit = (action: A) => setState((s) => (s === state ? def.apply(s, action) : s));
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (auto) {
      timers.push(setTimeout(() => commit(auto), opts.autoDelay));
    } else if (player !== null && player !== opts.humanSeat) {
      // Think time varies (±40%) so bots don't feel mechanical. The move is
      // computed after the last card has painted; slow bots eat into the delay.
      const think = opts.botDelay * (0.6 + 0.8 * Math.random());
      const paint = 30;
      timers.push(
        setTimeout(() => {
          const t0 = performance.now();
          const action = def.bot(def.view(state, player), rngRef.current);
          const rest = Math.max(0, think - paint - (performance.now() - t0));
          timers.push(setTimeout(() => commit(action), rest));
        }, paint),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [state, def, opts.humanSeat, opts.botDelay, opts.autoDelay]);

  const act = useCallback((a: A) => setState((s) => (s ? def.apply(s, a) : s)), [def]);

  const newGame = useCallback((options: O) => setState(def.setup(options, randomSeed())), [def]);

  const load = useCallback((s: S) => setState(s), []);

  const quit = useCallback(() => {
    removeKey(opts.storageKey);
    setState(null);
  }, [opts.storageKey]);

  const view = state ? def.view(state, opts.humanSeat) : null;
  const legalActions = state ? def.legalActions(state, opts.humanSeat) : [];
  return { view, legalActions, act, newGame, load, quit };
}
