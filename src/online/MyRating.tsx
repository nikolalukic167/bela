import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useI18n } from '../i18n/i18n';

/** Rating card with a sparkline of its history; hidden until the first rated match. */
export function MyRating() {
  const { t } = useI18n();
  const r = useQuery(api.ratings.mine, {});
  if (!r) return null;
  const points = [0, ...r.history.map((h) => h.rating)];
  const lo = Math.min(...points);
  const span = Math.max(...points) - lo || 1;
  const path = points.map((p, i) => `${(i / Math.max(1, points.length - 1)) * 100},${30 - ((p - lo) / span) * 28 - 1}`).join(' ');
  return (
    <section className="card bg-base-200 mb-6" aria-label={t('rating.mine')}>
      <div className="card-body flex-row items-center gap-6 p-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest opacity-70">{t('rating.mine')}</div>
          <div className="text-4xl font-extrabold tabular-nums text-primary">{r.rating.toFixed(1)}</div>
          <div className="text-sm opacity-70">
            {r.games} {t('rating.games')}
            {r.provisional && <span className="badge badge-sm badge-ghost ml-2">{t('rating.provisional')}</span>}
          </div>
        </div>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-14 flex-1 text-primary" aria-hidden="true">
          <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </section>
  );
}
