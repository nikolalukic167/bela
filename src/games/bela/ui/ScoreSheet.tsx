import { useI18n } from '../../../i18n/i18n';
import type { SeatView } from '../view';

export function ScoreSheet({ view }: { view: SeatView }) {
  const { t } = useI18n();
  return (
    <section aria-label={t('score.sheet')}>
      <table className="table table-xs table-zebra text-center tabular-nums">
        <thead>
          <tr>
            <th className="text-center">{t('team.us')}</th>
            <th className="text-center">{t('team.them')}</th>
          </tr>
        </thead>
        <tbody>
          {view.history.map((r, i) => (
            <tr key={i} className={r.fell ? 'text-error' : undefined}>
              <td>{r.score[0]}</td>
              <td>{r.score[1]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-base font-bold">
            <td>{view.scores[0]}</td>
            <td>{view.scores[1]}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-right text-xs opacity-60 mt-1">→ {view.options.target}</p>
    </section>
  );
}
