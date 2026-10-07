import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAccount } from '../account/account';
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
            <AccountMenu onDone={close} />
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

function AccountMenu({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const account = useAccount();
  switch (account.status) {
    case 'unavailable':
      return (
        <ul>
          <li className="menu-disabled">
            <span>
              {t('menu.signIn')}
              <span className="badge badge-sm badge-ghost">{t('home.soon')}</span>
            </span>
          </li>
        </ul>
      );
    case 'loading':
      return (
        <ul>
          <li className="menu-disabled">
            <span>
              <span className="loading loading-spinner loading-xs" /> {t('menu.signIn')}
            </span>
          </li>
        </ul>
      );
    case 'signedOut':
      return (
        <ul>
          <li>
            <button type="button" onClick={() => { onDone(); account.signInWithGoogle(); }}>
              <GoogleIcon />
              {t('menu.signInGoogle')}
            </button>
          </li>
        </ul>
      );
    case 'signedIn':
      return (
        <ul>
          <li className="menu-disabled">
            <span className="flex items-center gap-2 opacity-100">
              <span className="avatar">
                <span className="w-7 rounded-full bg-base-300">
                  {account.profile?.image && <img src={account.profile.image} alt="" referrerPolicy="no-referrer" />}
                </span>
              </span>
              <span className="text-base-content">{account.profile?.name ?? '…'}</span>
            </span>
          </li>
          <li>
            <button type="button" onClick={() => { onDone(); account.signOut(); }}>
              {t('menu.signOut')}
            </button>
          </li>
        </ul>
      );
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
