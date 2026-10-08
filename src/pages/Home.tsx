import { Link } from 'react-router-dom';
import { useAccount } from '../account/account';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';
import { AppShell } from '../ui/AppShell';

export function Home() {
  const { t } = useI18n();
  const online = useAccount().status !== 'unavailable';
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-12">
        <div className="hero py-10">
          <div className="hero-content text-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold">
                <span className="text-primary">♣♥</span> Karte
              </h1>
              <p className="mt-2 opacity-70">{t('app.tagline')}</p>
            </div>
          </div>
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-70 mb-3">{t('home.choose')}</h2>
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <li key={g.id} className={`card bg-base-200 shadow-md ${g.available ? '' : 'opacity-60'}`}>
              <div className="card-body">
                <h3 className="card-title text-2xl">
                  {g.name}
                  {!g.available && <span className="badge badge-ghost">{t('home.soon')}</span>}
                </h3>
                <p className="opacity-80">{t(g.descriptionKey as StringKey)}</p>
                <div className="badge badge-outline">
                  {t('home.players')}: {g.players}
                </div>
                {g.available && (
                  <div className="card-actions justify-end mt-2">
                    <Link className="btn btn-ghost" to={`/rules/${g.id}`}>
                      {t('home.rules')}
                    </Link>
                    {online && g.id === 'bela' && (
                      <Link className="btn btn-outline" to="/online">
                        {t('menu.online')}
                      </Link>
                    )}
                    <Link className="btn btn-primary" to={`/play/${g.id}`}>
                      {t('home.play')}
                    </Link>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
