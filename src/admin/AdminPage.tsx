// Internal tool, deliberately English-only and not linked anywhere except the menu of admins.
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAccount } from '../account/account';
import { AppShell } from '../ui/AppShell';
import { OnlineGate } from '../online/OnlineGate';

/**
 * Hidden admin panel. Real users are sent home without a hint that it exists; the server
 * answers NOT_FOUND to every admin function for non-admins, so this guard is only UX.
 */
export function AdminPage() {
  return (
    <OnlineGate>
      <AdminGuard />
    </OnlineGate>
  );
}

function AdminGuard() {
  const account = useAccount();
  if (account.status !== 'signedIn') return null;
  if (account.profile === null) return <Loading />;
  if (!account.profile.isAdmin) return <Navigate to="/" replace />;
  return <Admin />;
}

const Loading = () => (
  <AppShell>
    <main className="p-8 text-center">
      <span className="loading loading-spinner" />
    </main>
  </AppShell>
);

function Admin() {
  const overview = useQuery(api.admin.overview, {});
  const seed = useMutation(api.admin.seed);
  const clear = useMutation(api.admin.clearTestData);
  const startMatch = useMutation(api.admin.startBotMatch);
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [speed, setSpeed] = useState<'live' | 'fast'>('live');
  const [target, setTarget] = useState<501 | 701 | 1001>(501);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(`${label}: done`);
    } catch (e) {
      const code = (e as { data?: { code?: string } }).data?.code;
      setMessage(`${label}: failed${code ? ` (${code})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl px-4 pb-12">
        <h1 className="text-3xl font-bold py-8">
          Admin <span className="badge badge-warning align-middle">test tools</span>
        </h1>
        {message && (
          <div role="status" className="alert alert-info alert-soft mb-4">
            {message}
          </div>
        )}

        <section className="card bg-base-200 mb-6">
          <div className="card-body">
            <h2 className="card-title">Overview</h2>
            {overview === undefined ? (
              <span className="loading loading-spinner" />
            ) : (
              <div className="stats stats-vertical sm:stats-horizontal bg-base-100">
                <div className="stat">
                  <div className="stat-title">Test bot accounts</div>
                  <div className="stat-value">{overview.testUsers}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Test tables</div>
                  <div className="stat-value">{overview.tables.length}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Real tables</div>
                  <div className="stat-value">{overview.realTables}</div>
                  <div className="stat-desc">not touched by these tools</div>
                </div>
              </div>
            )}
            <div className="card-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run('Seed', () => seed({}))}>
                Seed test data
              </button>
              <button
                type="button"
                className="btn btn-error btn-outline"
                disabled={busy}
                onClick={() => window.confirm('Delete all test tables and test bot accounts?') && void run('Clear', () => clear({}))}
              >
                Delete test data
              </button>
            </div>
            <p className="text-sm opacity-70">
              Seed creates 6 bot accounts, an open lobby you can join, one live bot match and two finished ones. Test data is
              hidden from real users and removed by “Delete test data”.
            </p>
          </div>
        </section>

        <section className="card bg-base-200 mb-6">
          <div className="card-body">
            <h2 className="card-title">Start a bot match</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <Select label="Bot level" value={level} onChange={setLevel} options={['easy', 'medium', 'hard']} />
              <Select label="Speed" value={speed} onChange={setSpeed} options={['live', 'fast']} />
              <Select label="Target" value={String(target)} onChange={(v) => setTarget(Number(v) as 501 | 701 | 1001)} options={['501', '701', '1001']} />
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void run('Bot match', () => startMatch({ level, speed, target }))}
              >
                Start
              </button>
            </div>
            <p className="text-sm opacity-70">“fast” plays the whole match in one go; “live” plays one move per second so you can watch it.</p>
          </div>
        </section>

        <section className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title">Test tables</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Players</th>
                    <th>Level</th>
                    <th>Hand</th>
                    <th>Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview?.tables.map((x) => (
                    <tr key={x.code}>
                      <td className="font-mono">{x.code}</td>
                      <td>
                        <span className={`badge badge-sm ${x.status === 'playing' ? 'badge-success' : 'badge-ghost'}`}>{x.status}</span>{' '}
                        <span className="opacity-60 text-xs">{x.speed}</span>
                      </td>
                      <td className="text-xs">{x.seats.map((s) => s ?? '–').join(', ')}</td>
                      <td>{x.level}</td>
                      <td>{x.handNo ?? ''}</td>
                      <td className="tabular-nums">{x.scores ? `${x.scores[0]} : ${x.scores[1]} / ${x.target}` : ''}</td>
                      <td>
                        <Link className="btn btn-xs" to={`/t/${x.code}`}>
                          {x.status === 'lobby' ? 'Open' : 'Watch'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {overview && overview.tables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="opacity-60">
                        No test tables. Seed some above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <Reports />
      </main>
    </AppShell>
  );
}

/** Player reports and the moderation log (architecture §9.4). */
function Reports() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const reports = useQuery(api.moderation.reports, { status });
  const log = useQuery(api.moderation.log, {});
  const resolve = useMutation(api.moderation.resolve);
  const when = (at: number) => new Date(at).toLocaleString('en-GB');
  return (
    <>
      <section className="card bg-base-200 mt-6">
        <div className="card-body">
          <h2 className="card-title">Reports</h2>
          <div className="join">
            {(['open', 'resolved'] as const).map((s) => (
              <button key={s} type="button" className={`btn btn-sm join-item ${status === s ? 'btn-primary' : ''}`} onClick={() => setStatus(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Reported</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Table</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports?.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs">{when(r.createdAt)}</td>
                    <td className="font-bold">{r.reported}</td>
                    <td>{r.reason}</td>
                    <td>{r.reporter}</td>
                    <td className="font-mono">{r.tableCode ?? ''}</td>
                    <td className="flex gap-1">
                      {r.status === 'open' ? (
                        <>
                          <button type="button" className="btn btn-xs" onClick={() => void resolve({ reportId: r.id, action: 'dismiss' })}>
                            Dismiss
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-warning"
                            onClick={() => window.confirm(`Rename ${r.reported} to a neutral name?`) && void resolve({ reportId: r.id, action: 'resetName' })}
                          >
                            Reset name
                          </button>
                        </>
                      ) : (
                        <span className="text-xs opacity-70">{r.resolution}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {reports && reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="opacity-60">
                      No {status} reports.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card bg-base-200 mt-6">
        <div className="card-body">
          <h2 className="card-title">Moderation log</h2>
          <ul className="text-sm flex flex-col gap-1">
            {log?.map((l) => (
              <li key={l.id}>
                <span className="opacity-60">{when(l.at)}</span> · <b>{l.actor}</b> {l.action} {l.target}
              </li>
            ))}
            {log && log.length === 0 && <li className="opacity-60">Nothing yet.</li>}
          </ul>
        </div>
      </section>
    </>
  );
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <label className="fieldset">
      <span className="fieldset-legend">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
