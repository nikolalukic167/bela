import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import type { BelaAction } from '../games/bela/state';
import { TableScreen } from '../games/bela/ui/BelaTable';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';
import { errorKey } from './errors';
import { OnlineGate } from './OnlineGate';

export function OnlineTablePage() {
  const { code = '' } = useParams();
  return (
    <OnlineGate>
      <OnlineTable code={code.toUpperCase()} />
    </OnlineGate>
  );
}

type Watched = NonNullable<ReturnType<typeof useQuery<typeof api.tables.watch>>>;

function OnlineTable({ code }: { code: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const data = useQuery(api.tables.watch, { code });
  const act = useMutation(api.tables.act);
  const leave = useMutation(api.tables.leave);
  const [error, setError] = useState<string | null>(null);

  const guard = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  };

  if (data === undefined) {
    return (
      <AppShell>
        <main className="p-8 text-center">
          <span className="loading loading-spinner" />
        </main>
      </AppShell>
    );
  }
  if (data === null) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="mb-4">{t('online.notFound')}</p>
          <Link to="/online" className="btn btn-primary">
            {t('online.back')}
          </Link>
        </main>
      </AppShell>
    );
  }

  if (data.view) {
    const names = data.seats.map((s) => s.name);
    const leaveGame = () => window.confirm(t('online.leaveRunning')) && guard(async () => {
      await leave({ code });
      navigate('/online');
    });
    return (
      <>
        <TableScreen
          view={data.view}
          names={names}
          spectating={data.spectating}
          onAct={(a: BelaAction) => {
            if (a.type !== 'collect') void guard(() => act({ code, action: a })); // collecting is the server's job
          }}
          onMatchEnd={() => navigate('/online')}
          gameActions={[
            { label: t('online.back'), onClick: () => navigate('/online') },
            ...(data.mySeat !== null && data.status !== 'finished' ? [{ label: t('online.leave'), onClick: () => void leaveGame() }] : []),
          ]}
        />
        {data.spectating && <div className="toast toast-top toast-center"><div className="alert alert-info">{t('online.spectating')}</div></div>}
        {error && <div className="toast toast-top toast-center"><div role="alert" className="alert alert-error">{error}</div></div>}
      </>
    );
  }

  return <TableLobby data={data} code={code} error={error} guard={guard} />;
}

function TableLobby({ data, code, error, guard }: { data: Watched; code: string; error: string | null; guard: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const join = useMutation(api.tables.join);
  const leave = useMutation(api.tables.leave);
  const addBot = useMutation(api.tables.addBot);
  const clearSeat = useMutation(api.tables.clearSeat);
  const start = useMutation(api.tables.start);
  const [copied, setCopied] = useState(false);
  const lobby = data.status === 'lobby';
  const seated = data.mySeat !== null;
  const hasEmpty = data.seats.some((s) => s.kind === 'empty');
  const link = `${window.location.origin}${window.location.pathname}#/t/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is shown for manual copying */
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 pb-12">
        <div className="py-8">
          <h1 className="text-3xl font-bold">
            <span className="font-mono tracking-widest">{code}</span>
          </h1>
          <span className="badge badge-ghost mt-2">{t(`online.status.${data.status}`)}</span>
          {data.isTest && <span className="badge badge-warning ml-2">test</span>}
        </div>
        {error && (
          <div role="alert" className="alert alert-error alert-soft mb-4">
            {error}
          </div>
        )}

        {lobby && (
          <div className="card bg-base-200 mb-4">
            <div className="card-body p-4 gap-2">
              <p className="text-sm opacity-80">{t('online.share')}</p>
              <input readOnly className="input input-sm w-full font-mono" value={link} aria-label={t('online.copyLink')} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-sm self-start" onClick={() => void copy()}>
                {copied ? t('online.copied') : t('online.copyLink')}
              </button>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2 mb-6">
          {data.seats.map((s) => (
            <li key={s.seat} className="card bg-base-200 px-4 py-3 flex-row items-center gap-3">
              <div className="text-xs opacity-60 w-20 shrink-0">
                {t('online.seat')} {s.seat + 1}
                <br />
                {t(s.seat % 2 === 0 ? 'online.teamA' : 'online.teamB')}
              </div>
              <div className="flex-1 min-w-0 truncate">
                {s.kind === 'empty' ? <span className="opacity-50">{t('online.empty')}</span> : <strong>{s.name}</strong>}
                {s.isMe && <span className="badge badge-sm badge-primary ml-2">{t('online.you')}</span>}
                {s.kind === 'bot' && <span className="badge badge-sm badge-ghost ml-2">{t('online.bot')}</span>}
                {data.isHost && s.isMe && <span className="badge badge-sm badge-ghost ml-2">{t('online.host')}</span>}
              </div>
              {lobby && data.isHost && s.kind !== 'empty' && !s.isMe && (
                <button type="button" className="btn btn-xs btn-ghost" onClick={() => void guard(() => clearSeat({ code, seat: s.seat }))}>
                  {t('online.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {lobby && !seated && hasEmpty && (
            <button type="button" className="btn btn-primary" onClick={() => void guard(() => join({ code }))}>
              {t('online.sitDown')}
            </button>
          )}
          {lobby && data.isHost && (
            <>
              <button type="button" className="btn" disabled={!hasEmpty} onClick={() => void guard(() => addBot({ code }))}>
                {t('online.addBot')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void guard(() => start({ code }))}>
                {t('online.start')}
              </button>
            </>
          )}
          {seated && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                void guard(async () => {
                  await leave({ code });
                  navigate('/online');
                })
              }
            >
              {t('online.leave')}
            </button>
          )}
          <Link to="/online" className="btn btn-ghost">
            {t('online.back')}
          </Link>
        </div>
        {lobby && data.isHost && <p className="text-sm opacity-70 mt-3">{t('online.startHint')}</p>}
        {!lobby && !seated && <p className="text-sm opacity-70 mt-3">{t('online.watching')}</p>}
      </main>
    </AppShell>
  );
}
