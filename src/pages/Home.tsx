import { Link } from 'react-router-dom';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import type { StringKey } from '../i18n/strings';

export function Home() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="home">
      <header className="home-header">
        <h1>
          <span className="logo" aria-hidden="true">♣♥</span> Karte
        </h1>
        <p>{t('app.tagline')}</p>
        <button type="button" className="btn btn--ghost lang-btn" onClick={() => setLang(lang === 'hr' ? 'en' : 'hr')}>
          {lang === 'hr' ? 'English' : 'Hrvatski'}
        </button>
      </header>
      <h2 className="home-sub">{t('home.choose')}</h2>
      <ul className="game-list">
        {GAMES.map((g) => (
          <li key={g.id} className={`game-tile ${g.available ? '' : 'game-tile--soon'}`}>
            <h3>{g.name}</h3>
            <p>{t(g.descriptionKey as StringKey)}</p>
            <p className="game-meta">
              {t('home.players')}: {g.players}
            </p>
            {g.available ? (
              <div className="tile-actions">
                <Link className="btn" to={`/play/${g.id}`}>
                  {t('home.play')}
                </Link>
                <Link className="btn btn--ghost" to={`/rules/${g.id}`}>
                  {t('home.rules')}
                </Link>
              </div>
            ) : (
              <span className="soon">{t('home.soon')}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
