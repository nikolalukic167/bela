import { Link, Navigate, useParams } from 'react-router-dom';
import { BelaRules } from '../games/bela/ui/BelaRules';
import { useI18n } from '../i18n/i18n';

export function Rules() {
  const { gameId } = useParams();
  const { t } = useI18n();
  if (gameId !== 'bela') return <Navigate to="/" replace />;
  return (
    <div className="rules-page">
      <nav className="rules-nav">
        <Link to="/">← {t('nav.home')}</Link>
        <Link className="btn" to="/play/bela">
          {t('home.play')}
        </Link>
      </nav>
      <BelaRules />
    </div>
  );
}
