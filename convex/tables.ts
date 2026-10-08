import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { optionsValidator } from './schema';
import { requireUser } from './lib/auth';
import {
  AUTO_DELAY_MS,
  BOT_DELAY_MS,
  FAST_BATCH,
  MAX_ACTIVE_TABLES_PER_USER,
  NEXT_HAND_DELAY_MS,
} from './lib/config';
import { TableError } from './lib/errors';
import {
  advance,
  applyHumanAction,
  botSeat,
  emptySeats,
  fillWithBots,
  firstEmpty,
  humanCount,
  isFinished,
  makeCode,
  moverOf,
  seatOf,
  startState,
  type Seat,
  type ServerBotLevel,
} from './lib/tableLogic';
import type { BelaAction, BelaState } from '../src/games/bela/state';
import { viewFor } from '../src/games/bela/view';

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
  if (m.kind === 'none') return;
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
  await ctx.db.patch(row._id, { state, version });
  const next = { ...row, state, version };
  if (isFinished(state)) {
    await ctx.db.patch(table._id, { status: 'finished', result: { scores: [...state.scores], winner: state.winner ?? 0 } });
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
  args: { options: optionsValidator },
  handler: async (ctx, { options }) => {
    const user = await requireUser(ctx);
    if ((await activeTableCount(ctx, user._id)) >= MAX_ACTIVE_TABLES_PER_USER) throw new TableError('RATE_LIMITED');
    const seats = emptySeats();
    seats[0] = { kind: 'user', userId: user._id, name: user.name ?? 'Igrač' };
    const code = await uniqueCode(ctx);
    const tableId = await ctx.db.insert('tables', {
      code,
      hostId: user._id,
      options: { ...options, botLevel: options.botLevel ?? 'medium' },
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
    if (seatOf(seats, user._id) >= 0) return table.code; // idempotent: rejoining restores the seat
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
    const seat = seatOf(seats, user._id);
    if (seat < 0) return;
    await dropMembership(ctx, user._id, table._id);
    if (table.status === 'finished') return;
    seats[seat] =
      table.status === 'lobby'
        ? { kind: 'empty' }
        : { kind: 'bot', name: seats[seat].kind === 'user' ? (seats[seat] as { name: string }).name : 'Bot', level: botLevelOf(table) };
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
    const seats = fillWithBots(table.seats as Seat[], botLevelOf(table));
    const seedBuf = new Uint32Array(1);
    crypto.getRandomValues(seedBuf); // the seed is server-only until the game ends (architecture §9.1)
    const state = startState(table.options, seedBuf[0]);
    await ctx.db.patch(table._id, { seats, status: 'playing' });
    const rowId = await ctx.db.insert('tableStates', { tableId: table._id, state, version: 0 });
    const row = (await ctx.db.get(rowId))!;
    await scheduleNext(ctx, { ...table, seats, status: 'playing' } as Doc<'tables'>, row);
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

// ---------- reads ----------

function publicSeats(seats: Seat[], me: Id<'users'>) {
  return seats.map((s, seat) => ({
    seat,
    kind: s.kind,
    name: s.kind === 'empty' ? null : s.name,
    isMe: s.kind === 'user' && s.userId === me,
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
    const mySeat = seatOf(seats, user._id);
    let view = null;
    let spectating = false;
    if (table.status !== 'lobby') {
      const row = await loadState(ctx, table._id);
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
