import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import { useSettings, type Speed } from './settings';

export interface MenuAction {
  label: string;
  onClick: () => void;
}

interface Props {
  /** Page-specific content in the middle of the navbar (e.g. the score). */
  center?: ReactNode;
  /** Actions for the current game, shown first in the menu. */
  gameActions?: MenuAction[];
  children: ReactNode;
  /** Full-height page without scrolling (the card table). */
  fixed?: boolean;
}

/** Navbar + side drawer menu (daisyUI) shared by every page. */
export function AppShell({ center, gameActions, children, fixed }: Props) {
  const { t, lang, setLang } = useI18n();
  const { speed, setSpeed } = useSettings();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="drawer">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" checked={open} onChange={(e) => setOpen(e.target.checked)} />
      <div className={`drawer-content flex flex-col ${fixed ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
        <header className="navbar bg-base-300/80 min-h-12 gap-2 px-2 shrink-0">
          <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label={t('menu.open')}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block size-6 stroke-current">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          {center ?? (
            <Link to="/" className="text-xl font-bold">
              <span className="text-primary">♣♥</span> Karte
            </Link>
          )}
        </header>
        {children}
      </div>

      <nav className="drawer-side z-50" aria-label={t('menu.title')}>
        <label htmlFor="app-drawer" aria-label={t('menu.close')} className="drawer-overlay" />
        <ul className="menu bg-base-200 text-base-content min-h-full w-72 p-4 gap-1">
          <li className="mb-2">
            <Link to="/" onClick={close} className="text-xl font-bold">
              <span className="text-primary">♣♥</span> Karte
            </Link>
          </li>

          {gameActions && gameActions.length > 0 && (
            <li>
              <h2 className="menu-title">{t('menu.thisGame')}</h2>
              <ul>
                {gameActions.map((a) => (
                  <li key={a.label}>
                    <button type="button" onClick={() => { close(); a.onClick(); }}>
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )}

          <li>
            <h2 className="menu-title">{t('menu.games')}</h2>
            <ul>
              <li>
                <NavLink to="/" end onClick={close}>
                  {t('nav.home')}
                </NavLink>
              </li>
              {GAMES.map((g) =>
                g.available ? (
                  <li key={g.id}>
                    <details open>
                      <summary>{g.name}</summary>
                      <ul>
                        <li>
                          <NavLink to={`/play/${g.id}`} onClick={close}>
                            {t('home.play')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to={`/rules/${g.id}`} onClick={close}>
                            {t('home.rules')}
                          </NavLink>
                        </li>
                      </ul>
                    </details>
                  </li>
                ) : (
                  <li key={g.id} className="menu-disabled">
                    <span>
                      {g.name}
                      <span className="badge badge-sm badge-ghost">{t('home.soon')}</span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </li>

          <li>
            <h2 className="menu-title">{t('menu.account')}</h2>
            <ul>
              <li className="menu-disabled">
                <span>
                  {t('menu.signIn')}
                  <span className="badge badge-sm badge-ghost">{t('home.soon')}</span>
                </span>
              </li>
            </ul>
          </li>

          <li>
            <h2 className="menu-title">{t('menu.settings')}</h2>
            <div className="flex flex-col gap-3 px-3 py-2 hover:bg-transparent active:bg-transparent cursor-default">
              <div className="flex flex-col gap-1 items-start">
                <span id="menu-language" className="text-sm opacity-70">{t('menu.language')}</span>
                <div className="join" role="group" aria-labelledby="menu-language">
                  {(['hr', 'en'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`btn btn-sm join-item ${lang === l ? 'btn-primary' : ''}`}
                      onClick={() => setLang(l)}
                    >
                      {l === 'hr' ? 'Hrvatski' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span id="menu-speed" className="text-sm opacity-70">{t('menu.speed')}</span>
                <div className="join" role="group" aria-labelledby="menu-speed">
                  {(['slow', 'normal', 'fast'] as Speed[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn btn-sm join-item ${speed === s ? 'btn-primary' : ''}`}
                      onClick={() => setSpeed(s)}
                    >
                      {t(`speed.${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}
