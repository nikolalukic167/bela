import { Navigate, useParams } from 'react-router-dom';
import { BelaTable } from '../games/bela/ui/BelaTable';

/** Maps a game id from the URL to its table component. */
export function Play() {
  const { gameId } = useParams();
  switch (gameId) {
    case 'bela':
      return <BelaTable />;
    default:
      return <Navigate to="/" replace />;
  }
}
