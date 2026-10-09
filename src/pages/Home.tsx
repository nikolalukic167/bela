import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from '../account/account';
import { GAMES } from '../core/registry';
import { useI18n } from '../i18n/i18n';
import { BOT_LEVELS, DEFAULT_BOT_LEVEL, type BotLevel } from '../games/bela/bots';
import type { BelaState } from '../games/bela/state';
import type { Card as CardT } from '../core/cards';
import { TUTORIAL_DONE_KEY } from '../games/bela/ui/BelaTutorial';
import { AppShell } from '../ui/AppShell';
import { Card } from '../ui/Card';
import { BookIcon, ClockIcon, GlobeIcon, PlayIcon, TrophyIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { loadJson, saveJson } from '../ui/storage';

export const BOT_LEVEL_KEY = 'bela:level';

function greetingKey(hour: number) {
  if (hour < 11) return 'home.greet.morning' as const;
  if (hour < 18) return 'home.greet.day' as const;
  return 'home.greet.evening' as const;
}

/** Jack, nine and ace of hearts, the top trumps, in the viewer's own deck. */
const FAN: { card: CardT; className: string }[] = [
  { card: { suit: 'hearts', rank: 'J' }, className: 'left-0 top-3 -rotate-[14deg]' },
  { card: { suit: 'hearts', rank: '9' }, className: 'left-7 top-0 -rotate-2' },
  { card: { suit: 'hearts', rank: 'A' }, className: 'left-14 top-3 rotate-[10deg]' },
];

const Fan = () => (
  <div className="relative mr-1 h-[92px] w-[112px] shrink-0" aria-hidden="true" style={{ '--cw': '56px' } as CSSProperties}>
    {FAN.map(({ card, className }) => (
      <Card key={card.rank} card={card} className={`absolute origin-bottom ${className}`} />
    ))}
  </div>
);

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
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
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
            {resumable ? (
              <>
                <Link to="/play/bela" className="btn btn-primary h-auto min-h-[52px] flex-col gap-0 rounded-2xl py-2 text-[17px]">
                  {t('home.resume')}
                  <span className="text-xs font-normal tabular-nums opacity-80">
                    {t('home.continueInfo')
                      .replace('{hand}', String(resumable.handNo + 1))
                      .replace('{us}', t('team.us'))
                      .replace('{them}', t('team.them'))
                      .replace('{usScore}', String(resumable.scores[0]))
                      .replace('{themScore}', String(resumable.scores[1]))}
                  </span>
                </Link>
                <button type="button" className="btn btn-outline h-[52px] rounded-2xl border-accent text-[17px]" onClick={play}>
                  {t('home.newGame')}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary h-[52px] rounded-2xl text-[17px]" onClick={play}>
                <PlayIcon />
                {t('home.playBots')}
              </button>
            )}
            {online && (
              <Link to="/online" className="btn btn-outline h-[52px] rounded-2xl border-accent text-[17px]">
                <GlobeIcon />
                {t('home.playOnline')}
              </Link>
            )}
            <Link
              to="/tutorial"
              className={`btn btn-ghost h-auto min-h-11 rounded-2xl py-2 text-sm ${loadJson<boolean>(TUTORIAL_DONE_KEY) ? '' : 'text-primary underline'}`}
            >
              {t('tut.start')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  const online = useAccount().status !== 'unavailable';
  const soon = GAMES.filter((g) => !g.available);
  const links = [
    { to: '/rules/bela', label: t('home.rules'), Icon: BookIcon },
    { to: '/history', label: t('tab.history'), Icon: ClockIcon },
    ...(online ? [{ to: '/leaderboard', label: t('menu.leaderboard'), Icon: TrophyIcon }] : []),
  ];
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl px-4 pb-8 sm:pb-12">
        <div className="py-6 sm:py-10">
          <h1>
            <Logo size="lg" />
            <span className="sr-only"> – {t('brand.tagline')}</span>
          </h1>
          <p className="mt-3 text-base-content/75">{t(greetingKey(new Date().getHours()))}</p>
        </div>
        <BelaPanel online={online} />
        <nav aria-label={t('home.links')} className={`mt-4 grid gap-2 ${links.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {links.map(({ to, label, Icon }) => (
            <Link key={to} to={to} className="btn h-auto min-h-16 flex-col gap-1 rounded-2xl border-0 bg-base-200 py-3 text-sm font-medium">
              <Icon className="size-5 text-primary" />
              {label}
            </Link>
          ))}
        </nav>
        {soon.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('home.choose')}>
            {soon.map((g) => (
              <li key={g.id} className="badge badge-ghost">
                {g.name} · {t('home.soon')}
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
