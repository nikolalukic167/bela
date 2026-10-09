import { useMutation, useQuery } from 'convex/react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { CODE_LENGTH } from '../../convex/lib/config';
import { belaGame } from '../games/bela/game';
import { NewGameDialog } from '../games/bela/ui/NewGameDialog';
import type { BelaOptions } from '../games/bela/state';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';
import { errorKey } from './errors';
import { OnlineGate } from './OnlineGate';

/** Bot levels the server can afford inside a mutation (expert is offline-only). */
const ONLINE_LEVELS = ['easy', 'medium', 'hard'] as const;
const DEFAULTS: BelaOptions = { ...belaGame.defaultOptions, target: 501 };

export function OnlineLobbyPage() {
  return (
    <OnlineGate>
      <OnlineLobby />
    </OnlineGate>
  );
}

function OnlineLobby() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const tables = useQuery(api.tables.mine, {});
  const create = useMutation(api.tables.create);
  const join = useMutation(api.tables.join);
  const [creating, setCreating] = useState(false);
  const [rated, setRated] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError(t(errorKey(e)));

  const onCreate = async (o: BelaOptions) => {
    setCreating(false);
    setError(null);
    try {
      const botLevel = o.botLevel === 'expert' ? 'hard' : o.botLevel;
      const created = await create({ options: { ...o, botLevel }, rated });
      navigate(`/t/${created}`);
    } catch (e) {
      fail(e);
    }
  };

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const found = await join({ code });
      if (found === null) setError(t('err.NOT_FOUND'));
      else navigate(`/t/${found}`);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl px-4 pb-12">
        <h1 className="text-3xl font-bold py-8">{t('online.title')}</h1>
        {error && (
          <div role="alert" className="alert alert-error alert-soft mb-4">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card bg-base-200 shadow-md">
            <div className="card-body">
              <h2 className="card-title">{t('online.create')}</h2>
              <p className="opacity-70 text-sm">{t(rated ? 'online.ratedHint' : 'online.startHint')}</p>
              <label className="label cursor-pointer gap-2">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={rated} onChange={(e) => setRated(e.target.checked)} />
                {t('online.rated')}
              </label>
              <div className="card-actions">
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  {t('online.create')}
                </button>
              </div>
            </div>
          </section>
          <form className="card bg-base-200 shadow-md" onSubmit={onJoin}>
            <div className="card-body">
              <h2 className="card-title">{t('online.join')}</h2>
              <input
                className="input w-full uppercase tracking-widest"
                aria-label={t('online.codeLabel')}
                placeholder={t('online.codeLabel')}
                value={code}
                maxLength={CODE_LENGTH}
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="card-actions">
                <button type="submit" className="btn btn-primary" disabled={code.trim().length < 4}>
                  {t('online.join')}
                </button>
              </div>
            </div>
          </form>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-70 mt-8 mb-3">{t('online.myTables')}</h2>
        {tables === undefined ? (
          <span className="loading loading-spinner" />
        ) : tables.length === 0 ? (
          <p className="opacity-70">{t('online.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tables.map((x) => (
              <li key={x.code} className="card card-side bg-base-200 items-center px-4 py-3 gap-3">
                <span className="font-mono tracking-widest text-lg">{x.code}</span>
                <span className="badge badge-ghost">{t(`online.status.${x.status}`)}</span>
                <span className="opacity-70 text-sm">{x.players}/4</span>
                <Link className="btn btn-sm btn-primary ml-auto" to={`/t/${x.code}`}>
                  {t('online.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      {creating && (
        <NewGameDialog
          initial={DEFAULTS}
          levels={ONLINE_LEVELS}
          startLabel={t('online.create')}
          onStart={(o) => void onCreate(o)}
          onCancel={() => setCreating(false)}
        />
      )}
    </AppShell>
  );
}
