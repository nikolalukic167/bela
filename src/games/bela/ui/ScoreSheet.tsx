import { useI18n } from '../../../i18n/i18n';
import type { BelaState } from '../state';

export function ScoreSheet({ state }: { state: BelaState }) {
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
          {state.history.map((r, i) => (
            <tr key={i} className={r.fell ? 'fell' : undefined}>
              <td>{r.score[0]}</td>
              <td>{r.score[1]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{state.scores[0]}</td>
            <td>{state.scores[1]}</td>
          </tr>
        </tfoot>
      </table>
      <p className="score-target">→ {state.options.target}</p>
    </aside>
  );
}
