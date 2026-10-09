// Pure table orchestration: no Convex imports besides types, so it is unit-tested directly.
// The Convex entry points (tables.ts, admin.ts) only load/save around these functions.
import type { Id } from '../_generated/dataModel';
import { sameCard } from '../../src/core/cards';
import { createRng } from '../../src/core/rng';
import { belaGame } from '../../src/games/bela/game';
import type { BelaAction, BelaOptions, BelaState } from '../../src/games/bela/state';
import { viewFor, type SeatView } from '../../src/games/bela/view';
import { CODE_ALPHABET, CODE_LENGTH, NEXT_HAND_TIMEOUT_MS, STALE_TABLE_MS, TURN_TIMEOUT_MS } from './config';
import { TableError } from './errors';

export type ServerBotLevel = 'easy' | 'medium' | 'hard';
/** 'expert' (PIMC, ~700 ms per move) exceeds Convex's mutation time limit, so it is offline-only. */
export const SERVER_BOT_LEVELS: ServerBotLevel[] = ['easy', 'medium', 'hard'];

export type Seat =
  | { kind: 'empty' }
  | { kind: 'user'; userId: Id<'users'>; name: string }
  | { kind: 'bot'; name: string; level: ServerBotLevel; userId?: Id<'users'>; standInFor?: Id<'users'> };

export const SEATS = 4;

export const BOT_NAMES = ['Ana', 'Marko', 'Ivana', 'Luka', 'Petra', 'Josip', 'Mia', 'Ivan'];

export function makeCode(randomInt: (max: number) => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function seatOf(seats: Seat[], userId: Id<'users'>): number {
  return seats.findIndex((s) => s.kind === 'user' && s.userId === userId);
}

/** The player's seat, also while a bot stands in for them (see `standIn`). */
export function ownSeat(seats: Seat[], userId: Id<'users'>): number {
  const seat = seatOf(seats, userId);
  return seat >= 0 ? seat : seats.findIndex((s) => s.kind === 'bot' && s.standInFor === userId);
}

export const firstEmpty = (seats: Seat[]) => seats.findIndex((s) => s.kind === 'empty');
export const humanCount = (seats: Seat[]) => seats.filter((s) => s.kind === 'user').length;

export function emptySeats(count = SEATS): Seat[] {
  return Array.from({ length: count }, () => ({ kind: 'empty' as const }));
}

/** A bot with a name not yet used at the table. */
export function botSeat(seats: Seat[], level: ServerBotLevel): Seat {
  const taken = new Set(seats.flatMap((s) => (s.kind === 'empty' ? [] : [s.name])));
  return { kind: 'bot', name: BOT_NAMES.find((n) => !taken.has(n)) ?? 'Bot', level };
}

/** Bots take every empty seat. */
export function fillWithBots(seats: Seat[], level: ServerBotLevel): Seat[] {
  const out = [...seats];
  for (const [i, s] of out.entries()) if (s.kind === 'empty') out[i] = botSeat(out, level);
  return out;
}

/**
 * Reconnect (architecture §7): a seat is kept while its player's last heartbeat is
 * within `grace`. After that a bot stands in until they come back.
 */
export function presenceCheck(lastSeen: number, now: number, grace: number): { expired: true } | { expired: false; recheckAt: number } {
  return now - lastSeen >= grace ? { expired: true } : { expired: false, recheckAt: lastSeen + grace };
}

/** A bot plays an away player's seat under their name, and remembers whose seat it is. */
export function standIn(seats: Seat[], seat: number, level: ServerBotLevel): Seat[] {
  const s = seats[seat];
  if (s?.kind !== 'user') return seats;
  const out = [...seats];
  out[seat] = { kind: 'bot', name: s.name, level, standInFor: s.userId };
  return out;
}

/** The returning player takes their seat back from the stand-in bot, or null if there is none. */
export function reclaimSeat(seats: Seat[], userId: Id<'users'>): { seats: Seat[]; seat: number } | null {
  const seat = seats.findIndex((s) => s.kind === 'bot' && s.standInFor === userId);
  if (seat < 0) return null;
  const out = [...seats];
  out[seat] = { kind: 'user', userId, name: (seats[seat] as { name: string }).name };
  return { seats: out, seat };
}

const hasStandIn = (seats: Seat[]) => seats.some((s) => s.kind === 'bot' && s.standInFor !== undefined);

export function startState(options: BelaOptions, seed: number): BelaState {
  return belaGame.setup(options, seed);
}

/** Who must move next, or what the server does by itself. */
export type Mover =
  | { kind: 'none' } // waiting for a human, or the game is over
  | { kind: 'auto'; action: BelaAction } // collect a trick / deal the next hand at a bot-only table
  | { kind: 'bot'; seat: number };

export function moverOf(state: BelaState, seats: Seat[]): Mover {
  if (belaGame.isOver(state)) return { kind: 'none' };
  // Every human is away: wait for one to come back rather than play a match nobody watches.
  if (humanCount(seats) === 0 && hasStandIn(seats)) return { kind: 'none' };
  const auto = belaGame.autoAction(state);
  if (auto) return { kind: 'auto', action: auto };
  if (state.phase === 'handOver') {
    // Any seated human presses "next"; with no humans the server deals on its own.
    return humanCount(seats) === 0 ? { kind: 'auto', action: { type: 'next' } } : { kind: 'none' };
  }
  const turn = belaGame.currentPlayer(state);
  if (turn === null) return { kind: 'none' };
  return seats[turn]?.kind === 'bot' ? { kind: 'bot', seat: turn } : { kind: 'none' };
}

/**
 * The turn timer while the table waits on its humans: the seat to move (null: anyone may
 * press "next") and how long they have. Null when the server moves by itself or the match is over.
 */
export function timeoutFor(state: BelaState, seats: Seat[]): { seat: number | null; ms: number } | null {
  if (moverOf(state, seats).kind !== 'none' || belaGame.isOver(state)) return null;
  if (state.phase === 'handOver') return humanCount(seats) > 0 ? { seat: null, ms: NEXT_HAND_TIMEOUT_MS } : null;
  const turn = belaGame.currentPlayer(state);
  return turn !== null && seats[turn]?.kind === 'user' ? { seat: turn, ms: TURN_TIMEOUT_MS } : null;
}

/** What the server plays when the timer runs out: the next deal, or a medium bot's move for the seat. */
export function timeoutMove(state: BelaState, seats: Seat[], version: number): Move | null {
  const t = timeoutFor(state, seats);
  if (!t) return null;
  if (t.seat === null) return { seat: belaGame.currentPlayer(state) ?? 0, action: { type: 'next' } };
  return { seat: t.seat, action: botAction(state, t.seat, 'medium', state.seed ^ Math.imul(version + 1, 2654435761)) };
}

function sameAction(a: BelaAction, b: BelaAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'call' && b.type === 'call') return a.suit === b.suit;
  if (a.type === 'play' && b.type === 'play') return sameCard(a.card, b.card);
  return true;
}

/** Applies a human's action after checking seat, turn and legality. Throws TableError. */
export function applyHumanAction(state: BelaState, seat: number, action: BelaAction): BelaState {
  if (belaGame.isOver(state)) throw new TableError('WRONG_STATE');
  if (action.type === 'collect') throw new TableError('ILLEGAL_ACTION'); // system action only
  if (state.phase === 'handOver') {
    if (action.type !== 'next') throw new TableError('ILLEGAL_ACTION');
    return belaGame.apply(state, action);
  }
  if (belaGame.currentPlayer(state) !== seat) throw new TableError('NOT_YOUR_TURN');
  if (!belaGame.legalActions(state, seat).some((l) => sameAction(l, action))) throw new TableError('ILLEGAL_ACTION');
  return belaGame.apply(state, action);
}

/** The bot's move, decided from its seat's view only. */
export function botAction(state: BelaState, seat: number, level: ServerBotLevel, rngSeed: number): BelaAction {
  const view = viewFor(state, seat);
  const leveled: SeatView = { ...view, options: { ...view.options, botLevel: level } };
  return belaGame.bot(leveled, createRng(rngSeed));
}

export interface Move {
  seat: number;
  action: BelaAction;
}

/**
 * Plays up to `max` server-driven moves (bots, trick collection, bot-only dealing).
 * `version` makes bot randomness differ per move but stay reproducible.
 */
export function advance(state: BelaState, seats: Seat[], version: number, max: number): { state: BelaState; moves: Move[] } {
  const moves: Move[] = [];
  let s = state;
  while (moves.length < max) {
    const m = moverOf(s, seats);
    if (m.kind === 'none') break;
    let seat: number;
    let action: BelaAction;
    if (m.kind === 'auto') {
      seat = belaGame.currentPlayer(s) ?? 0;
      action = m.action;
    } else {
      const bot = seats[m.seat];
      action = botAction(s, m.seat, bot.kind === 'bot' ? bot.level : 'medium', s.seed ^ Math.imul(version + moves.length + 1, 2654435761));
      seat = m.seat;
    }
    s = belaGame.apply(s, action);
    moves.push({ seat, action });
  }
  return { state: s, moves };
}

export function isFinished(state: BelaState): boolean {
  return belaGame.isOver(state);
}

/**
 * Rebuilds a game from its seed, options and action log (architecture §5), checking every
 * move is legal where it was made. Used to verify stored games and for replays.
 */
export function replay(options: BelaOptions, seed: number, actions: BelaAction[]): BelaState {
  let s = startState(options, seed);
  for (const a of actions) {
    const auto = belaGame.autoAction(s);
    const seat = belaGame.currentPlayer(s);
    const legal =
      (auto !== null && sameAction(auto, a)) ||
      (s.phase === 'handOver' && a.type === 'next') ||
      (seat !== null && belaGame.legalActions(s, seat).some((l) => sameAction(l, a)));
    if (!legal || belaGame.isOver(s)) throw new TableError('ILLEGAL_ACTION');
    s = belaGame.apply(s, a);
  }
  return s;
}

/**
 * Seating for a rematch: same seats, bots stay, away players are seated in person again.
 * `canSit(userId)` false (e.g. the player is at their table limit) leaves that seat empty.
 */
export function rematchSeats(seats: Seat[], canSit: (userId: Id<'users'>) => boolean = () => true): Seat[] {
  return seats.map((s) => {
    const userId = s.kind === 'user' ? s.userId : s.kind === 'bot' ? s.standInFor : undefined;
    if (userId === undefined) return s;
    return canSit(userId) ? { kind: 'user', userId, name: (s as { name: string }).name } : { kind: 'empty' };
  });
}

/**
 * Tables the daily cleanup deletes: lobbies nobody started, and running tables whose humans
 * have all been away for STALE_TABLE_MS. Finished tables are game history and stay.
 */
export function isAbandoned(
  t: { status: 'lobby' | 'playing' | 'finished'; seats: Seat[]; createdAt: number; lastMoveAt: number | null },
  now: number,
): boolean {
  if (t.status === 'lobby') return now - t.createdAt >= STALE_TABLE_MS;
  if (t.status !== 'playing' || humanCount(t.seats) > 0 || !hasStandIn(t.seats)) return false;
  return now - (t.lastMoveAt ?? t.createdAt) >= STALE_TABLE_MS;
}
