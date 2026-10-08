import { loadJson, saveJson } from '../../ui/storage';

/** One finished match, as shown in the player's history. Scores are [our team, their team]. */
export interface HistoryEntry {
  id: string;
  playedAt: number;
  source: 'local' | 'online';
  target: number;
  scores: [number, number];
  won: boolean;
  /** Everyone else at the table: partner first, then the opponents. */
  players: string[];
}

export function summarize(entries: HistoryEntry[]): { played: number; won: number; rate: number | null } {
  const won = entries.filter((e) => e.won).length;
  return { played: entries.length, won, rate: entries.length ? Math.round((won / entries.length) * 100) : null };
}

/** Newest first; the first occurrence of an id wins. */
export function mergeHistory(...lists: HistoryEntry[][]): HistoryEntry[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => b.playedAt - a.playedAt);
}

interface FinishedLocalMatch {
  handNo: number;
  scores: [number, number];
  winner: number | null;
  options: { target: number };
}

/** The id is derived from the result, so reloading the finished screen records nothing new. */
export function recordLocal(m: FinishedLocalMatch, now: number): HistoryEntry {
  return {
    id: `local:${m.options.target}:${m.handNo}:${m.scores[0]}-${m.scores[1]}`,
    playedAt: now,
    source: 'local',
    target: m.options.target,
    scores: [m.scores[0], m.scores[1]],
    won: m.winner === 0,
    players: [],
  };
}

const KEY = 'bela:history';
const MAX_LOCAL = 200;

export const loadLocalHistory = (): HistoryEntry[] => loadJson<HistoryEntry[]>(KEY) ?? [];

export function saveLocalGame(e: HistoryEntry): void {
  saveJson(KEY, mergeHistory([e], loadLocalHistory()).slice(0, MAX_LOCAL));
}
