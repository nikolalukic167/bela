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
  const [copied, setCopied] = useState<string | null>(null);
  const lobby = data.status === 'lobby';
  const seated = data.mySeat !== null;
  const hasEmpty = data.seats.some((s) => s.kind === 'empty');
  const link = `${window.location.origin}${window.location.pathname}#/t/${code}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked: the link is shown for manual copying */
    }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: link, title: code });
        return;
      } catch {
        /* dismissed or unsupported: fall back to copying */
      }
    }
    await copy(link, 'link');
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 pb-12">
        {error && (
          <div role="alert" className="alert alert-error alert-soft mt-4 mb-4">
            {error}
          </div>
        )}

        <div className="card mt-4 mb-5 rounded-3xl bg-base-200">
          <div className="card-body items-center gap-3.5 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-base-content/70">{t('online.codeLabel')}</div>
            <div className="font-display text-6xl font-extrabold leading-none tracking-[0.12em]" aria-label={code}>
              {code}
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-ghost">{t(`online.status.${data.status}`)}</span>
              {data.isTest && <span className="badge badge-warning">test</span>}
            </div>
            {lobby && (
              <>
                <div className="flex w-full gap-2.5">
                  <button type="button" className="btn btn-outline h-12 flex-1 rounded-2xl border-accent" onClick={() => void copy(code, 'code')}>
                    {copied === 'code' ? t('online.copied') : t('online.copyCode')}
                  </button>
                  <button type="button" className="btn btn-primary h-12 flex-1 rounded-2xl" onClick={() => void share()}>
                    {copied === 'link' ? t('online.copied') : t('online.shareLink')}
                  </button>
                </div>
                <input readOnly className="input input-sm w-full font-mono" value={link} aria-label={t('online.copyLink')} onFocus={(e) => e.currentTarget.select()} />
              </>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2.5">
          {[0, 1].map((team) => (
            <section key={team} aria-label={t(team === 0 ? 'online.teamA' : 'online.teamB')} className="flex flex-col gap-2.5">
              <h2 className="mt-1 text-xs font-bold uppercase tracking-widest text-base-content/70">{t(team === 0 ? 'online.teamA' : 'online.teamB')}</h2>
              {data.seats
                .filter((s) => s.seat % 2 === team)
                .map((s) => (
                  <div
                    key={s.seat}
                    className={`flex items-center gap-3 rounded-2xl bg-base-300 px-3.5 py-3 ${s.kind === 'empty' ? 'border border-dashed border-accent' : ''}`}
                  >
                    {s.kind === 'empty' ? (
                      <span className="size-10 shrink-0 rounded-full border border-dashed border-accent" aria-hidden="true" />
                    ) : (
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-full font-bold ${s.isMe ? 'bg-primary text-primary-content' : 'bg-secondary text-secondary-content'}`}
                        aria-hidden="true"
                      >
                        {(s.name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold">{s.kind === 'empty' ? t('online.emptySeat') : s.name}</span>
                      <span className="truncate text-sm text-base-content/70">
                        {s.kind === 'empty'
                          ? t('online.emptyHint')
                          : [s.isMe && t('online.you'), s.kind === 'bot' && t('online.bot'), data.isHost && s.isMe && t('online.host')]
                              .filter(Boolean)
                              .join(' · ')}
                      </span>
                    </div>
                    {lobby && data.isHost && s.kind !== 'empty' && !s.isMe && (
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => void guard(() => clearSeat({ code, seat: s.seat }))}>
                        {t('online.remove')}
                      </button>
                    )}
                  </div>
                ))}
            </section>
          ))}
        </div>

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
              <button type="button" className="btn btn-primary h-[52px] w-full rounded-2xl text-[17px] order-first" onClick={() => void guard(() => start({ code }))}>
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
