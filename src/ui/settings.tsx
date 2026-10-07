import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
}

const Ctx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [speed, setSpeed] = useState<Speed>(() => loadJson<Speed>('speed') ?? 'normal');
  useEffect(() => saveJson('speed', speed), [speed]);
  return <Ctx.Provider value={{ speed, setSpeed }}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}
