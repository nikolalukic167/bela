import { SUIT_SYMBOL } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import { Modal } from '../../../ui/Modal';
import type { SeatView } from '../view';

export function HandSummary({ view, onNext, onNewGame }: { view: SeatView; onNext: () => void; onNewGame: () => void }) {
  const { t } = useI18n();
  const r = view.history[view.history.length - 1];
  const over = view.phase === 'matchOver';
  const title = over ? t(view.winner === 0 ? 'match.won' : 'match.lost') : t('hand.title');
  const row = (label: string, v: [number, number]) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{v[0]}</td>
      <td>{v[1]}</td>
    </tr>
  );
  return (
    <Modal title={title}>
      <p className="summary-trump">
        {t('trump.label')}: <span className={`suit suit--${r.trump}`}>{SUIT_SYMBOL[r.trump]}</span> · {t('trump.calledBy')}{' '}
        {t(r.caller === 0 ? 'team.us' : 'team.them')}
      </p>
      <table className="summary">
        <thead>
          <tr>
            <th />
            <th scope="col">{t('team.us')}</th>
            <th scope="col">{t('team.them')}</th>
          </tr>
        </thead>
        <tbody>
          {row(t('hand.cards'), r.cardPoints)}
          {row(t('hand.decl'), r.declarations)}
          {row(t('hand.bela'), r.bela)}
          {row(t('hand.total'), r.score)}
        </tbody>
        <tfoot>{row('Σ', view.scores)}</tfoot>
      </table>
      {r.stiglja !== null && <p className="note">{t('hand.stiglja')}</p>}
      {r.fell && <p className="note note--bad">{t('hand.fell')}</p>}
      {r.hung && <p className="note">{t('hand.hung')}</p>}
      <div className="modal-actions">
        {over ? (
          <button type="button" className="btn" onClick={onNewGame}>
            {t('match.again')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onNext} autoFocus>
            {t('hand.next')}
          </button>
        )}
      </div>
    </Modal>
  );
}
