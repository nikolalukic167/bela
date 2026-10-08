import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAccount } from '../account/account';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import { BOT_LEVELS, DEFAULT_BOT_LEVEL, type BotLevel } from '../games/bela/bots';
import type { BelaState } from '../games/bela/state';
import { AppShell } from '../ui/AppShell';
import { loadJson, saveJson } from '../ui/storage';

export const BOT_LEVEL_KEY = 'bela:level';

function greetingKey(hour: number) {
  if (hour < 11) return 'home.greet.morning' as const;
  if (hour < 18) return 'home.greet.day' as const;
  return 'home.greet.evening' as const;
}

const Fan = () => (
  <div className="relative h-[72px] w-24 shrink-0" aria-hidden="true">
    {[
      ['J', 'left-0 top-2.5 -rotate-[14deg] text-neutral'],
      ['9', 'left-6 top-1 -rotate-2 text-error'],
      ['A', 'left-12 top-2.5 rotate-[10deg] text-neutral'],
    ].map(([r, c]) => (
      <div key={r} className={`absolute h-[66px] w-12 rounded-[7px] bg-[#fbfaf5] px-1.5 py-1 text-base font-bold shadow-md ${c}`}>
        {r}
      </div>
    ))}
  </div>
);

/** Phone-only tab bar from the concept; "Ljestvica" joins once ratings have a page. */
function TabBar({ online }: { online: boolean }) {
  const { t } = useI18n();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-bold text-primary' : 'text-base-content/70'}`;
  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-base-300 bg-base-300 pb-[env(safe-area-inset-bottom)] sm:hidden ${online ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      <NavLink to="/" end className={tab}>
        {t('tab.play')}
      </NavLink>
      {online && (
        <NavLink to="/online" className={tab}>
          {t('tab.online')}
        </NavLink>
      )}
      <NavLink to="/rules/bela" className={tab}>
        {t('tab.rules')}
      </NavLink>
    </nav>
  );
}

function BelaPanel({ online }: { online: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [level, setLevel] = useState<BotLevel>(() => loadJson<BotLevel>(BOT_LEVEL_KEY) ?? DEFAULT_BOT_LEVEL);
  const saved = loadJson<BelaState>('bela:v2');
  const resumable = saved && saved.phase !== 'matchOver' ? saved : null;
  const play = () => {
    saveJson(BOT_LEVEL_KEY, level);
    navigate('/play/bela', { state: { autostart: level } });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="card bg-base-200 rounded-3xl">
        <div className="card-body gap-6 p-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-5xl font-extrabold leading-none">Bela</h2>
              <p className="mt-1.5 text-sm text-base-content/75">{t('home.teams')}</p>
            </div>
            <Fan />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/70">{t('home.botStrength')}</legend>
            <div className="grid grid-cols-4 gap-1 rounded-box bg-base-300 p-1" role="radiogroup">
              {BOT_LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  className={`btn btn-sm h-11 min-h-11 rounded-[10px] border-0 px-1 text-sm ${level === l ? 'btn-primary font-bold' : 'btn-ghost font-medium text-base-content/75'}`}
                  onClick={() => setLevel(l)}
                >
                  {t(`botLevel.${l}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2.5">
            <button type="button" className="btn btn-primary h-[52px] rounded-2xl text-[17px]" onClick={play}>
              {t('home.playBots')}
            </button>
            {online && (
              <Link to="/online" className="btn btn-outline h-[52px] rounded-2xl border-accent text-[17px]">
                {t('home.playOnline')}
              </Link>
            )}
          </div>
        </div>
      </div>
      {resumable && (
        <Link to="/play/bela" className="card card-side items-center justify-between rounded-2xl bg-base-300 px-4 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-base-content/70">{t('home.continue')}</div>
            <div className="font-medium tabular-nums">
              {t('home.continueInfo')
                .replace('{hand}', String(resumable.handNo))
                .replace('{us}', t('team.us'))
                .replace('{them}', t('team.them'))
                .replace('{usScore}', String(resumable.scores[0]))
                .replace('{themScore}', String(resumable.scores[1]))}
            </div>
          </div>
          <span className="text-2xl text-primary" aria-hidden="true">›</span>
        </Link>
      )}
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  const online = useAccount().status !== 'unavailable';
  const soon = GAMES.filter((g) => !g.available);
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 pb-24 sm:pb-12">
        <div className="py-6 sm:py-10">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-primary">♣♥</span> Karte
          </h1>
          <p className="mt-2 text-base-content/70">{t(greetingKey(new Date().getHours()))}</p>
        </div>
        <BelaPanel online={online} />
        {soon.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('home.choose')}>
            {soon.map((g) => (
              <li key={g.id} className="badge badge-ghost">
                {g.name} · {t('home.soon')}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-base-content/60">{t('home.more')}</p>
      </main>
      <TabBar online={online} />
    </AppShell>
  );
}
