import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SUITS, cardId, sameCard, type Card as CardT, type Suit } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import type { StringKey } from '../../../i18n/strings';
import { Card } from '../../../ui/Card';
import { SuitMark } from '../../../ui/decks';
import { AppShell, type MenuAction } from '../../../ui/AppShell';
import { Modal, ModalActions } from '../../../ui/Modal';
import { SPEED_DELAYS, useSettings } from '../../../ui/settings';
import type { GamePort } from '../../../ui/gamePort';
import { useGame } from '../../../ui/useGame';
import { HUMAN_SEAT } from '../engine';
import { belaGame } from '../game';
import { BOT_LEVELS, type BotLevel } from '../bots';
import { recordLocal } from '../history';
import { saveLocalGame } from './localHistory';
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
  const game = useGame(belaGame, {
    humanSeat: HUMAN_SEAT,
    botDelay: SPEED_DELAYS[speed].bot,
    autoDelay: SPEED_DELAYS[speed].auto,
    storageKey: 'bela:v2',
  });
  const { view, newGame, quit } = game;
  const [showSettings, setShowSettings] = useState(false);
  const [lastOptions, setLastOptions] = useState<BelaOptions>(belaGame.defaultOptions);
  // Home's "Igraj protiv botova" arrives with the chosen strength and starts straight away.
  const autostart = (useLocation().state as { autostart?: BotLevel } | null)?.autostart;
  useEffect(() => {
    if (!autostart || !BOT_LEVELS.includes(autostart)) return;
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
        game={{ ...game, view }}
        // "Igraj ponovno": a new match at once, same options (full options stay under menu > Nova igra).
        onMatchEnd={() => {
          quit();
          start(view.options);
        }}
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
  /** Local or online game; teams in its view are re-oriented so "us" is the viewer's team. */
  game: GamePort<BelaAction, SeatView> & { view: SeatView };
  /** Pressed on the match-over summary. */
  onMatchEnd: () => void;
  /** Extra entries at the top of the menu (new game, leave table...). */
  gameActions?: MenuAction[];
  /** Player names by seat (online). */
  names?: (string | null)[];
  /** Watching a bot match: no controls, no hand summary dialog. */
  spectating?: boolean;
  /** Guidance shown above the table and in the hand summary (tutorial). */
  coach?: ReactNode;
  /** Label of the hand summary's "next" button. */
  nextLabel?: string;
  /** Extra controls in the navbar next to the score (e.g. online quick messages). */
  toolbar?: ReactNode;
}

/** Navbar score, felt table, score sheet and hand summary: shared by local and online play. */
export function TableScreen({ game, onMatchEnd, gameActions = [], names, spectating, coach, nextLabel, toolbar }: ScreenProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showSheet, setShowSheet] = useState(false);
  const view = perspective(game.view);
  const onAct: Act = game.act;
  const actions: MenuAction[] = [
    ...gameActions,
    { label: t('score.sheet'), onClick: () => setShowSheet(true) },
    { label: t('nav.rules'), onClick: () => navigate('/rules/bela') },
  ];

  return (
    <SeatNames.Provider value={names ?? null}>
      <AppShell fixed gameActions={actions} center={<ScoreBar view={view} toolbar={toolbar} />}>
        {view.phase !== 'handOver' && view.phase !== 'matchOver' && coach}
        <div className="felt-bg flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_340px]">
          <Table view={view} legal={spectating ? [] : game.legalActions} onAct={spectating ? () => undefined : onAct} />
          <aside className="hidden lg:flex flex-col gap-4 bg-base-300 p-6">
            <div className="flex items-end justify-between">
              {view.trump ? <TrumpTile view={view} large /> : <span />}
              {(view.phase === 'play' || view.phase === 'collect') && (
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-widest text-base-content/70">{t('table.trick')}</div>
                  <div className="font-display text-3xl font-extrabold leading-tight">
                    {Math.min(8, view.tricks.length + 1)} {t('table.of')} 8
                  </div>
                </div>
              )}
            </div>
            <ScoreSheet view={view} />
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
          <HandSummary view={view} onNext={() => onAct({ type: 'next' })} onNewGame={onMatchEnd} note={coach} nextLabel={nextLabel} />
        )}
        {game.secondsLeft != null && <TurnCountdown left={game.secondsLeft} />}
      </AppShell>
    </SeatNames.Provider>
  );
}

function ScoreBar({ view, toolbar }: { view: SeatView; toolbar?: ReactNode }) {
  const { t } = useI18n();
  const tile = (label: string, score: number) => (
    <div className="flex min-w-14 flex-col items-center rounded-xl bg-base-200 px-3 py-0.5 leading-tight">
      <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/70">{label}</span>
      <strong className="font-display text-lg tabular-nums">{score}</strong>
    </div>
  );
  return (
    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
      <div className="flex gap-2" aria-live="polite">
        {tile(t('team.us'), view.scores[0])}
        {tile(t('team.them'), view.scores[1])}
      </div>
      {toolbar && <div className="flex items-center">{toolbar}</div>}
      {view.trump && (
        <div className="lg:hidden">
          <TrumpTile view={view} />
        </div>
      )}
    </div>
  );
}

/** The called suit and who called it, always on screen (navbar on phones, sidebar on desktop). */
function TrumpTile({ view, large }: { view: SeatView; large?: boolean }) {
  const { t } = useI18n();
  const names = useContext(SeatNames);
  if (!view.trump) return null;
  const caller =
    view.callerSeat === null ? null : (names?.[view.callerSeat] ?? t(SEAT_NAME[positionOf(view.callerSeat, view.options, view.seat)]));
  return (
    <div
      className={`flex flex-col items-center rounded-xl bg-[#fbfaf5] text-neutral leading-none ${large ? 'px-5 py-2' : 'min-w-14 max-w-24 px-2.5 py-1'}`}
      role="status"
      aria-label={`${t('trump.label')}: ${t(`suit.${view.trump}` as StringKey)}${caller ? `, ${t('trump.calledBy')} ${caller}` : ''}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{t('trump.label')}</span>
      <span className={`suit suit--${view.trump} ${large ? 'text-5xl' : 'text-2xl'} leading-tight`}>
        <SuitMark suit={view.trump} />
      </span>
      {caller && (
        <span className={`max-w-full truncate font-medium opacity-80 ${large ? 'mt-1 text-sm' : 'text-[10px]'}`}>
          {t('trump.calledBy')} {caller}
        </span>
      )}
    </div>
  );
}

type Act = (a: BelaAction) => void;

/** Shown for the last seconds of the viewer's turn timer; at zero the server moves for them. */
function TurnCountdown({ left }: { left: number }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-30 -translate-x-1/2" role="timer" aria-live="polite">
      <span className={`badge badge-lg ${left <= 5 ? 'badge-error' : 'badge-warning'}`}>
        {t('online.timeLeft')}: {left} s
      </span>
    </div>
  );
}

function Table({ view, legal, onAct }: { view: SeatView; legal: BelaAction[]; onAct: Act }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CardT | null>(null);
  useEffect(() => setSelected(null), [view.isMyTurn, view.phase]);

  const canPlay = (c: CardT) => legal.some((l) => l.type === 'play' && sameCard(l.card, c));
  const play = (c: CardT) => {
    if (!canPlay(c)) return;
    if (canHover() || (selected && sameCard(selected, c))) onAct({ type: 'play', card: c });
    else setSelected(c);
  };
  const playing = view.phase === 'play';

  // Keyboard play: the played card's button disappears and takes focus with it, so when the
  // turn comes back focus returns to the hand instead of the top of the page.
  const handRef = useRef<HTMLElement>(null);
  const myPlay = playing && view.isMyTurn;
  useEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (myPlay && lost) handRef.current?.querySelector<HTMLButtonElement>('button.hand-card:not(:disabled)')?.focus();
  }, [myPlay]);

  return (
    <main className="felt">
      {view.seats
        .filter((s) => s.seat !== view.seat)
        .map((s) => (
          <Opponent key={s.seat} view={view} seat={s.seat} />
        ))}

      <div className="trick" role="group" aria-label={t('table.trick')}>
        {view.trick.map((p) => (
          <Card
            key={cardId(p.card)}
            card={p.card}
            label={cardLabel(p.card, t)}
            className={`trick-card trick-card--${positionOf(p.seat, view.options, view.seat)} ${
              view.trickComplete && p.winning ? 'trick-card--win' : ''
            }`}
          />
        ))}
      </div>
      <HandInfo view={view} />
      <TrumpToast view={view} />
      <DeclarationsAnnouncement view={view} />

      <section className="me" ref={handRef} onKeyDown={moveFocus}>
        <SeatBubble view={view} seat={view.seat} />
        <div className={`hand ${playing && view.isMyTurn ? 'hand--active' : ''}`}>
          {view.hand.map((c) => (
            <Card
              key={cardId(c)}
              card={c}
              className="hand-card"
              label={cardLabel(c, t)}
              onClick={() => play(c)}
              disabled={playing ? !canPlay(c) : false}
              selected={!!selected && sameCard(selected, c)}
            />
          ))}
          {Array.from({ length: view.hiddenTalon }, (_, i) => (
            <Card key={`talon${i}`} faceDown className="hand-card hand-card--talon" />
          ))}
        </div>
        {playing && view.isMyTurn && <p className="your-turn text-sm font-bold text-primary">{t('status.yourTurn')}</p>}
        {playing && view.isMyTurn && !canHover() && (
          <div className="flex w-full max-w-md items-center justify-between gap-3 px-3">
            <span className="text-xs text-base-content/70">{t('table.tapHint')}</span>
            <button type="button" className="btn btn-primary" disabled={!selected} onClick={() => selected && onAct({ type: 'play', card: selected })}>
              {t('table.play')}
              {selected && (
                <>
                  {' '}
                  {selected.rank}
                  <span className={`suit suit--${selected.suit}`}><SuitMark suit={selected.suit} /></span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {view.phase === 'trump' && legal.length > 0 && <TrumpPicker view={view} legal={legal} onAct={onAct} />}
    </main>
  );
}

const cardLabel = (c: CardT, t: (k: StringKey) => string) => `${c.rank} ${t(`suit.${c.suit}` as StringKey)}`;

/** Left/right arrows move between the playable cards of the hand. */
function moveFocus(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const cards = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.hand-card:not(:disabled)')];
  const i = cards.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  cards[(i + (e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length].focus();
}

function Opponent({ view, seat }: { view: SeatView; seat: number }) {
  const { t } = useI18n();
  const names = useContext(SeatNames);
  const pos = positionOf(seat, view.options, view.seat);
  const info = view.seats[seat];
  const name = names?.[seat] ?? t(SEAT_NAME[pos]);
  let note = `${info.cardCount} ${t('table.cards')}`;
  if (info.passed) note = t('status.passed');
  else if (info.isTurn) note = t('status.thinking');
  const side = pos !== 'top';
  return (
    <section className={`opponent opponent--${pos}`} aria-label={t(SEAT_NAME[pos])}>
      <div
        className={`flex min-w-0 items-center gap-2 rounded-2xl bg-base-300 p-2 ${side ? 'w-16 flex-col text-center' : 'px-3.5'} ${info.isTurn ? 'ring-2 ring-primary' : ''}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-content" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold">
            {name}
            {info.isDealer && <sup className="ml-0.5 text-[10px] opacity-70" title={t('trump.dealer')}>D</sup>}
          </span>
          <span className="truncate text-xs text-base-content/70">{note}</span>
          {info.bela && <span className="badge badge-xs badge-error mt-0.5 self-center">{t('decl.bela')}</span>}
        </span>
      </div>
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
        <span className="badge badge-xs badge-soft" title={t('trump.dealer')}>
          D
        </span>
      )}
      {info.bela && <span className="badge badge-sm badge-error">{t('decl.bela')}</span>}
    </div>
  );
}

function TrumpPicker({ view, legal, onAct }: { view: SeatView; legal: BelaAction[]; onAct: Act }) {
  const { t } = useI18n();
  const names = useContext(SeatNames);
  const count = (suit: Suit) => view.hand.filter((c) => c.suit === suit).length;
  // The call is the only thing to do now: start keyboard users on it.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => panel.current?.querySelector<HTMLButtonElement>('.trump-btn:not(:disabled)')?.focus(), []);
  // Others first as they sit around the table, then us; the call goes to whoever is up.
  const order = [view.seat, ...view.seats.map((x) => x.seat).filter((x) => x !== view.seat)];
  const status = (seat: number) => {
    const info = view.seats[seat];
    if (info.passed) return { text: t('status.passed'), mine: false };
    if (info.isTurn) return seat === view.seat ? { text: t('trump.yourCall'), mine: true } : { text: t('status.thinking'), mine: false };
    if (info.isDealer) return { text: t('trump.cannotPass'), mine: false };
    return { text: '', mine: false };
  };
  return (
    <div
      ref={panel}
      className="trump-panel card bg-base-300 shadow-xl absolute inset-x-3 top-3 z-10 mx-auto max-w-md"
      role="dialog"
      aria-label={t('trump.title')}
    >
      <div className="card-body gap-3 p-4">
        <h2 className="card-title font-display text-2xl font-extrabold">{t('trump.title')}</h2>
        <p className="text-sm text-base-content/75">{t('trump.helper')}</p>
        {view.mustCall && <div className="alert alert-warning alert-soft py-2">{t('trump.forced')}</div>}
        <ul className="flex flex-col gap-1.5">
          {order.map((seat) => {
            const st = status(seat);
            const name = seat === view.seat ? t('seat.you') : (names?.[seat] ?? t(SEAT_NAME[positionOf(seat, view.options, view.seat)]));
            return (
              <li
                key={seat}
                className={`flex justify-between rounded-xl px-3 py-2 text-sm ${st.mine ? 'border border-primary bg-base-200' : 'bg-base-100'}`}
              >
                <span className="font-bold">
                  {name}
                  {view.seats[seat].isDealer && <span className="font-normal opacity-70"> ({t('trump.dealer')})</span>}
                </span>
                <span className={st.mine ? 'font-bold text-primary' : 'opacity-70'}>{st.text}</span>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-4 gap-2">
          {SUITS.map((suit) => {
            const n = count(suit);
            return (
              <button
                key={suit}
                type="button"
                className="trump-btn btn h-auto min-h-[88px] flex-col gap-1.5 rounded-2xl border-0 bg-[#fbfaf5] py-2 text-neutral hover:bg-white disabled:bg-[#fbfaf5] disabled:opacity-35"
                disabled={!legal.some((a) => a.type === 'call' && a.suit === suit)}
                onClick={() => onAct({ type: 'call', suit })}
              >
                <span className={`suit suit--${suit} text-3xl leading-none`}><SuitMark suit={suit} /></span>
                <span className="text-xs font-medium">
                  {n} {t(n === 1 ? 'trump.count1' : 'trump.countN')}
                </span>
                <span className="sr-only">{t(`suit.${suit}` as StringKey)}</span>
              </button>
            );
          })}
        </div>
        {legal.some((a) => a.type === 'pass') && (
          <button type="button" className="btn btn-outline h-12 rounded-2xl border-accent" onClick={() => onAct({ type: 'pass' })}>
            {t('trump.pass')}
          </button>
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
  if (!decl) return null;
  return (
    <div className="absolute left-2 top-2 z-[5] flex flex-col items-start gap-1.5">
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
      <span className={`suit suit--${call.suit} text-3xl leading-none`}><SuitMark suit={call.suit} /></span>
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
