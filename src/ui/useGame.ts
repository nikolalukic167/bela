import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition } from '../core/game';
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
 */
export function useGame<S, A, O>(def: GameDefinition<S, A, O>, opts: Options) {
  const [state, setState] = useState<S | null>(() => loadJson<S>(opts.storageKey));
  const rngRef = useRef(createRng(randomSeed()));

  useEffect(() => {
    if (state) saveJson(opts.storageKey, state);
  }, [state, opts.storageKey]);

  useEffect(() => {
    if (!state || def.isOver(state)) return;
    const auto = def.autoAction(state);
    const player = def.currentPlayer(state);
    let next: A | null = null;
    let delay = opts.botDelay;
    if (auto) {
      next = auto;
      delay = opts.autoDelay;
    } else if (player !== null && player !== opts.humanSeat) {
      next = def.bot(state, player, rngRef.current);
    }
    if (next === null) return;
    const action = next;
    const timer = setTimeout(() => setState((s) => (s === state ? def.apply(s, action) : s)), delay);
    return () => clearTimeout(timer);
  }, [state, def, opts.humanSeat, opts.botDelay, opts.autoDelay]);

  const act = useCallback(
    (a: A) => setState((s) => (s ? def.apply(s, a) : s)),
    [def],
  );

  const newGame = useCallback(
    (options: O) => setState(def.setup(options, randomSeed())),
    [def],
  );

  const quit = useCallback(() => {
    removeKey(opts.storageKey);
    setState(null);
  }, [opts.storageKey]);

  return { state, act, newGame, quit };
}
