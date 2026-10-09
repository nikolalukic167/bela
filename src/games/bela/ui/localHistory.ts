// Browser-side persistence of local match history (kept out of the pure history module).
import { loadJson, saveJson } from '../../../ui/storage';
import { mergeHistory, type HistoryEntry } from '../history';

const KEY = 'bela:history';
const MAX_LOCAL = 200;

export const loadLocalHistory = (): HistoryEntry[] => loadJson<HistoryEntry[]>(KEY) ?? [];

export function saveLocalGame(e: HistoryEntry): void {
  saveJson(KEY, mergeHistory([e], loadLocalHistory()).slice(0, MAX_LOCAL));
}
