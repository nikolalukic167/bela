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
  const setFlag = useMutation(api.admin.setFlag);
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

        {overview && (
          <section className="card bg-base-200 mb-6">
            <div className="card-body">
              <h2 className="card-title">Usage, last 30 days</h2>
              {overview.usage.warn && (
                <div role="alert" className="alert alert-warning">
                  Estimated function calls are at {Math.round((overview.usage.estimatedCalls / overview.usage.quota) * 100)} % of the free-tier
                  quota. See docs/operations.md.
                </div>
              )}
              <div className="stats stats-vertical sm:stats-horizontal bg-base-100">
                <div className="stat">
                  <div className="stat-title">Tables created</div>
                  <div className="stat-value">{overview.usage.tables}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Moves stored</div>
                  <div className="stat-value">{overview.usage.actions}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Function calls (est.)</div>
                  <div className="stat-value">{overview.usage.estimatedCalls}</div>
                  <div className="stat-desc">of {overview.usage.quota} per month</div>
                </div>
              </div>
              <p className="text-sm opacity-70">
                Counted daily for the previous UTC day ({overview.usage.days.length} days so far). The real numbers are on the Convex
                dashboard's Usage page.
              </p>
            </div>
          </section>
        )}

        {overview && (
          <section className="card bg-base-200 mb-6">
            <div className="card-body">
              <h2 className="card-title">Feature flags</h2>
              <div className="flex flex-wrap gap-6">
                {(Object.keys(overview.flags) as (keyof typeof overview.flags)[]).map((name) => (
                  <label key={name} className="label cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={overview.flags[name]}
                      disabled={busy}
                      onChange={(e) => void run(`${name} ${e.target.checked ? 'on' : 'off'}`, () => setFlag({ name, on: e.target.checked }))}
                    />
                    {name}
                  </label>
                ))}
              </div>
              <p className="text-sm opacity-70">Kill switches for everyone, effective at once. ratings off: no new rated tables and no rating changes.</p>
            </div>
          </section>
        )}

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
      </main>
    </AppShell>
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
