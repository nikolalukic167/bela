import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SUIT_SYMBOL, SUITS, cardId, sameCard, type Card as CardT, type Suit } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import type { StringKey } from '../../../i18n/strings';
import { Card } from '../../../ui/Card';
import { AppShell, type MenuAction } from '../../../ui/AppShell';
import { Modal, ModalActions } from '../../../ui/Modal';
import { SPEED_DELAYS, useSettings } from '../../../ui/settings';
import { useGame } from '../../../ui/useGame';
import { HUMAN_SEAT } from '../engine';
import { belaGame } from '../game';
import { BOT_LEVELS, type BotLevel } from '../bots';
import { recordLocal, saveLocalGame } from '../history';
import type { BelaAction, BelaOptions } from '../state';
import type { SeatView } from '../view';
import { HandSummary } from './HandSummary';
import { NewGameDialog } from './NewGameDialog';
import { positionOf, type Position } from './positions';
import { perspective } from './perspective';
import { ScoreSheet } from './ScoreSheet';

const SEAT_NAME: Record<Position, StringKey> = {
  bottom: 'seat.you',
  top: 'seat.partner',
  left: 'seat.left',
  right: 'seat.right',
};

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Real player names for online tables, indexed by seat. Local games use the seat labels instead. */
const SeatNames = createContext<(string | null)[] | null>(null);

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
  const [lastOptions, setLastOptions] = useState<BelaOptions>(belaGame.defaultOptions);
  // Home's "Igraj protiv botova" arrives with the chosen strength and starts straight away.
  const autostart = (useLocation().state as { autostart?: BotLevel } | null)?.autostart;
  useEffect(() => {
    if (view || !autostart || !BOT_LEVELS.includes(autostart)) return;
    const o = { ...belaGame.defaultOptions, botLevel: autostart };
    setLastOptions(o);
    newGame(o);
    navigate('/play/bela', { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = view?.phase === 'matchOver' ? view : null;
  useEffect(() => {
    if (finished) saveLocalGame(recordLocal(finished, Date.now()));
  }, [finished?.handNo, finished?.scores[0], finished?.scores[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (o: BelaOptions) => {
    setLastOptions(o);
    setShowSettings(false);
    newGame(o);
  };

  if (!view) {
    return (
      <AppShell fixed>
        <div className="felt-bg flex-1" />
        <NewGameDialog initial={lastOptions} onStart={start} onCancel={() => navigate('/')} />
      </AppShell>
    );
  }

  return (
    <>
      <TableScreen
        view={view}
        onAct={act}
        onMatchEnd={() => setShowSettings(true)}
        gameActions={[{ label: t('nav.newGame'), onClick: () => setShowSettings(true) }]}
      />
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
    </>
  );
}

interface ScreenProps {
  /** The seat's view; teams are re-oriented so "us" is the viewer's team. */
  view: SeatView;
  onAct: Act;
  /** Pressed on the match-over summary. */
  onMatchEnd: () => void;
  /** Extra entries at the top of the menu (new game, leave table...). */
  gameActions?: MenuAction[];
  /** Player names by seat (online). */
  names?: (string | null)[];
  /** Watching a bot match: no controls, no hand summary dialog. */
  spectating?: boolean;
}

/** Navbar score, felt table, score sheet and hand summary: shared by local and online play. */
export function TableScreen({ view: rawView, onAct, onMatchEnd, gameActions = [], names, spectating }: ScreenProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);
  const view = perspective(rawView);
  const actions: MenuAction[] = [
    ...gameActions,
    { label: t('score.sheet'), onClick: () => setShowSheet(true) },
    { label: t('nav.rules'), onClick: () => navigate('/rules/bela') },
  ];

  return (
    <SeatNames.Provider value={names ?? null}>
      <AppShell fixed gameActions={actions} center={<ScoreBar view={view} />}>
        <div className="felt-bg flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_220px]">
          <Table view={view} onAct={spectating ? () => undefined : onAct} />
          <aside className="hidden lg:block p-3 pl-0">
            <div className="card bg-base-300 shadow-md">
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
        {!spectating && (view.phase === 'handOver' || view.phase === 'matchOver') && (
          <HandSummary view={view} onNext={() => onAct({ type: 'next' })} onNewGame={onMatchEnd} />
        )}
      </AppShell>
    </SeatNames.Provider>
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
            className={`trick-card trick-card--${positionOf(p.seat, view.options, view.seat)} ${
              view.trickComplete && p.winning ? 'trick-card--win' : ''
            }`}
          />
        ))}
      </div>
      <HandInfo view={view} />
      <TrumpToast view={view} />
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
  const pos = positionOf(seat, view.options, view.seat);
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
  const names = useContext(SeatNames);
  const info = view.seats[seat];
  let note = '';
  if (info.passed) note = t('status.passed');
  else if (info.isTurn && seat !== view.seat) note = t('status.thinking');
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
      <span className={`badge badge-sm ${info.isTurn ? 'badge-warning' : 'badge-neutral'}`}>
        {names?.[seat] ?? t(SEAT_NAME[positionOf(seat, view.options, view.seat)])}
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
      className="trump-panel card bg-base-300 shadow-xl absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-10 w-[min(360px,calc(100%-32px))]"
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

/** Always-visible trump tile and declarations chip, so neither is lost after the announcement. */
function HandInfo({ view }: { view: SeatView }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const decl = view.declarations;
  useEffect(() => setOpen(false), [view.handNo]);
  if (!view.trump && !decl) return null;
  return (
    <div className="absolute left-2 top-2 z-[5] flex flex-col items-start gap-1.5">
      {view.trump && view.callerSeat !== null && (
        <div
          className="flex flex-col items-center rounded-box bg-white text-neutral shadow-lg px-2.5 py-1 leading-none"
          role="status"
          aria-label={`${t('trump.label')}: ${t(`suit.${view.trump}` as StringKey)}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{t('trump.label')}</span>
          <span className={`suit suit--${view.trump} text-4xl leading-none`}>{SUIT_SYMBOL[view.trump]}</span>
          <span className="text-[10px] opacity-70">{t(SEAT_NAME[positionOf(view.callerSeat, view.options, view.seat)])}</span>
        </div>
      )}
      {decl && (
        <>
          <button type="button" className="btn btn-xs btn-warning shadow-md" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t('decl.title')} · {t(decl.team === 0 ? 'team.us' : 'team.them')} {decl.declarations.reduce((n, d) => n + d.value, 0)}
          </button>
          {open && <Declarations view={view} onClose={() => setOpen(false)} className="top-full mt-1 left-0 w-max max-w-[calc(100vw-24px)]" />}
        </>
      )}
    </div>
  );
}

const ANNOUNCE_MS = 3000;
const TRUMP_TOAST_DELAY_MS = 300;
const TRUMP_TOAST_MS = 2500;

/** Briefly announces who called trump, but only when the call happens in front of us. */
function TrumpToast({ view }: { view: SeatView }) {
  const { t } = useI18n();
  const names = useContext(SeatNames);
  const before = useRef({ hand: view.handNo, trump: view.trump });
  const [call, setCall] = useState<{ id: number; seat: number; suit: Suit } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prev = before.current;
    before.current = { hand: view.handNo, trump: view.trump };
    if (prev.hand === view.handNo && !prev.trump && view.trump && view.callerSeat !== null) {
      setCall({ id: Date.now(), seat: view.callerSeat, suit: view.trump });
    }
  }, [view.handNo, view.trump, view.callerSeat]);

  useEffect(() => {
    if (!call) return;
    const show = setTimeout(() => setVisible(true), TRUMP_TOAST_DELAY_MS);
    const hide = setTimeout(() => setVisible(false), TRUMP_TOAST_DELAY_MS + TRUMP_TOAST_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      setVisible(false);
    };
  }, [call]);

  if (!call || !visible) return null;
  const who = names?.[call.seat] ?? t(SEAT_NAME[positionOf(call.seat, view.options, view.seat)]);
  return (
    <div
      className="decl-banner alert bg-white text-neutral shadow-xl absolute top-[36%] left-1/2 -translate-x-1/2 z-10 w-max max-w-[calc(100%-24px)] cursor-pointer py-2"
      role="status"
      onClick={() => setVisible(false)}
    >
      <span className={`suit suit--${call.suit} text-3xl leading-none`}>{SUIT_SYMBOL[call.suit]}</span>
      <span className="font-bold">
        {who} {t('trump.announce')}: {t(`suit.${call.suit}` as StringKey)}
      </span>
    </div>
  );
}

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
  return <Declarations view={view} onClose={() => setDismissed(key)} className="top-2 left-1/2 -translate-x-1/2" />;
}

function Declarations({ view, onClose, className }: { view: SeatView; onClose: () => void; className: string }) {
  const { t } = useI18n();
  const names = useContext(SeatNames);
  const { team, declarations } = view.declarations!;
  return (
    <div
      className={`decl-banner card bg-base-300 shadow-xl absolute z-10 cursor-pointer text-sm ${className}`}
      role="status"
      onClick={onClose}
    >
      <div className="card-body p-3 gap-1">
      <strong>
        {t('decl.title')} – {t(team === 0 ? 'team.us' : 'team.them')}
      </strong>
      {declarations.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="min-w-14">{names?.[d.seat] ?? t(SEAT_NAME[positionOf(d.seat, view.options, view.seat)])}</span>
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
