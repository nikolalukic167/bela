import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { optionsValidator } from './schema';
import { requireUser } from './lib/auth';
import {
  ACT_LIMIT,
  AUTO_DELAY_MS,
  BOT_DELAY_MS,
  FAST_BATCH,
  MAX_ACTIVE_TABLES_PER_USER,
  NEXT_HAND_DELAY_MS,
  RECONNECT_GRACE_MS,
  STALE_TABLE_MS,
} from './lib/config';
import { TableError } from './lib/errors';
import { consume } from './lib/rateLimit';
import {
  advance,
  applyHumanAction,
  botSeat,
  emptySeats,
  fillWithBots,
  firstEmpty,
  humanCount,
  isAbandoned,
  isFinished,
  makeCode,
  moverOf,
  ownSeat,
  presenceCheck,
  reclaimSeat,
  rematchSeats,
  seatOf,
  standIn,
  startState,
  timeoutFor,
  timeoutMove,
  type Seat,
  type ServerBotLevel,
} from './lib/tableLogic';
import type { BelaAction, BelaState } from '../src/games/bela/state';
import { viewFor } from '../src/games/bela/view';
import { recordGame } from './ratings';
import { ratedBlocker } from './lib/ratingLogic';
import { belaGame } from '../src/games/bela/game';

const actionValidator = v.union(
  v.object({ type: v.literal('pass') }),
  v.object({ type: v.literal('call'), suit: v.union(v.literal('hearts'), v.literal('diamonds'), v.literal('clubs'), v.literal('spades')) }),
  v.object({
    type: v.literal('play'),
    card: v.object({
      suit: v.union(v.literal('hearts'), v.literal('diamonds'), v.literal('clubs'), v.literal('spades')),
      rank: v.string(),
    }),
  }),
  v.object({ type: v.literal('next') }),
);

const randomInt = (max: number) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};

// ---------- helpers shared with admin.ts ----------

export async function tableByCode(ctx: QueryCtx, code: string): Promise<Doc<'tables'> | null> {
  return ctx.db.query('tables').withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase())).unique();
}

/** Test tables exist only for admins; everyone else gets NOT_FOUND, as if they were not there. */
export function visibleTo(table: Doc<'tables'>, user: Doc<'users'>): boolean {
  return !table.isTest || user.isAdmin === true;
}

export async function loadState(ctx: QueryCtx, tableId: Id<'tables'>): Promise<Doc<'tableStates'>> {
  const row = await ctx.db.query('tableStates').withIndex('by_table', (q) => q.eq('tableId', tableId)).unique();
  if (!row) throw new TableError('WRONG_STATE');
  return row;
}

export async function uniqueCode(ctx: QueryCtx): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = makeCode(randomInt);
    if (!(await tableByCode(ctx, code))) return code;
  }
  throw new TableError('RATE_LIMITED');
}

const botLevelOf = (t: Doc<'tables'>): ServerBotLevel => (t.options.botLevel ?? 'medium') as ServerBotLevel;

/** Schedules the server's next step (bot move, trick collection) if there is one. */
export async function scheduleNext(ctx: MutationCtx, table: Doc<'tables'>, row: Doc<'tableStates'>) {
  const m = moverOf(row.state as BelaState, table.seats as Seat[]);
  if (m.kind === 'none') {
    // Waiting on the humans: start the turn timer (a later move makes it a no-op).
    const timer = timeoutFor(row.state as BelaState, table.seats as Seat[]);
    await ctx.db.patch(row._id, { deadline: timer ? Date.now() + timer.ms : undefined });
    if (timer) await ctx.scheduler.runAfter(timer.ms, internal.tables.timeout, { tableId: table._id, version: row.version });
    return;
  }
  const delay =
    table.speed === 'fast'
      ? 0
      : m.kind === 'bot'
        ? BOT_DELAY_MS
        : (row.state as BelaState).phase === 'handOver'
          ? NEXT_HAND_DELAY_MS
          : AUTO_DELAY_MS;
  await ctx.scheduler.runAfter(delay, internal.tables.step, { tableId: table._id, version: row.version });
}

/** Persists a new state, appends the moves to the log and settles the table if the match ended. */
export async function commit(
  ctx: MutationCtx,
  table: Doc<'tables'>,
  row: Doc<'tableStates'>,
  state: BelaState,
  moves: { seat: number; action: BelaAction }[],
) {
  const version = row.version + moves.length;
  for (const [i, m] of moves.entries()) {
    await ctx.db.insert('actions', { tableId: table._id, seq: row.version + i, seat: m.seat, action: m.action });
  }
  await ctx.db.patch(row._id, { state, version, lastMoveAt: Date.now() });
  const next = { ...row, state, version };
  if (isFinished(state)) {
    const result = { scores: [state.scores[0], state.scores[1]] as [number, number], winner: (state.winner === 1 ? 1 : 0) as 0 | 1 };
    await ctx.db.patch(table._id, { status: 'finished', result, finishedAt: Date.now() });
    await recordGame(ctx, table, result);
    return;
  }
  await scheduleNext(ctx, table, next);
}

async function activeTableCount(ctx: QueryCtx, userId: Id<'users'>): Promise<number> {
  const mine = await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', userId)).collect();
  let n = 0;
  for (const m of mine) {
    const t = await ctx.db.get(m.tableId);
    if (t && t.status !== 'finished') n++;
  }
  return n;
}

// ---------- lobby ----------

export const create = mutation({
  args: { options: optionsValidator, rated: v.optional(v.boolean()) },
  handler: async (ctx, { options, rated }) => {
    const user = await requireUser(ctx);
    if ((await activeTableCount(ctx, user._id)) >= MAX_ACTIVE_TABLES_PER_USER) throw new TableError('RATE_LIMITED');
    const seats = emptySeats();
    seats[0] = { kind: 'user', userId: user._id, name: user.name ?? 'Igrač' };
    const code = await uniqueCode(ctx);
    const tableId = await ctx.db.insert('tables', {
      code,
      hostId: user._id,
      options: { ...options, botLevel: options.botLevel ?? 'medium' },
      rated: rated === true,
      status: 'lobby',
      seats,
      isTest: false,
      speed: 'live',
      createdAt: Date.now(),
    });
    await ctx.db.insert('memberships', { userId: user._id, tableId });
    return code;
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
    const seats = table.seats as Seat[];
    if (ownSeat(seats, user._id) >= 0) return table.code; // idempotent: rejoining restores the seat
    if (table.status !== 'lobby') throw new TableError('WRONG_STATE');
    const free = firstEmpty(seats);
    if (free < 0) throw new TableError('TABLE_FULL');
    if ((await activeTableCount(ctx, user._id)) >= MAX_ACTIVE_TABLES_PER_USER) throw new TableError('RATE_LIMITED');
    seats[free] = { kind: 'user', userId: user._id, name: user.name ?? 'Igrač' };
    await ctx.db.patch(table._id, { seats });
    await ctx.db.insert('memberships', { userId: user._id, tableId: table._id });
    return table.code;
  },
});

async function hostTable(ctx: MutationCtx, code: string) {
  const user = await requireUser(ctx);
  const table = await tableByCode(ctx, code);
  if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
  if (table.hostId !== user._id) throw new TableError('FORBIDDEN');
  if (table.status !== 'lobby') throw new TableError('WRONG_STATE');
  return { user, table };
}

export const addBot = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { table } = await hostTable(ctx, code);
    const seats = table.seats as Seat[];
    const free = firstEmpty(seats);
    if (free < 0) throw new TableError('TABLE_FULL');
    if (table.rated) throw new TableError('RATED_NEEDS_FOUR'); // bots never play rated games
    seats[free] = botSeat(seats, botLevelOf(table));
    await ctx.db.patch(table._id, { seats });
  },
});

/** Host removes a bot or another player from a seat. */
export const clearSeat = mutation({
  args: { code: v.string(), seat: v.number() },
  handler: async (ctx, { code, seat }) => {
    const { user, table } = await hostTable(ctx, code);
    const seats = table.seats as Seat[];
    const target = seats[seat];
    if (!target || target.kind === 'empty') throw new TableError('INVALID_INPUT');
    if (target.kind === 'user') {
      if (target.userId === user._id) throw new TableError('INVALID_INPUT'); // hosts leave via `leave`
      await dropMembership(ctx, target.userId, table._id);
    }
    seats[seat] = { kind: 'empty' };
    await ctx.db.patch(table._id, { seats });
  },
});

async function dropMembership(ctx: MutationCtx, userId: Id<'users'>, tableId: Id<'tables'>) {
  const rows = await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', userId)).collect();
  for (const r of rows) if (r.tableId === tableId) await ctx.db.delete(r._id);
}

async function deleteTable(ctx: MutationCtx, tableId: Id<'tables'>) {
  for (const m of await ctx.db.query('memberships').withIndex('by_table', (q) => q.eq('tableId', tableId)).collect()) await ctx.db.delete(m._id);
  for (const p of await ctx.db.query('presence').withIndex('by_table_user', (q) => q.eq('tableId', tableId)).collect()) await ctx.db.delete(p._id);
  for (const s of await ctx.db.query('tableStates').withIndex('by_table', (q) => q.eq('tableId', tableId)).collect()) await ctx.db.delete(s._id);
  for (const a of await ctx.db.query('actions').withIndex('by_table_seq', (q) => q.eq('tableId', tableId)).collect()) await ctx.db.delete(a._id);
  await ctx.db.delete(tableId);
}
export { deleteTable };

/**
 * Leaving a lobby frees the seat (the table closes when the last human leaves).
 * Leaving a running game hands the seat to a bot, so the others can finish.
 */
export const leave = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
    const seats = table.seats as Seat[];
    const seat = ownSeat(seats, user._id);
    if (seat < 0) return;
    await dropMembership(ctx, user._id, table._id);
    await dropPresence(ctx, table._id, user._id);
    if (table.status === 'finished') return;
    if (table.status === 'playing' && table.rated) {
      await abandon(ctx, table, user._id);
      return;
    }
    // In a running game a bot keeps the seat for good, also when it was standing in for an away player.
    seats[seat] =
      table.status === 'lobby'
        ? { kind: 'empty' }
        : { kind: 'bot', name: seats[seat].kind === 'empty' ? 'Bot' : seats[seat].name, level: botLevelOf(table) };
    if (humanCount(seats) === 0) {
      await deleteTable(ctx, table._id);
      return;
    }
    const hostId =
      table.hostId === user._id ? ((seats.find((s) => s.kind === 'user') as Extract<Seat, { kind: 'user' }>).userId) : table.hostId;
    await ctx.db.patch(table._id, { seats, hostId });
    if (table.status === 'playing') {
      const row = await loadState(ctx, table._id);
      await scheduleNext(ctx, { ...table, seats } as Doc<'tables'>, row);
    }
  },
});

export const start = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { table } = await hostTable(ctx, code);
    if (table.rated) {
      const users = new Map<string, Doc<'users'> | null>();
      for (const s of table.seats as Seat[]) if (s.kind === 'user') users.set(s.userId, await ctx.db.get(s.userId));
      const blocker = ratedBlocker(table.seats as Seat[], (id) => users.get(id) ?? null);
      if (blocker) throw new TableError(blocker);
    }
    const seats = fillWithBots(table.seats as Seat[], botLevelOf(table));
    const seedBuf = new Uint32Array(1);
    crypto.getRandomValues(seedBuf); // the seed is server-only until the game ends (architecture §9.1)
    const state = startState(table.options, seedBuf[0]);
    await ctx.db.patch(table._id, { seats, status: 'playing' });
    const rowId = await ctx.db.insert('tableStates', { tableId: table._id, state, version: 0 });
    const row = (await ctx.db.get(rowId))!;
    for (const s of seats) if (s.kind === 'user') await touchPresence(ctx, table._id, s.userId);
    await scheduleNext(ctx, { ...table, seats, status: 'playing' } as Doc<'tables'>, row);
  },
});

// ---------- reconnect ----------

async function presenceRow(ctx: QueryCtx, tableId: Id<'tables'>, userId: Id<'users'>) {
  return ctx.db.query('presence').withIndex('by_table_user', (q) => q.eq('tableId', tableId).eq('userId', userId)).unique();
}

async function dropPresence(ctx: MutationCtx, tableId: Id<'tables'>, userId: Id<'users'>) {
  const row = await presenceRow(ctx, tableId, userId);
  if (row) await ctx.db.delete(row._id);
}

/** Records a heartbeat. A new row starts the presence-check chain for this seat. */
async function touchPresence(ctx: MutationCtx, tableId: Id<'tables'>, userId: Id<'users'>) {
  const row = await presenceRow(ctx, tableId, userId);
  if (row) {
    await ctx.db.patch(row._id, { lastSeen: Date.now() });
    return;
  }
  const presenceId = await ctx.db.insert('presence', { tableId, userId, lastSeen: Date.now() });
  await ctx.scheduler.runAfter(RECONNECT_GRACE_MS, internal.tables.checkPresence, { presenceId });
}

/**
 * Sent by an open table page every HEARTBEAT_MS. Keeps the seat, and gives it back to a
 * returning player whose seat a bot was standing in for.
 */
export const heartbeat = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user) || table.status !== 'playing') return;
    const back = reclaimSeat(table.seats as Seat[], user._id);
    if (back) {
      await ctx.db.patch(table._id, { seats: back.seats });
      // A table that waited for its players moves again; a pending stand-in step for this seat becomes a no-op.
      await scheduleNext(ctx, { ...table, seats: back.seats } as Doc<'tables'>, await loadState(ctx, table._id));
    } else if (seatOf(table.seats as Seat[], user._id) < 0) {
      return;
    }
    await touchPresence(ctx, table._id, user._id);
  },
});

/**
 * Scheduled once per grace period per seated human (not per heartbeat, to keep the
 * function-call budget small). Re-arms while the player is around; otherwise a bot stands in.
 */
export const checkPresence = internalMutation({
  args: { presenceId: v.id('presence') },
  handler: async (ctx, { presenceId }) => {
    const row = await ctx.db.get(presenceId);
    if (!row) return;
    const table = await ctx.db.get(row.tableId);
    const seat = table ? seatOf(table.seats as Seat[], row.userId) : -1;
    if (!table || table.status !== 'playing' || seat < 0) {
      await ctx.db.delete(row._id);
      return;
    }
    const verdict = presenceCheck(row.lastSeen, Date.now(), RECONNECT_GRACE_MS);
    if (!verdict.expired) {
      await ctx.scheduler.runAt(verdict.recheckAt, internal.tables.checkPresence, { presenceId });
      return;
    }
    await ctx.db.delete(row._id);
    if (table.rated) {
      await abandon(ctx, table, row.userId);
      return;
    }
    const seats = standIn(table.seats as Seat[], seat, botLevelOf(table));
    await ctx.db.patch(table._id, { seats });
    await scheduleNext(ctx, { ...table, seats } as Doc<'tables'>, await loadState(ctx, table._id));
  },
});

/**
 * A player left a rated game (or dropped past the grace period): the match ends as abandoned
 * and their team loses (architecture §7). Friendly games get a stand-in bot instead.
 */
async function abandon(ctx: MutationCtx, table: Doc<'tables'>, userId: Id<'users'>) {
  const state = (await loadState(ctx, table._id)).state as BelaState;
  const seat = ownSeat(table.seats as Seat[], userId);
  const result = { scores: [state.scores[0], state.scores[1]] as [number, number], winner: (seat % 2 === 0 ? 1 : 0) as 0 | 1 };
  await ctx.db.patch(table._id, { status: 'finished', result, finishedAt: Date.now() });
  await recordGame(ctx, table, { ...result, abandonedBy: userId });
}

/**
 * After a match, any of its players opens the rematch: a lobby with the same seating and
 * options, hosted by them. Everyone else asking gets the same table.
 */
export const rematch = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
    if (ownSeat(table.seats as Seat[], user._id) < 0) throw new TableError('FORBIDDEN');
    if (table.status !== 'finished') throw new TableError('WRONG_STATE');
    if (table.rematchCode) {
      const existing = await tableByCode(ctx, table.rematchCode);
      if (existing) return existing.code;
    }
    if ((await activeTableCount(ctx, user._id)) >= MAX_ACTIVE_TABLES_PER_USER) throw new TableError('RATE_LIMITED');
    const free = new Set<Id<'users'>>([user._id]);
    for (const s of table.seats as Seat[]) {
      const id = s.kind === 'user' ? s.userId : s.kind === 'bot' ? s.standInFor : undefined;
      if (id && (await activeTableCount(ctx, id)) < MAX_ACTIVE_TABLES_PER_USER) free.add(id);
    }
    const seats = rematchSeats(table.seats as Seat[], (id) => free.has(id));
    const next = await uniqueCode(ctx);
    const tableId = await ctx.db.insert('tables', {
      code: next,
      hostId: user._id,
      options: table.options,
      status: 'lobby',
      seats,
      isTest: table.isTest,
      speed: table.speed,
      rated: table.rated,
      createdAt: Date.now(),
    });
    for (const s of seats) if (s.kind === 'user') await ctx.db.insert('memberships', { userId: s.userId, tableId });
    await ctx.db.patch(table._id, { rematchCode: next });
    return next;
  },
});

/** Daily (crons.ts): deletes lobbies nobody started and tables every human walked away from. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const lobbies = await ctx.db
      .query('tables')
      .withIndex('by_status', (q) => q.eq('status', 'lobby').lte('createdAt', now - STALE_TABLE_MS))
      .take(200);
    const running = await ctx.db
      .query('tables')
      .withIndex('by_status', (q) => q.eq('status', 'playing').lte('createdAt', now - STALE_TABLE_MS))
      .take(200);
    // Token buckets idle for a day are full again anyway.
    for (const r of await ctx.db.query('rateLimits').withIndex('by_at', (q) => q.lte('at', now - STALE_TABLE_MS)).take(500)) await ctx.db.delete(r._id);
    for (const t of [...lobbies, ...running]) {
      const row = t.status === 'playing' ? await ctx.db.query('tableStates').withIndex('by_table', (q) => q.eq('tableId', t._id)).unique() : null;
      if (isAbandoned({ status: t.status, seats: t.seats as Seat[], createdAt: t.createdAt, lastMoveAt: row?.lastMoveAt ?? null }, now)) {
        await deleteTable(ctx, t._id);
      }
    }
  },
});

// ---------- play ----------

export const act = mutation({
  args: { code: v.string(), action: actionValidator },
  handler: async (ctx, { code, action }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user)) throw new TableError('NOT_FOUND');
    if (table.status !== 'playing') throw new TableError('WRONG_STATE');
    // The seat comes from the table, never from the request (architecture §9.1).
    const seat = seatOf(table.seats as Seat[], user._id);
    if (seat < 0) throw new TableError('FORBIDDEN');
    await consume(ctx, `act:${table._id}:${user._id}`, ACT_LIMIT);
    const row = await loadState(ctx, table._id);
    const state = applyHumanAction(row.state as BelaState, seat, action as BelaAction);
    await commit(ctx, table, row, state, [{ seat, action: action as BelaAction }]);
  },
});

/** Scheduled: plays bot moves / collects tricks. A stale `version` makes it a no-op. */
export const step = internalMutation({
  args: { tableId: v.id('tables'), version: v.number() },
  handler: async (ctx, { tableId, version }) => {
    const table = await ctx.db.get(tableId);
    if (!table || table.status !== 'playing') return;
    const row = await loadState(ctx, tableId);
    if (row.version !== version) return;
    const { state, moves } = advance(row.state as BelaState, table.seats as Seat[], row.version, table.speed === 'fast' ? FAST_BATCH : 1);
    if (moves.length > 0) await commit(ctx, table, row, state, moves);
  },
});

/** Scheduled turn timer: the humans didn't move in time, so the server moves for them. */
export const timeout = internalMutation({
  args: { tableId: v.id('tables'), version: v.number() },
  handler: async (ctx, { tableId, version }) => {
    const table = await ctx.db.get(tableId);
    if (!table || table.status !== 'playing') return;
    const row = await loadState(ctx, tableId);
    if (row.version !== version) return;
    const move = timeoutMove(row.state as BelaState, table.seats as Seat[], version);
    if (move) await commit(ctx, table, row, belaGame.apply(row.state as BelaState, move.action), [move]);
  },
});

// ---------- reads ----------

function publicSeats(seats: Seat[], me: Id<'users'>) {
  return seats.map((s, seat) => ({
    seat,
    kind: s.kind,
    name: s.kind === 'empty' ? null : s.name,
    isMe: (s.kind === 'user' && s.userId === me) || (s.kind === 'bot' && s.standInFor === me),
    /** A bot is standing in for this player until they reconnect. */
    away: s.kind === 'bot' && s.standInFor !== undefined,
  }));
}

/**
 * Everything the table page needs. `view` is the caller's seat projection and nothing
 * else: the stored state, seed and other hands never leave the server.
 */
export const watch = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const table = await tableByCode(ctx, code);
    if (!table || !visibleTo(table, user)) return null;
    const seats = table.seats as Seat[];
    // An away player still sees their seat, so the page doesn't flicker while the heartbeat reclaims it.
    const mySeat = ownSeat(seats, user._id);
    let view = null;
    let spectating = false;
    let deadline: number | null = null;
    if (table.status !== 'lobby') {
      const row = await loadState(ctx, table._id);
      deadline = table.status === 'playing' ? (row.deadline ?? null) : null;
      // Admins may watch bot-only test tables (never real ones) from seat 0.
      spectating = mySeat < 0 && table.isTest && user.isAdmin === true;
      if (mySeat >= 0 || spectating) view = viewFor(row.state as BelaState, Math.max(mySeat, 0));
    }
    return {
      code: table.code,
      status: table.status,
      isHost: table.hostId === user._id,
      mySeat: mySeat < 0 ? null : mySeat,
      seats: publicSeats(seats, user._id),
      options: table.options,
      result: table.result ?? null,
      isTest: table.isTest,
      spectating,
      view,
      deadline,
      rematchCode: table.rematchCode ?? null,
      rated: table.rated === true,
    };
  },
});

/** The caller's unfinished tables (test tables never appear here). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
    const out = [];
    for (const m of rows) {
      const t = await ctx.db.get(m.tableId);
      if (!t || t.isTest) continue;
      out.push({
        code: t.code,
        status: t.status,
        players: (t.seats as Seat[]).filter((s) => s.kind === 'user').length,
        createdAt: t.createdAt,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** The caller's finished matches, newest first, from the caller's side of the table. Public facts only. */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query('memberships').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
    const out = [];
    for (const m of rows) {
      const t = await ctx.db.get(m.tableId);
      if (!t || t.isTest || t.status !== 'finished' || !t.result) continue;
      const seats = t.seats as Seat[];
      const mine = ownSeat(seats, user._id);
      if (mine < 0) continue;
      const team = mine % 2;
      const name = (seat: number) => (seats[seat].kind === 'empty' ? '' : (seats[seat] as { name: string }).name);
      out.push({
        id: `online:${t.code}`,
        playedAt: t.finishedAt ?? t.createdAt,
        source: 'online' as const,
        target: t.options.target,
        scores: [t.result.scores[team], t.result.scores[1 - team]] as [number, number],
        won: t.result.winner === team,
        players: [name((mine + 2) % 4), name((mine + 1) % 4), name((mine + 3) % 4)],
      });
    }
    return out.sort((a, b) => b.playedAt - a.playedAt);
  },
});
