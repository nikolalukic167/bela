import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { HEARTBEAT_MS } from '../../convex/lib/config';
import type { BelaAction } from '../games/bela/state';
import type { SeatView } from '../games/bela/view';
import { useI18n } from '../i18n/i18n';
import type { GamePort } from '../ui/gamePort';
import { errorKey } from './errors';
import { needsHeartbeat, secondsLeft, serverAction } from './onlineGame';

export type Watched = NonNullable<ReturnType<typeof useQuery<typeof api.tables.watch>>>;

export interface OnlineGame extends GamePort<BelaAction, SeatView> {
  /** The table as `tables.watch` returns it: undefined while loading, null when not found. */
  table: Watched | null | undefined;
  /** The last failed request, translated. */
  error: string | null;
  /** Runs a request, translating a server error into `error`. */
  guard: (fn: () => Promise<unknown>) => Promise<void>;
}

/**
 * The online adapter (architecture §8): the same `{view, legalActions, act}` as `useGame`,
 * fed by `tables.watch` and sending moves to `tables.act`. It also keeps the seat alive with
 * heartbeats and runs the turn countdown, so table screens don't deal with either.
 */
export function useOnlineGame(code: string): OnlineGame {
  const { t } = useI18n();
  const table = useQuery(api.tables.watch, { code });
  const send = useMutation(api.tables.act);
  const [error, setError] = useState<string | null>(null);
  useHeartbeat(code, needsHeartbeat(table));
  const view = table?.view ?? null;
  const now = useClock(table?.deadline != null);

  const guard = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(t(errorKey(e)));
      }
    },
    [t],
  );

  const act = useCallback(
    (a: BelaAction) => {
      const action = serverAction(a);
      if (action) void guard(() => send({ code, action }));
    },
    [code, guard, send],
  );

  return {
    table,
    view,
    legalActions: view && !table?.spectating ? view.legal : [],
    act,
    secondsLeft: secondsLeft(table?.deadline ?? null, now, view),
    error,
    guard,
  };
}

/**
 * Tells the server this player is still at the table. After the reconnect grace period
 * without one, a bot stands in; the first heartbeat after returning takes the seat back.
 */
function useHeartbeat(code: string, active: boolean) {
  const heartbeat = useMutation(api.tables.heartbeat);
  useEffect(() => {
    if (!active) return;
    const beat = () => void heartbeat({ code }).catch(() => {}); // a missed beat is harmless: the next one retries
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [code, active, heartbeat]);
}

/** The current time, ticking once a second while a deadline is running. */
function useClock(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}
