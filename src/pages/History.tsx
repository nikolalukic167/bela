import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAccount } from '../account/account';
import { mergeHistory, summarize, type HistoryEntry } from '../games/bela/history';
import { loadLocalHistory } from '../games/bela/ui/localHistory';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';

export function History() {
  const { t } = useI18n();
  const account = useAccount();
  const local = loadLocalHistory();
  const signedIn = account.status === 'signedIn';
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">{t('history.title')}</h1>
        {signedIn ? <WithOnline local={local} /> : <HistoryList entries={local} />}
        {!signedIn && account.status !== 'unavailable' && <p className="mt-4 text-sm opacity-70">{t('history.signInHint')}</p>}
      </main>
    </AppShell>
  );
}

/** Rendered only when signed in, so the offline build never calls a Convex hook. */
function WithOnline({ local }: { local: HistoryEntry[] }) {
  const online = useQuery(api.tables.history, {});
  if (online === undefined) return <span className="loading loading-spinner" />;
  return (
    <>
      <MyRating />
      <HistoryList entries={mergeHistory(local, online)} />
    </>
  );
}

/** Rating card with a sparkline of its history; hidden until the first rated match. */
function MyRating() {
  const { t } = useI18n();
  const r = useQuery(api.ratings.mine, {});
  if (!r) return null;
  const points = [0, ...r.history.map((h) => h.rating)];
  const lo = Math.min(...points);
  const span = Math.max(...points) - lo || 1;
  const path = points.map((p, i) => `${(i / Math.max(1, points.length - 1)) * 100},${30 - ((p - lo) / span) * 28 - 1}`).join(' ');
  return (
    <section className="card bg-base-200 mb-6" aria-label={t('rating.mine')}>
      <div className="card-body flex-row items-center gap-6 p-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest opacity-70">{t('rating.mine')}</div>
          <div className="text-4xl font-extrabold tabular-nums text-primary">{r.rating.toFixed(1)}</div>
          <div className="text-sm opacity-70">
            {r.games} {t('rating.games')}
            {r.provisional && <span className="badge badge-sm badge-ghost ml-2">{t('rating.provisional')}</span>}
          </div>
        </div>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-14 flex-1 text-primary" aria-hidden="true">
          <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </section>
  );
}

function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  const { t, lang } = useI18n();
  const total = summarize(entries);
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  if (entries.length === 0) return <p className="opacity-70">{t('history.empty')}</p>;
  return (
    <>
      <div className="stats shadow-md bg-base-200 w-full mb-6">
        <div className="stat px-3 sm:px-6">
          <div className="stat-title">{t('history.played')}</div>
          <div className="stat-value text-2xl sm:text-4xl text-primary">{total.played}</div>
        </div>
        <div className="stat px-3 sm:px-6">
          <div className="stat-title">{t('history.wins')}</div>
          <div className="stat-value text-2xl sm:text-4xl">{total.won}</div>
        </div>
        <div className="stat px-3 sm:px-6">
          <div className="stat-title">{t('history.rate')}</div>
          <div className="stat-value text-2xl sm:text-4xl">{total.rate}%</div>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <li key={e.id} className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-4 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${e.won ? 'badge-success' : 'badge-error'}`}>{t(e.won ? 'history.win' : 'history.loss')}</span>
                <strong className="text-lg tabular-nums">
                  {t('team.us')} {e.scores[0]} : {e.scores[1]} {t('team.them')}
                </strong>
                <span className="badge badge-ghost badge-sm ml-auto">{t(e.source === 'online' ? 'history.online' : 'history.device')}</span>
              </div>
              <div className="text-sm opacity-70">
                {date.format(e.playedAt)} · {t('history.upTo')} {e.target} · {e.players.length ? e.players.join(', ') : t('history.withBots')}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
