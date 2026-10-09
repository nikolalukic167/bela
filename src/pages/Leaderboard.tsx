import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAccount } from '../account/account';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';

export function Leaderboard() {
  const { t } = useI18n();
  const account = useAccount();
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">{t('board.title')}</h1>
        <p className="text-sm opacity-70 mb-6">{t('board.hint')}</p>
        {account.status === 'unavailable' ? <p className="opacity-70">{t('online.unavailable')}</p> : <Board />}
      </main>
    </AppShell>
  );
}

/** Rendered only with a Convex client; the leaderboard query is public, so no sign-in needed. */
function Board() {
  const { t } = useI18n();
  const rows = useQuery(api.ratings.leaderboard, {});
  if (rows === undefined) return <span className="loading loading-spinner" />;
  if (rows.length === 0) return <p className="opacity-70">{t('board.empty')}</p>;
  return (
    <table className="table bg-base-200 rounded-2xl">
      <thead>
        <tr>
          <th className="w-12">#</th>
          <th>{t('board.player')}</th>
          <th className="text-right">{t('board.rating')}</th>
          <th className="text-right">{t('board.games')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rank}>
            <td className="tabular-nums">{r.rank}</td>
            <td className="font-bold">{r.name}</td>
            <td className="text-right tabular-nums">{r.rating.toFixed(1)}</td>
            <td className="text-right tabular-nums opacity-70">{r.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
