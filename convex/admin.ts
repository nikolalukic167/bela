// Admin panel backend. Every public function starts with requireAdmin, which answers
// NOT_FOUND to everyone else. Test data (isTest) is invisible to real users everywhere else.
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';
import { usernameToEmail } from '../src/account/username';
import { requireAdmin } from './lib/auth';
import { TableError } from './lib/errors';
import {
  BOT_NAMES,
  emptySeats,
  fillWithBots,
  startState,
  type Seat,
  type ServerBotLevel,
} from './lib/tableLogic';
import { deleteTable, loadState, scheduleNext, uniqueCode } from './tables';
import { DEFAULT_RULES, type BelaState } from '../src/games/bela/state';

const levelValidator = v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'));
const speedValidator = v.union(v.literal('live'), v.literal('fast'));

async function createTestTable(
  ctx: MutationCtx,
  hostId: Id<'users'>,
  opts: { seats: Seat[]; level: ServerBotLevel; speed: 'live' | 'fast'; target: 501 | 701 | 1001; start: boolean },
): Promise<string> {
  const options = { target: opts.target, direction: 'ccw' as const, ...DEFAULT_RULES, botLevel: opts.level };
  const code = await uniqueCode(ctx);
  const seats = opts.start ? fillWithBots(opts.seats, opts.level) : opts.seats;
  const tableId = await ctx.db.insert('tables', {
    code,
    hostId,
    options,
    status: opts.start ? 'playing' : 'lobby',
    seats,
    isTest: true,
    speed: opts.speed,
    createdAt: Date.now(),
  });
  if (opts.start) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const rowId = await ctx.db.insert('tableStates', { tableId, state: startState(options, seed), version: 0 });
    const table = (await ctx.db.get(tableId))!;
    await scheduleNext(ctx, table, (await ctx.db.get(rowId))!);
  }
  return code;
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tables = await ctx.db.query('tables').withIndex('by_test', (q) => q.eq('isTest', true)).order('desc').take(50);
    const rows = [];
    for (const t of tables) {
      let scores: number[] | null = t.result?.scores ?? null;
      let handNo: number | null = null;
      if (t.status === 'playing') {
        const s = (await loadState(ctx, t._id)).state as BelaState;
        scores = s.scores;
        handNo = s.handNo;
      }
      rows.push({
        code: t.code,
        status: t.status,
        speed: t.speed,
        level: t.options.botLevel ?? 'medium',
        target: t.options.target,
        seats: (t.seats as Seat[]).map((s) => (s.kind === 'empty' ? null : s.name)),
        scores,
        handNo,
      });
    }
    const testUsers = await ctx.db.query('users').withIndex('by_test', (q) => q.eq('isTest', true)).collect();
    const realTables = (await ctx.db.query('tables').withIndex('by_test', (q) => q.eq('isTest', false)).collect()).length;
    return { tables: rows, testUsers: testUsers.length, realTables };
  },
});

/** Test bot accounts, an open lobby to join, a live bot match and two finished ones. */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.query('users').withIndex('by_test', (q) => q.eq('isTest', true)).collect();
    if (existing.length > 0) throw new TableError('WRONG_STATE'); // clear first; seeding twice would duplicate
    const botUsers: Id<'users'>[] = [];
    for (const name of BOT_NAMES.slice(0, 6)) {
      botUsers.push(await ctx.db.insert('users', { name: `Bot ${name}`, isBot: true, isTest: true }));
    }
    const named = (i: number, level: ServerBotLevel): Seat => ({ kind: 'bot', name: BOT_NAMES[i], level, userId: botUsers[i] });
    const lobby = emptySeats();
    lobby[0] = named(0, 'medium');
    lobby[1] = named(1, 'medium');
    const codes = {
      lobby: await createTestTable(ctx, admin._id, { seats: lobby, level: 'medium', speed: 'live', target: 501, start: false }),
      live: await createTestTable(ctx, admin._id, {
        seats: [named(0, 'hard'), named(1, 'medium'), named(2, 'hard'), named(3, 'medium')],
        level: 'medium',
        speed: 'live',
        target: 501,
        start: true,
      }),
      finishedA: await createTestTable(ctx, admin._id, { seats: emptySeats(), level: 'medium', speed: 'fast', target: 501, start: true }),
      finishedB: await createTestTable(ctx, admin._id, { seats: emptySeats(), level: 'easy', speed: 'fast', target: 701, start: true }),
    };
    return codes;
  },
});

export const startBotMatch = mutation({
  args: { level: levelValidator, speed: speedValidator, target: v.union(v.literal(501), v.literal(701), v.literal(1001)) },
  handler: async (ctx, { level, speed, target }) => {
    const admin = await requireAdmin(ctx);
    return createTestTable(ctx, admin._id, { seats: emptySeats(), level, speed, target, start: true });
  },
});

/** Removes every test table and test account. Real data is untouched (everything is flagged isTest). */
export const clearTestData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tables = await ctx.db.query('tables').withIndex('by_test', (q) => q.eq('isTest', true)).collect();
    for (const t of tables) await deleteTable(ctx, t._id);
    const users = await ctx.db.query('users').withIndex('by_test', (q) => q.eq('isTest', true)).collect();
    for (const u of users) await ctx.db.delete(u._id);
    return { tables: tables.length, users: users.length };
  },
});

/**
 * Run from the Convex dashboard (Functions → admin:setAdmin → Run), never from the client:
 * `{ "username": "nikola", "admin": true }`. The account must already exist (sign up with a username).
 */
export const setAdmin = internalMutation({
  args: { username: v.string(), admin: v.boolean() },
  handler: async (ctx, { username, admin }) => {
    const email = usernameToEmail(username);
    const user = await ctx.db.query('users').withIndex('email', (q) => q.eq('email', email)).unique();
    if (!user) throw new TableError('NOT_FOUND');
    await ctx.db.patch(user._id, { isAdmin: admin });
  },
});
