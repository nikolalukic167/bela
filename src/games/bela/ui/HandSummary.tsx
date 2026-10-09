import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuitMark } from '../../../ui/decks';
import { fmt, useI18n } from '../../../i18n/i18n';
import { HomeIcon } from '../../../ui/icons';
import { Modal, ModalActions } from '../../../ui/Modal';
import type { SeatView } from '../view';

interface Props {
  view: SeatView;
  onNext: () => void;
  onNewGame: () => void;
  /** Extra explanation above the numbers (tutorial). */
  note?: ReactNode;
  nextLabel?: string;
}

export function HandSummary({ view, onNext, onNewGame, note, nextLabel }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const r = view.history[view.history.length - 1];
  const over = view.phase === 'matchOver';
  const title = over ? t(view.winner === 0 ? 'match.won' : 'match.lost') : t('hand.title');
  const row = (label: string, v: [number, number]) => (
    <tr>
      <th scope="row">{label}</th>
      <td className="text-right">{v[0]}</td>
      <td className="text-right">{v[1]}</td>
    </tr>
  );
  return (
    <Modal title={title}>
      {note}
      <p className="mb-2">
        {t('trump.label')}: <span className={`suit suit--${r.trump} text-xl`}><SuitMark suit={r.trump} /></span> ·{' '}
        {fmt(t('trump.calledBy'), { name: t(r.caller === 0 ? 'team.us' : 'team.them') })}
      </p>
      <table className="table table-sm tabular-nums">
        <thead>
          <tr>
            <th />
            <th className="text-right">{t('team.us')}</th>
            <th className="text-right">{t('team.them')}</th>
          </tr>
        </thead>
        <tbody>
          {row(t('hand.cards'), r.cardPoints)}
          {row(t('hand.decl'), r.declarations)}
          {row(t('hand.bela'), r.bela)}
          {row(t('hand.total'), r.score)}
        </tbody>
        <tfoot className="text-base">{row('Σ', view.scores)}</tfoot>
      </table>
      <div className="flex flex-col gap-2 mt-3">
        {r.stiglja !== null && <div className="alert alert-success alert-soft">{t('hand.stiglja')}</div>}
        {r.fell && <div className="alert alert-error alert-soft">{t('hand.fell')}</div>}
        {r.hung && <div className="alert alert-info alert-soft">{t('hand.hung')}</div>}
      </div>
      <ModalActions>
        {over ? (
          <>
            <button type="button" className="btn" onClick={() => navigate('/')}>
              <HomeIcon />
              {t('match.menu')}
            </button>
            <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
              {t('match.again')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
            {nextLabel ?? t('hand.next')}
          </button>
        )}
      </ModalActions>
    </Modal>
  );
}
