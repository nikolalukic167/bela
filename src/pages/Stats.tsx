import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAccount } from '../account/account';
import { summarizeStats, type Stats as StatsSummary } from '../games/bela/stats';
import { loadLocalHistory } from '../games/bela/ui/localHistory';
import { useI18n } from '../i18n/i18n';
import { MyRating } from '../online/MyRating';
import { AppShell } from '../ui/AppShell';

/**
 * Personal stats (architecture §2, Phase 3): online matches with rating graph and partners,
 * and local games against bots in their own, labelled section. Whether local games should
 * count is an open decision (§14.2), so they are never mixed in.
 */
export function Stats() {
  const { t } = useI18n();
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  const local = summarizeStats(loadLocalHistory().map((e) => ({ won: e.won, points: e.scores[0], hands: e.hands })));
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">{t('stats.title')}</h1>
        {signedIn && <OnlineStats />}
        {!signedIn && account.status !== 'unavailable' && <p className="mb-6 text-sm text-base-content/75">{t('stats.signInHint')}</p>}
        <section aria-labelledby="stats-local" className="mt-8">
          <h2 id="stats-local" className="text-lg font-bold">
            {t('stats.local')}
          </h2>
          <p className="mb-3 text-sm text-base-content/75">{t('stats.localNote')}</p>
          <StatTiles s={local} />
        </section>
      </main>
    </AppShell>
  );
}

/** Rendered only when signed in, so the offline build never calls a Convex hook. */
function OnlineStats() {
  const { t } = useI18n();
  const data = useQuery(api.stats.mine, {});
  return (
    <section aria-labelledby="stats-online">
      <h2 id="stats-online" className="mb-3 text-lg font-bold">
        {t('stats.online')}
      </h2>
      <MyRating />
      {data === undefined ? (
        <span className="loading loading-spinner" />
      ) : (
        <>
          <StatTiles s={data.summary} />
          <h3 className="mt-6 mb-2 font-bold">{t('stats.partners')}</h3>
          {data.partners.length === 0 ? (
            <p className="text-sm text-base-content/75">{t('stats.noPartners')}</p>
          ) : (
            <table className="table table-sm tabular-nums">
              <thead>
                <tr>
                  <th scope="col">{t('stats.partner')}</th>
                  <th scope="col" className="text-right">{t('stats.games')}</th>
                  <th scope="col" className="text-right">{t('stats.winRate')}</th>
                </tr>
              </thead>
              <tbody>
                {data.partners.map((p) => (
                  <tr key={p.name + p.games}>
                    <th scope="row" className="font-medium">{p.name}</th>
                    <td className="text-right">{p.games}</td>
                    <td className="text-right">{Math.round((p.wins / p.games) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

const fmt = (template: string, values: Record<string, number>) => template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

function StatTiles({ s }: { s: StatsSummary }) {
  const { t } = useI18n();
  if (s.games === 0) return <p className="text-sm text-base-content/75">{t('stats.empty')}</p>;
  const pct = (v: number | null) => (v === null ? '–' : `${v}%`);
  const tiles: { label: string; value: string; detail?: string }[] = [
    { label: t('stats.games'), value: String(s.games) },
    { label: t('stats.winRate'), value: pct(s.winRate), detail: `${s.wins}/${s.games}` },
    { label: t('stats.avgPoints'), value: String(s.avgPoints ?? '–') },
  ];
  if (s.hands > 0) {
    tiles.push(
      { label: t('stats.callRate'), value: pct(s.callRate), detail: fmt(t('stats.callDetail'), { calls: s.calls, hands: s.hands }) },
      { label: t('stats.fallRate'), value: pct(s.fallRate), detail: fmt(t('stats.fallDetail'), { falls: s.falls, calls: s.calls }) },
      { label: t('stats.avgHand'), value: String(s.avgHandPoints ?? '–') },
    );
  }
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl bg-base-200 p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-base-content/75">{tile.label}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">{tile.value}</dd>
            {tile.detail && <dd className="text-xs text-base-content/75">{tile.detail}</dd>}
          </div>
        ))}
      </dl>
      {s.gamesWithHands < s.games && s.hands > 0 && (
        <p className="mt-2 text-xs text-base-content/75">{fmt(t('stats.partialHands'), { n: s.gamesWithHands, total: s.games })}</p>
      )}
    </>
  );
}
