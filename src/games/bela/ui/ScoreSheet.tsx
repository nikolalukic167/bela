import { useI18n } from '../../../i18n/i18n';
import type { SeatView } from '../view';

export function ScoreSheet({ view }: { view: SeatView }) {
  const { t } = useI18n();
  return (
    <aside className="score-sheet" aria-label={t('score.sheet')}>
      <h3>{t('score.sheet')}</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('team.us')}</th>
            <th scope="col">{t('team.them')}</th>
          </tr>
        </thead>
        <tbody>
          {view.history.map((r, i) => (
            <tr key={i} className={r.fell ? 'fell' : undefined}>
              <td>{r.score[0]}</td>
              <td>{r.score[1]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{view.scores[0]}</td>
            <td>{view.scores[1]}</td>
          </tr>
        </tfoot>
      </table>
      <p className="score-target">→ {view.options.target}</p>
    </aside>
  );
}
