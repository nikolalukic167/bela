// Personal Bela statistics (architecture §2, Phase 3), computed from finished games only;
// the engine knows nothing about them (§5).
import type { HandResult } from './state';

/** What stats need from one scored hand. `score` is what each team wrote down. */
export interface HandLine {
  callerSeat: number;
  fell: boolean;
  score: [number, number];
}

/** Hands from games saved before callers were recorded are skipped. */
export const handLines = (history: HandResult[]): HandLine[] =>
  history.flatMap((h) => (h.callerSeat === undefined ? [] : [{ callerSeat: h.callerSeat, fell: h.fell, score: [h.score[0], h.score[1]] as [number, number] }]));

/** One seat's hands: how many, how often it called trump, how often its call fell (pad). */
export interface SeatHands {
  hands: number;
  calls: number;
  falls: number;
  /** Points written for the seat's team over these hands. */
  points: number;
}

export function seatHands(lines: HandLine[], seat: number): SeatHands {
  const mine = lines.filter((l) => l.callerSeat === seat);
  return {
    hands: lines.length,
    calls: mine.length,
    falls: mine.filter((l) => l.fell).length,
    points: lines.reduce((sum, l) => sum + l.score[seat % 2], 0),
  };
}

export interface StatsGame {
  won: boolean;
  /** The player's team's final match score. */
  points: number;
  /** Missing for games recorded before hand details were kept. */
  hands?: SeatHands;
}

export interface Stats {
  games: number;
  wins: number;
  /** Percentages are rounded, null without data. */
  winRate: number | null;
  avgPoints: number | null;
  hands: number;
  calls: number;
  /** Share of hands in which the player called trump. */
  callRate: number | null;
  falls: number;
  /** Share of the player's own calls that fell. */
  fallRate: number | null;
  avgHandPoints: number | null;
  /** Games that contributed hand stats. */
  gamesWithHands: number;
}

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : null);
const avg = (sum: number, n: number) => (n ? Math.round(sum / n) : null);

export function summarizeStats(games: StatsGame[]): Stats {
  const withHands = games.flatMap((g) => (g.hands ? [g.hands] : []));
  const total = (k: keyof SeatHands) => withHands.reduce((s, h) => s + h[k], 0);
  const wins = games.filter((g) => g.won).length;
  const [hands, calls, falls] = [total('hands'), total('calls'), total('falls')];
  return {
    games: games.length,
    wins,
    winRate: pct(wins, games.length),
    avgPoints: avg(games.reduce((s, g) => s + g.points, 0), games.length),
    hands,
    calls,
    callRate: pct(calls, hands),
    falls,
    fallRate: pct(falls, calls),
    avgHandPoints: avg(total('points'), hands),
    gamesWithHands: withHands.length,
  };
}
