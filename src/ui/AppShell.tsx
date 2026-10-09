import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAccount } from '../account/account';
import { SignInDialog } from '../account/SignInDialog';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import { DECK_IDS, DECKS, DeckPreview } from './decks';
import { BookIcon, CardsIcon, ClockIcon, GlobeIcon, HomeIcon, LogInIcon, LogOutIcon, MenuIcon, ShieldIcon, TrophyIcon, UserIcon, WrenchIcon } from './icons';
import { Logo } from './Logo';
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
  const { speed, setSpeed, deck, setDeck } = useSettings();
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const online = useAccount().status !== 'unavailable';
  const atHome = useLocation().pathname === '/';
  const close = () => setOpen(false);
  useEffect(() => DECKS[deck].preload?.(), [deck]);

  return (
    <div className="drawer">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" checked={open} onChange={(e) => setOpen(e.target.checked)} />
      <div className={`drawer-content flex flex-col ${fixed ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
        <header className="navbar bg-base-300/80 min-h-12 gap-1 px-2 shrink-0">
          <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label={t('menu.open')}>
            <MenuIcon className="size-6" />
          </label>
          {!atHome && (
            <Link to="/" className="btn btn-square btn-ghost" aria-label={t('nav.home')} title={t('nav.home')}>
              <HomeIcon className="size-6" />
            </Link>
          )}
          {/* Home shows the big logo itself. */}
          {center ?? (!atHome && (
            <Link to="/" className="ml-1" aria-label={`Karte – ${t('nav.home')}`}>
              <Logo />
            </Link>
          ))}
        </header>
        {fixed ? children : <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</div>}
        {!fixed && <TabBar online={online} />}
      </div>

      <nav className="drawer-side z-50" aria-label={t('menu.title')}>
        <label htmlFor="app-drawer" aria-label={t('menu.close')} className="drawer-overlay" />
        <ul className="menu bg-base-200 text-base-content min-h-full w-72 p-4 gap-1">
          <li className="mb-2">
            <Link to="/" onClick={close} aria-label={`Karte – ${t('nav.home')}`}>
              <Logo />
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
                  <HomeIcon />
                  {t('nav.home')}
                </NavLink>
              </li>
              {online && (
                <li>
                  <NavLink to="/online" onClick={close}>
                    <GlobeIcon />
                    {t('menu.online')}
                  </NavLink>
                </li>
              )}
              {online && (
                <li>
                  <NavLink to="/leaderboard" onClick={close}>
                    <TrophyIcon />
                    {t('menu.leaderboard')}
                  </NavLink>
                </li>
              )}
              {GAMES.map((g) =>
                g.available ? (
                  <li key={g.id}>
                    <details open>
                      <summary>{g.name}</summary>
                      <ul>
                        <li>
                          <NavLink to={`/play/${g.id}`} onClick={close}>
                            <CardsIcon />
                            {t('home.play')}
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to={`/rules/${g.id}`} onClick={close}>
                            <BookIcon />
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
            <AccountMenu onDone={close} onSignIn={() => setSigningIn(true)} />
            <ul>
              <li>
                <NavLink to="/history" onClick={close}>
                  <ClockIcon />
                  {t('menu.history')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/privacy" onClick={close}>
                  <ShieldIcon />
                  {t('menu.privacy')}
                </NavLink>
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
                <span id="menu-deck" className="text-sm opacity-70">{t('menu.deck')}</span>
                <div className="join" role="group" aria-labelledby="menu-deck">
                  {DECK_IDS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={deck === d}
                      className={`btn h-auto join-item flex-col gap-1 py-2 ${deck === d ? 'btn-primary' : ''}`}
                      onClick={() => setDeck(d)}
                    >
                      <DeckPreview id={d} />
                      <span className="text-xs">{t(`deck.${d}`)}</span>
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
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
    </div>
  );
}

function AccountMenu({ onDone, onSignIn }: { onDone: () => void; onSignIn: () => void }) {
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
            <button type="button" onClick={() => { onDone(); onSignIn(); }}>
              <LogInIcon />
              {t('menu.signIn')}
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
              {account.profile?.isGuest && <span className="badge badge-sm badge-ghost">{t('auth.guestBadge')}</span>}
            </span>
          </li>
          <li>
            <NavLink to="/account" onClick={onDone}>
              <UserIcon />
              {t('menu.myAccount')}
            </NavLink>
          </li>
          {account.profile?.isAdmin && (
            <li>
              <NavLink to="/admin" onClick={onDone}>
                <WrenchIcon />
                {t('menu.admin')}
              </NavLink>
            </li>
          )}
          <li>
            <button type="button" onClick={() => { onDone(); account.signOut(); }}>
              <LogOutIcon />
              {t('menu.signOut')}
            </button>
          </li>
        </ul>
      );
  }
}

/** Phone-only bottom bar on every scrolling page, so home is always one tap away. The card table has its own layout. */
function TabBar({ online }: { online: boolean }) {
  const { t } = useI18n();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-bold text-primary' : 'text-base-content/70'}`;
  return (
    <nav
      aria-label={t('menu.title')}
      className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-base-300 bg-base-300 pb-[env(safe-area-inset-bottom)] sm:hidden ${online ? 'grid-cols-4' : 'grid-cols-3'}`}
    >
      <NavLink to="/" end className={tab}>
        <HomeIcon />
        {t('nav.home')}
      </NavLink>
      {online && (
        <NavLink to="/online" className={tab}>
          <GlobeIcon />
          {t('tab.online')}
        </NavLink>
      )}
      <NavLink to="/rules/bela" className={tab}>
        <BookIcon />
        {t('tab.rules')}
      </NavLink>
      <NavLink to="/history" className={tab}>
        <ClockIcon />
        {t('tab.history')}
      </NavLink>
    </nav>
  );
}
