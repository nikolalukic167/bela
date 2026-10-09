import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** One seat at a table. Bots may carry a bot account so they can appear in histories later. */
export const seatValidator = v.union(
  v.object({ kind: v.literal('empty') }),
  v.object({ kind: v.literal('user'), userId: v.id('users'), name: v.string() }),
  v.object({
    kind: v.literal('bot'),
    name: v.string(),
    level: v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
    userId: v.optional(v.id('users')),
    /** Playing for this away player until they come back (reconnect). */
    standInFor: v.optional(v.id('users')),
  }),
);

export const optionsValidator = v.object({
  target: v.union(v.literal(501), v.literal(701), v.literal(1001)),
  direction: v.union(v.literal('ccw'), v.literal('cw')),
  belaAlwaysCounts: v.boolean(),
  tie: v.union(v.literal('hangs'), v.literal('fails')),
  botLevel: v.optional(v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))),
});

export default defineSchema({
  ...authTables,

  // Same fields as authTables.users, plus our own flags. All flags are optional so
  // Convex Auth can create users without knowing about them.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Can open the admin panel. Granted only from the Convex dashboard (admin:setAdmin). */
    isAdmin: v.optional(v.boolean()),
    /** Bot account (no login). */
    isBot: v.optional(v.boolean()),
    /** Created by the admin panel's seed; hidden from real users and removable in one click. */
    isTest: v.optional(v.boolean()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_test', ['isTest']),

  tables: defineTable({
    code: v.string(),
    hostId: v.id('users'),
    options: optionsValidator,
    status: v.union(v.literal('lobby'), v.literal('playing'), v.literal('finished')),
    seats: v.array(seatValidator),
    /** Bot-only test tables set this; real tables never do. Hidden from real users. */
    isTest: v.boolean(),
    /** 'fast' runs many bot moves per scheduled call (admin test matches). */
    speed: v.union(v.literal('live'), v.literal('fast')),
    /** Final scores [team 0, team 1] once finished. */
    result: v.optional(v.object({ scores: v.array(v.number()), winner: v.number() })),
    createdAt: v.number(),
    /** When the match ended; older rows fall back to createdAt. */
    finishedAt: v.optional(v.number()),
  })
    .index('by_code', ['code'])
    .index('by_host', ['hostId'])
    .index('by_test', ['isTest', 'createdAt']),

  // Full engine state. SERVER ONLY: no query may return this table's rows (architecture §6).
  tableStates: defineTable({
    tableId: v.id('tables'),
    state: v.any(),
    version: v.number(),
  }).index('by_table', ['tableId']),

  // Append-only action log (seed + options + actions rebuild any game).
  actions: defineTable({
    tableId: v.id('tables'),
    seq: v.number(),
    seat: v.number(),
    action: v.any(),
  }).index('by_table_seq', ['tableId', 'seq']),

  // Last heartbeat of each human at a running table. Kept apart from `tables` so a heartbeat
  // doesn't re-run every player's `watch` query. A row exists while its presence check is scheduled.
  presence: defineTable({
    tableId: v.id('tables'),
    userId: v.id('users'),
    lastSeen: v.number(),
  }).index('by_table_user', ['tableId', 'userId']),

  // Which tables a user sits at, so "my tables" is an index lookup.
  memberships: defineTable({
    userId: v.id('users'),
    tableId: v.id('tables'),
  })
    .index('by_user', ['userId'])
    .index('by_table', ['tableId']),
});
