// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HEARTBEAT_MS } from '../../convex/lib/config';
import { replay } from '../../convex/lib/tableLogic';
import { elapse, newBackend, OPTIONS, signUp } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('deck seed reveal (architecture §9.1)', () => {
  it('after the match, the revealed seed and options plus the action log replay to the final result', async () => {
    const t = newBackend();
    const admin = await signUp(t, 'Boss', { isAdmin: true });
    const c = await admin.as.mutation(api.admin.startBotMatch, { level: 'medium', speed: 'fast', target: 501 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const w = (await admin.as.query(api.tables.watch, { code: c }))!;
    expect(w.status).toBe('finished');
    expect(typeof w.seed).toBe('number');
    const log = (await t.run((ctx) => ctx.db.query('actions').collect())).sort((a, b) => a.seq - b.seq).map((a) => a.action);
    const end = replay(w.options, w.seed!, log);
    expect([end.scores[0], end.scores[1]]).toEqual(w.result!.scores);
    expect(end.winner).toBe(w.result!.winner);
  });

  it('the seed never reaches a player before the match ends, in any phase', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    const seed = await t.run(async (ctx) => (await ctx.db.query('tableStates').first())!.state.seed as number);
    const phases = new Set<string>();
    // Turn timers play for the host; check what the host receives every few seconds.
    await elapse(t, 15 * 60_000, async (at) => {
      if (at % HEARTBEAT_MS === 0) await host.as.mutation(api.tables.heartbeat, { code: c });
      if (at % 5000 !== 0) return;
      const w = await host.as.query(api.tables.watch, { code: c });
      if (w?.status !== 'playing') return;
      phases.add(w.view!.phase);
      expect(w.seed).toBeNull();
      expect(JSON.stringify(w)).not.toContain(String(seed));
    }, 1000);
    expect(phases.size).toBeGreaterThanOrEqual(3);
  });

  it('a finished real match reveals its seed to the players', async () => {
    const t = newBackend();
    const host = await signUp(t, 'Host');
    const c = await host.as.mutation(api.tables.create, { options: OPTIONS });
    await host.as.mutation(api.tables.start, { code: c });
    const seed = await t.run(async (ctx) => {
      const row = (await ctx.db.query('tableStates').first())!;
      await ctx.db.patch(row._id, { state: { ...row.state, scores: [495, 495] } });
      return row.state.seed as number;
    });
    await elapse(t, 60 * 60_000, async (at) => {
      if (at % HEARTBEAT_MS === 0) await host.as.mutation(api.tables.heartbeat, { code: c });
    }, 5000);
    const w = await host.as.query(api.tables.watch, { code: c });
    expect(w?.status).toBe('finished');
    expect(w?.seed).toBe(seed);
  });
});
