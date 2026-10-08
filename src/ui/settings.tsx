import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DECK_IDS, type DeckId } from './decks/ids';
import { loadJson, saveJson } from './storage';

export type Speed = 'slow' | 'normal' | 'fast';

/** Delays (ms) for bot moves and for collecting a finished trick. */
export const SPEED_DELAYS: Record<Speed, { bot: number; auto: number }> = {
  slow: { bot: 1100, auto: 1700 },
  normal: { bot: 650, auto: 1100 },
  fast: { bot: 300, auto: 600 },
};

interface Settings {
  speed: Speed;
  setSpeed: (s: Speed) => void;
  /** How this player's cards look. Purely local: other players at the table keep their own choice. */
  deck: DeckId;
  setDeck: (d: DeckId) => void;
}

const Ctx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [speed, setSpeed] = useState<Speed>(() => loadJson<Speed>('speed') ?? 'normal');
  const [deck, setDeck] = useState<DeckId>(() => {
    const saved = loadJson<DeckId>('deck');
    return saved && DECK_IDS.includes(saved) ? saved : 'french';
  });
  useEffect(() => saveJson('speed', speed), [speed]);
  useEffect(() => saveJson('deck', deck), [deck]);
  return <Ctx.Provider value={{ speed, setSpeed, deck, setDeck }}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

/** The viewer's deck; falls back to the French deck where no provider exists (tests, isolated renders). */
export function useDeck(): DeckId {
  return useContext(Ctx)?.deck ?? 'french';
}
