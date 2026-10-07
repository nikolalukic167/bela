import type { MatchRecord, PlayerId } from '../../ratings/ratings';
import type { BelaState } from './state';

export interface MatchMeta {
  id: string;
  playedAt: number;
  rated: boolean;
  abandonedBy?: PlayerId;
}

/**
 * Turn a finished Bela match into a rating record. Seats 0+2 and 1+3 are
 * partners (team = seat % 2). Whole matches are rated, never single hands:
 * one hand depends too much on the deal.
 */
export function matchRecord(s: BelaState, seats: [PlayerId, PlayerId, PlayerId, PlayerId], meta: MatchMeta): MatchRecord {
  if (meta.abandonedBy === undefined && (s.phase !== 'matchOver' || s.winner === null)) {
    throw new Error('only a finished or abandoned match can be rated');
  }
  return {
    id: meta.id,
    playedAt: meta.playedAt,
    teams: [
      [seats[0], seats[2]],
      [seats[1], seats[3]],
    ],
    scores: [s.scores[0], s.scores[1]],
    winner: s.winner === 1 ? 1 : 0,
    rated: meta.rated,
    ...(meta.abandonedBy !== undefined && { abandonedBy: meta.abandonedBy }),
  };
}
