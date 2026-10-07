import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUIT_SYMBOL, SUITS, cardId, sameCard, type Card as CardT } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import type { StringKey } from '../../../i18n/strings';
import { Card } from '../../../ui/Card';
import { AppShell, type MenuAction } from '../../../ui/AppShell';
import { Modal, ModalActions } from '../../../ui/Modal';
import { SPEED_DELAYS, useSettings } from '../../../ui/settings';
import { useGame } from '../../../ui/useGame';
import { HUMAN_SEAT } from '../engine';
import { belaGame } from '../game';
import type { BelaAction, BelaOptions } from '../state';
import type { SeatView } from '../view';
import { HandSummary } from './HandSummary';
import { NewGameDialog } from './NewGameDialog';
import { positionOf, type Position } from './positions';
import { ScoreSheet } from './ScoreSheet';

const SEAT_NAME: Record<Position, StringKey> = {
  bottom: 'seat.you',
  top: 'seat.partner',
  left: 'seat.left',
  right: 'seat.right',
};

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function BelaTable() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { speed } = useSettings();
  const { view, act, newGame, quit } = useGame(belaGame, {
    humanSeat: HUMAN_SEAT,
    botDelay: SPEED_DELAYS[speed].bot,
    autoDelay: SPEED_DELAYS[speed].auto,
    storageKey: 'bela:v2',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [lastOptions, setLastOptions] = useState<BelaOptions>(belaGame.defaultOptions);

  const start = (o: BelaOptions) => {
    setLastOptions(o);
    setShowSettings(false);
    newGame(o);
  };

  const gameActions: MenuAction[] = view
    ? [
        { label: t('nav.newGame'), onClick: () => setShowSettings(true) },
        { label: t('score.sheet'), onClick: () => setShowSheet(true) },
        { label: t('nav.rules'), onClick: () => navigate('/rules/bela') },
      ]
    : [];

  if (!view) {
    return (
      <AppShell fixed>
        <div className="felt-bg flex-1" />
        <NewGameDialog initial={lastOptions} onStart={start} onCancel={() => navigate('/')} />
      </AppShell>
    );
  }

  return (
    <AppShell fixed gameActions={gameActions} center={<ScoreBar view={view} />}>
      <div className="felt-bg flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_220px]">
        <Table view={view} onAct={act} />
        <aside className="hidden lg:block p-3 pl-0">
          <div className="card bg-base-100 shadow-md">
            <div className="card-body p-3">
              <h3 className="card-title text-base">{t('score.sheet')}</h3>
              <ScoreSheet view={view} />
            </div>
          </div>
        </aside>
      </div>

      {showSheet && (
        <Modal title={t('score.sheet')}>
          <ScoreSheet view={view} />
          <ModalActions>
            <button type="button" className="btn" onClick={() => setShowSheet(false)}>
              {t('settings.cancel')}
            </button>
          </ModalActions>
        </Modal>
      )}
      {(view.phase === 'handOver' || view.phase === 'matchOver') && (
        <HandSummary view={view} onNext={() => act({ type: 'next' })} onNewGame={() => setShowSettings(true)} />
      )}
      {showSettings && (
        <NewGameDialog
          initial={view.options}
          onStart={(o) => {
            quit();
            start(o);
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </AppShell>
  );
}

function ScoreBar({ view }: { view: SeatView }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
      <div className="flex items-baseline gap-1.5 text-sm whitespace-nowrap" aria-live="polite">
        {t('team.us')} <strong className="text-lg text-primary tabular-nums">{view.scores[0]}</strong>
        <span className="opacity-50">:</span>
        <strong className="text-lg text-primary tabular-nums">{view.scores[1]}</strong> {t('team.them')}
      </div>
      {view.trump && view.callerSeat !== null && (
        <div className="badge badge-lg bg-white text-neutral border-0 gap-1" title={t('trump.label')}>
          <span className={`suit suit--${view.trump} text-xl leading-none`}>{SUIT_SYMBOL[view.trump]}</span>
          <span className="text-xs hidden sm:inline">{t(SEAT_NAME[positionOf(view.callerSeat, view.options)])}</span>
        </div>
      )}
    </div>
  );
}

type Act = (a: BelaAction) => void;

function Table({ view, onAct }: { view: SeatView; onAct: Act }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CardT | null>(null);
  useEffect(() => setSelected(null), [view.isMyTurn, view.phase]);

  const canPlay = (c: CardT) => view.playable.some((l) => sameCard(l, c));
  const play = (c: CardT) => {
    if (!canPlay(c)) return;
    if (canHover() || (selected && sameCard(selected, c))) onAct({ type: 'play', card: c });
    else setSelected(c);
  };
  const playing = view.phase === 'play';

  return (
    <main className="felt">
      {view.seats
        .filter((s) => s.seat !== view.seat)
        .map((s) => (
          <Opponent key={s.seat} view={view} seat={s.seat} />
        ))}

      <div className="trick" aria-label="trick">
        {view.trick.map((p) => (
          <Card
            key={cardId(p.card)}
            card={p.card}
            className={`trick-card trick-card--${positionOf(p.seat, view.options)} ${
              view.trickComplete && p.winning ? 'trick-card--win' : ''
            }`}
          />
        ))}
      </div>
      <DeclarationsAnnouncement view={view} />

      <section className="me">
        <SeatBubble view={view} seat={view.seat} />
        <div className={`hand ${playing && view.isMyTurn ? 'hand--active' : ''}`}>
          {view.hand.map((c) => (
            <Card
              key={cardId(c)}
              card={c}
              className="hand-card"
              label={`${c.rank} ${t(`suit.${c.suit}` as StringKey)}`}
              onClick={() => play(c)}
              disabled={playing ? !canPlay(c) : false}
              selected={!!selected && sameCard(selected, c)}
            />
          ))}
          {Array.from({ length: view.hiddenTalon }, (_, i) => (
            <Card key={`talon${i}`} faceDown className="hand-card hand-card--talon" />
          ))}
        </div>
        {playing && view.isMyTurn && <p className="your-turn text-sm font-bold text-warning">{t('status.yourTurn')}</p>}
      </section>

      {view.phase === 'trump' && view.isMyTurn && <TrumpPicker view={view} onAct={onAct} />}
    </main>
  );
}

function Opponent({ view, seat }: { view: SeatView; seat: number }) {
  const { t } = useI18n();
  const pos = positionOf(seat, view.options);
  const count = view.seats[seat].cardCount;
  return (
    <section className={`opponent opponent--${pos}`} aria-label={t(SEAT_NAME[pos])}>
      <div className="opp-cards" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} faceDown className="opp-card" />
        ))}
      </div>
      <span className="opp-count badge badge-neutral">{count}</span>
      <SeatBubble view={view} seat={seat} />
    </section>
  );
}

function SeatBubble({ view, seat }: { view: SeatView; seat: number }) {
  const { t } = useI18n();
  const info = view.seats[seat];
  let note = '';
  if (info.passed) note = t('status.passed');
  else if (info.isTurn && seat !== view.seat) note = t('status.thinking');
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
      <span className={`badge badge-sm ${info.isTurn ? 'badge-warning' : 'badge-neutral'}`}>
        {t(SEAT_NAME[positionOf(seat, view.options)])}
        {note && <em className="font-normal">{note}</em>}
      </span>
      {info.isDealer && (
        <span className="badge badge-xs badge-soft" title="dealer">
          D
        </span>
      )}
      {info.bela && <span className="badge badge-sm badge-error">{t('decl.bela')}</span>}
    </div>
  );
}

function TrumpPicker({ view, onAct }: { view: SeatView; onAct: Act }) {
  const { t } = useI18n();
  return (
    <div
      className="trump-panel card bg-base-100 shadow-xl absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-10 w-[min(360px,calc(100%-32px))]"
      role="dialog"
      aria-label={t('trump.title')}
    >
      <div className="card-body p-4">
        <h2 className="card-title justify-center">{t('trump.title')}</h2>
        {view.mustCall && <div className="alert alert-warning alert-soft py-2">{t('trump.forced')}</div>}
        <div className="grid grid-cols-4 gap-2">
          {SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              className="trump-btn btn btn-outline h-auto flex-col gap-0 py-2 bg-white text-neutral hover:bg-base-200"
              onClick={() => onAct({ type: 'call', suit })}
            >
              <span className={`suit suit--${suit} text-3xl leading-none`}>{SUIT_SYMBOL[suit]}</span>
              <span className="text-xs font-normal">{t(`suit.${suit}` as StringKey)}</span>
            </button>
          ))}
        </div>
        {!view.mustCall && (
          <div className="card-actions justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => onAct({ type: 'pass' })}>
              {t('trump.pass')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ANNOUNCE_MS = 3000;

/** Shows the counting declarations once per hand, briefly, away from the trick. */
function DeclarationsAnnouncement({ view }: { view: SeatView }) {
  const key = view.declarations ? `${view.handNo}:${view.declarations.team}` : null;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => setDismissed(key), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key]);
  if (!key || dismissed === key) return null;
  return <Declarations view={view} onClose={() => setDismissed(key)} />;
}

function Declarations({ view, onClose }: { view: SeatView; onClose: () => void }) {
  const { t } = useI18n();
  const { team, declarations } = view.declarations!;
  return (
    <div
      className="decl-banner card bg-base-100 shadow-xl absolute top-2 left-1/2 -translate-x-1/2 z-10 cursor-pointer text-sm"
      role="status"
      onClick={onClose}
    >
      <div className="card-body p-3 gap-1">
      <strong>
        {t('decl.title')} – {t(team === 0 ? 'team.us' : 'team.them')}
      </strong>
      {declarations.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="min-w-14">{t(SEAT_NAME[positionOf(d.seat, view.options)])}</span>
          <span className="flex">
            {d.cards.map((c) => (
              <Card key={cardId(c)} card={c} className="mini-card" />
            ))}
          </span>
          <span className="ml-auto font-bold">{d.value}</span>
        </div>
      ))}
      </div>
    </div>
  );
}
