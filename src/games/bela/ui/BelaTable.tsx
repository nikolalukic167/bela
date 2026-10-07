import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUIT_SYMBOL, SUITS, cardId, sameCard, type Card as CardT } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import type { StringKey } from '../../../i18n/strings';
import { Card } from '../../../ui/Card';
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
  const { t, lang, setLang } = useI18n();
  const { view, act, newGame, quit } = useGame(belaGame, {
    humanSeat: HUMAN_SEAT,
    botDelay: 650,
    autoDelay: 1100,
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

  if (!view) {
    return (
      <div className="table-page">
        <NewGameDialog initial={lastOptions} onStart={start} />
      </div>
    );
  }

  return (
    <div className="table-page">
      <header className="table-bar">
        <Link to="/" className="bar-btn" aria-label={t('nav.home')}>
          ⌂
        </Link>
        <ScoreBar view={view} />
        <TrumpBadge view={view} />
        <div className="bar-actions">
          <button type="button" className="bar-btn sheet-toggle" onClick={() => setShowSheet((v) => !v)} aria-label={t('score.sheet')}>
            ☰
          </button>
          <button type="button" className="bar-btn lang-toggle" onClick={() => setLang(lang === 'hr' ? 'en' : 'hr')}>
            {lang === 'hr' ? 'EN' : 'HR'}
          </button>
          <Link to="/rules/bela" className="bar-btn" aria-label={t('nav.rules')}>
            ?
          </Link>
          <button type="button" className="bar-btn" onClick={() => setShowSettings(true)} aria-label={t('nav.newGame')}>
            ＋
          </button>
        </div>
      </header>

      <div className="table-layout">
        <Table view={view} onAct={act} />
        <div className={`sheet-wrap ${showSheet ? 'sheet-wrap--open' : ''}`}>
          <ScoreSheet view={view} />
        </div>
      </div>

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
    </div>
  );
}

function ScoreBar({ view }: { view: SeatView }) {
  const { t } = useI18n();
  return (
    <div className="score-bar" aria-live="polite">
      <span className="score-team">
        {t('team.us')} <strong>{view.scores[0]}</strong>
      </span>
      <span className="score-sep">:</span>
      <span className="score-team">
        <strong>{view.scores[1]}</strong> {t('team.them')}
      </span>
    </div>
  );
}

function TrumpBadge({ view }: { view: SeatView }) {
  const { t } = useI18n();
  if (!view.trump || view.callerSeat === null) return <div className="trump-badge trump-badge--empty" />;
  return (
    <div className="trump-badge" title={t('trump.label')}>
      <span className={`suit suit--${view.trump}`}>{SUIT_SYMBOL[view.trump]}</span>
      <span className="trump-caller">{t(SEAT_NAME[positionOf(view.callerSeat, view.options)])}</span>
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
        {view.shownDeclarations && <Declarations view={view} />}
      </div>

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
        {playing && view.isMyTurn && <p className="status">{t('status.yourTurn')}</p>}
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
      <span className="opp-count">{count}</span>
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
    <div className={`seat-tag ${info.isTurn ? 'seat-tag--active' : ''} ${info.isDealer ? 'seat-tag--dealer' : ''}`}>
      <span className="seat-name">{t(SEAT_NAME[positionOf(seat, view.options)])}</span>
      {info.isDealer && <span className="dealer-chip" title="dealer">D</span>}
      {note && <span className="seat-note">{note}</span>}
      {info.bela && <span className="bela-chip">{t('decl.bela')}</span>}
    </div>
  );
}

function TrumpPicker({ view, onAct }: { view: SeatView; onAct: Act }) {
  const { t } = useI18n();
  return (
    <div className="trump-panel" role="dialog" aria-label={t('trump.title')}>
      <h2>{t('trump.title')}</h2>
      {view.mustCall && <p className="note">{t('trump.forced')}</p>}
      <div className="trump-grid">
        {SUITS.map((suit) => (
          <button key={suit} type="button" className="trump-btn" onClick={() => onAct({ type: 'call', suit })}>
            <span className={`suit suit--${suit}`}>{SUIT_SYMBOL[suit]}</span>
            <span>{t(`suit.${suit}` as StringKey)}</span>
          </button>
        ))}
      </div>
      {!view.mustCall && (
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={() => onAct({ type: 'pass' })}>
            {t('trump.pass')}
          </button>
        </div>
      )}
    </div>
  );
}

function Declarations({ view }: { view: SeatView }) {
  const { t } = useI18n();
  const { team, declarations } = view.shownDeclarations!;
  return (
    <div className="decl-banner" role="status">
      <strong>
        {t('decl.title')} – {t(team === 0 ? 'team.us' : 'team.them')}
      </strong>
      {declarations.map((d, i) => (
        <div key={i} className="decl-row">
          <span className="decl-seat">{t(SEAT_NAME[positionOf(d.seat, view.options)])}</span>
          <span className="decl-cards">
            {d.cards.map((c) => (
              <Card key={cardId(c)} card={c} className="mini-card" />
            ))}
          </span>
          <span className="decl-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
