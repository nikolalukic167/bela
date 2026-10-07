import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUIT_SYMBOL, SUITS, cardId, sameCard, type Card as CardT } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import type { StringKey } from '../../../i18n/strings';
import { Card } from '../../../ui/Card';
import { useGame } from '../../../ui/useGame';
import { belaGame, HUMAN_SEAT } from '../engine';
import { winningIndex } from '../legal';
import type { BelaOptions, BelaState } from '../state';
import { HandSummary } from './HandSummary';
import { NewGameDialog } from './NewGameDialog';
import { positionOf, type Position } from './positions';
import { ScoreSheet } from './ScoreSheet';
import { sortHand } from './sort';

const SEAT_NAME: Record<Position, StringKey> = {
  bottom: 'seat.you',
  top: 'seat.partner',
  left: 'seat.left',
  right: 'seat.right',
};

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function BelaTable() {
  const { t, lang, setLang } = useI18n();
  const { state, act, newGame, quit } = useGame(belaGame, {
    humanSeat: HUMAN_SEAT,
    botDelay: 650,
    autoDelay: 1100,
    storageKey: 'bela:v1',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [lastOptions, setLastOptions] = useState<BelaOptions>(belaGame.defaultOptions);

  const start = (o: BelaOptions) => {
    setLastOptions(o);
    setShowSettings(false);
    newGame(o);
  };

  if (!state) {
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
        <ScoreBar state={state} />
        <TrumpBadge state={state} />
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
        <Table state={state} onAct={act} />
        <div className={`sheet-wrap ${showSheet ? 'sheet-wrap--open' : ''}`}>
          <ScoreSheet state={state} />
        </div>
      </div>

      {(state.phase === 'handOver' || state.phase === 'matchOver') && (
        <HandSummary state={state} onNext={() => act({ type: 'next' })} onNewGame={() => setShowSettings(true)} />
      )}
      {showSettings && (
        <NewGameDialog
          initial={state.options}
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

function ScoreBar({ state }: { state: BelaState }) {
  const { t } = useI18n();
  return (
    <div className="score-bar" aria-live="polite">
      <span className="score-team">
        {t('team.us')} <strong>{state.scores[0]}</strong>
      </span>
      <span className="score-sep">:</span>
      <span className="score-team">
        <strong>{state.scores[1]}</strong> {t('team.them')}
      </span>
    </div>
  );
}

function TrumpBadge({ state }: { state: BelaState }) {
  const { t } = useI18n();
  if (!state.trump || state.callerSeat === null) return <div className="trump-badge trump-badge--empty" />;
  return (
    <div className="trump-badge" title={t('trump.label')}>
      <span className={`suit suit--${state.trump}`}>{SUIT_SYMBOL[state.trump]}</span>
      <span className="trump-caller">{t(SEAT_NAME[positionOf(state.callerSeat, state.options)])}</span>
    </div>
  );
}

function Table({ state, onAct }: { state: BelaState; onAct: (a: Parameters<typeof belaGame.apply>[1]) => void }) {
  const { t } = useI18n();
  const myTurn = belaGame.currentPlayer(state) === HUMAN_SEAT;
  const legal = useMemo(
    () => (state.phase === 'play' && myTurn ? belaGame.legalActions(state, HUMAN_SEAT) : []),
    [state, myTurn],
  );
  const legalCards = legal.flatMap((a) => (a.type === 'play' ? [a.card] : []));
  const [selected, setSelected] = useState<CardT | null>(null);
  useEffect(() => setSelected(null), [state.turn, state.phase]);

  const hand = sortHand(state.hands[HUMAN_SEAT], state.trump);
  const play = (c: CardT) => {
    if (!legalCards.some((l) => sameCard(l, c))) return;
    if (canHover() || (selected && sameCard(selected, c))) onAct({ type: 'play', card: c });
    else setSelected(c);
  };

  const showDecl = state.declarationsShown && state.declarationTeam !== null && state.tricksTaken[0] + state.tricksTaken[1] === 1;

  return (
    <main className="felt">
      {[1, 2, 3].map((seat) => (
        <Opponent key={seat} state={state} seat={seat} />
      ))}

      <div className="trick" aria-label="trick">
        {state.trick.map((p, i) => {
          const winning = state.phase === 'collect' && i === winningIndex(state.trick, state.trump!);
          return (
            <Card
              key={cardId(p.card)}
              card={p.card}
              className={`trick-card trick-card--${positionOf(p.seat, state.options)} ${winning ? 'trick-card--win' : ''}`}
            />
          );
        })}
        {showDecl && <Declarations state={state} />}
      </div>

      <section className="me">
        <SeatBubble state={state} seat={HUMAN_SEAT} />
        <div className={`hand ${myTurn && state.phase === 'play' ? 'hand--active' : ''}`} style={{ ['--n' as string]: hand.length }}>
          {hand.map((c) => {
            const isLegal = legalCards.some((l) => sameCard(l, c));
            return (
              <Card
                key={cardId(c)}
                card={c}
                className="hand-card"
                label={`${c.rank} ${t(`suit.${c.suit}` as StringKey)}`}
                onClick={() => play(c)}
                disabled={state.phase === 'play' && myTurn ? !isLegal : state.phase === 'play'}
                selected={!!selected && sameCard(selected, c)}
              />
            );
          })}
          {state.talon[HUMAN_SEAT]?.map((_, i) => <Card key={`talon${i}`} faceDown className="hand-card hand-card--talon" />)}
        </div>
        {state.phase === 'play' && myTurn && <p className="status">{t('status.yourTurn')}</p>}
      </section>

      {state.phase === 'trump' && myTurn && <TrumpPicker state={state} onAct={onAct} />}
    </main>
  );
}

function Opponent({ state, seat }: { state: BelaState; seat: number }) {
  const { t } = useI18n();
  const pos = positionOf(seat, state.options);
  const count = state.hands[seat].length + (state.talon[seat]?.length ?? 0);
  return (
    <section className={`opponent opponent--${pos}`} aria-label={t(SEAT_NAME[pos])}>
      <div className="opp-cards" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} faceDown className="opp-card" />
        ))}
      </div>
      <span className="opp-count">{count}</span>
      <SeatBubble state={state} seat={seat} />
    </section>
  );
}

function SeatBubble({ state, seat }: { state: BelaState; seat: number }) {
  const { t } = useI18n();
  const pos = positionOf(seat, state.options);
  const active = belaGame.currentPlayer(state) === seat && (state.phase === 'trump' || state.phase === 'play');
  let note = '';
  if (state.phase === 'trump' && state.passed.includes(seat)) note = t('status.passed');
  else if (active && seat !== HUMAN_SEAT) note = t('status.thinking');
  const bela = state.belaSeats.includes(seat) && state.phase !== 'trump';
  return (
    <div className={`seat-tag ${active ? 'seat-tag--active' : ''} ${seat === state.dealer ? 'seat-tag--dealer' : ''}`}>
      <span className="seat-name">{t(SEAT_NAME[pos])}</span>
      {seat === state.dealer && <span className="dealer-chip" title="dealer">D</span>}
      {note && <span className="seat-note">{note}</span>}
      {bela && <span className="bela-chip">{t('decl.bela')}</span>}
    </div>
  );
}

function TrumpPicker({ state, onAct }: { state: BelaState; onAct: (a: Parameters<typeof belaGame.apply>[1]) => void }) {
  const { t } = useI18n();
  const forced = state.dealer === HUMAN_SEAT;
  return (
    <div className="trump-panel" role="dialog" aria-label={t('trump.title')}>
      <h2>{t('trump.title')}</h2>
      {forced && <p className="note">{t('trump.forced')}</p>}
      <div className="trump-grid">
        {SUITS.map((suit) => (
          <button key={suit} type="button" className="trump-btn" onClick={() => onAct({ type: 'call', suit })}>
            <span className={`suit suit--${suit}`}>{SUIT_SYMBOL[suit]}</span>
            <span>{t(`suit.${suit}` as StringKey)}</span>
          </button>
        ))}
      </div>
      {!forced && (
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={() => onAct({ type: 'pass' })}>
            {t('trump.pass')}
          </button>
        </div>
      )}
    </div>
  );
}

function Declarations({ state }: { state: BelaState }) {
  const { t } = useI18n();
  const team = state.declarationTeam as number;
  const decls = state.declarations.filter((d) => d.seat % 2 === team && d.kind !== 'belot');
  return (
    <div className="decl-banner" role="status">
      <strong>
        {t('decl.title')} – {t(team === 0 ? 'team.us' : 'team.them')}
      </strong>
      {decls.map((d, i) => (
        <div key={i} className="decl-row">
          <span className="decl-seat">{t(SEAT_NAME[positionOf(d.seat, state.options)])}</span>
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
