import { Link, Navigate, useParams } from 'react-router-dom';
import { BelaRules } from '../games/bela/ui/BelaRules';
import { useI18n } from '../i18n/i18n';
import { AppShell } from '../ui/AppShell';

export function Rules() {
  const { gameId } = useParams();
  const { t } = useI18n();
  if (gameId !== 'bela') return <Navigate to="/" replace />;
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <BelaRules />
            <div className="card-actions justify-end">
              <Link className="btn btn-primary" to="/play/bela">
                {t('home.play')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
