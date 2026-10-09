import { describe, expect, it } from 'vitest';
import { belaGame } from '../../src/games/bela/game';
import { viewFor } from '../../src/games/bela/view';
import {
  advance,
  applyHumanAction,
  emptySeats,
  fillWithBots,
  makeCode,
  moverOf,
  replay,
  startState,
  type Seat,
  type ServerBotLevel,
} from '../../convex/lib/tableLogic';
import { CODE_ALPHABET, CODE_LENGTH } from '../../convex/lib/config';

const opts = (level: ServerBotLevel) => ({ ...belaGame.defaultOptions, target: 501 as const, botLevel: level });
const human = (userId: string): Seat => ({ kind: 'user', userId: userId as never, name: userId });

describe('bot-only tables', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    it(`play a whole ${level} match without an illegal move`, () => {
      const seats = fillWithBots(emptySeats(), level);
      const { state, moves } = advance(startState(opts(level), 11), seats, 0, 5000);
      expect(belaGame.isOver(state)).toBe(true);
      expect(state.winner).not.toBeNull();
      expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(501);
      expect(moves.length).toBeGreaterThan(100);
    });
  }

  it('is reproducible: same seed and version give the same game', () => {
    const seats = fillWithBots(emptySeats(), 'medium');
    const a = advance(startState(opts('medium'), 5), seats, 0, 5000);
    const b = advance(startState(opts('medium'), 5), seats, 0, 5000);
    expect(a.state.scores).toEqual(b.state.scores);
  });
});

describe('moverOf', () => {
  it('waits for a human on their turn and drives bots otherwise', () => {
    const seats: Seat[] = [human('a'), ...fillWithBots(emptySeats(), 'medium').slice(1)];
    const s = startState(opts('medium'), 3);
    expect(belaGame.currentPlayer(s)).toBe(0);
    expect(moverOf(s, seats)).toEqual({ kind: 'none' });
    const afterHuman = applyHumanAction(s, 0, { type: 'pass' });
    expect(moverOf(afterHuman, seats)).toEqual({ kind: 'bot', seat: 1 });
  });

  it('does not deal the next hand itself while a human is seated', () => {
    const seats: Seat[] = [human('a'), ...fillWithBots(emptySeats(), 'easy').slice(1)];
    let s = startState(opts('easy'), 9);
    s = advance(s, fillWithBots(emptySeats(), 'easy'), 0, 5000).state; // play everything out as bots
    const hand = { ...s, phase: 'handOver' as const, winner: null };
    expect(moverOf(hand, seats)).toEqual({ kind: 'none' });
    expect(moverOf(hand, fillWithBots(emptySeats(), 'easy')).kind).toBe('auto');
  });
});

describe('applyHumanAction', () => {
  const s = startState(opts('medium'), 4);

  it('rejects an action out of turn', () => {
    expect(() => applyHumanAction(s, 2, { type: 'pass' })).toThrow(/NOT_YOUR_TURN/);
  });

  it('rejects an action that is not legal', () => {
    const afterCall = applyHumanAction(s, 0, { type: 'call', suit: 'hearts' });
    const seat = belaGame.currentPlayer(afterCall)!;
    const stranger = viewFor(afterCall, (seat + 1) % 4).hand[0];
    expect(() => applyHumanAction(afterCall, seat, { type: 'play', card: stranger })).toThrow(/ILLEGAL_ACTION/);
  });

  it('never lets a client send the system collect action', () => {
    expect(() => applyHumanAction(s, 0, { type: 'collect' })).toThrow(/ILLEGAL_ACTION/);
  });
});

/** Every {suit, rank} object anywhere in a JSON value. */
function cardsIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((x) => cardsIn(x, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.suit === 'string' && typeof o.rank === 'string') out.push(`${o.rank}${o.suit}`);
    Object.values(o).forEach((x) => cardsIn(x, out));
  }
  return out;
}

describe('view leakage (release gate, architecture §9.1)', () => {
  it("a seat view never contains another seat's hidden cards, the talon, or the seed", () => {
    const seats = fillWithBots(emptySeats(), 'medium');
    let s = startState(opts('medium'), 123456789);
    let checked = 0;
    for (let guard = 0; guard < 400 && !belaGame.isOver(s); guard++) {
      for (let seat = 0; seat < 4; seat++) {
        const v = viewFor(s, seat);
        const visible = new Set(cardsIn(v));
        const ownOrPublic = new Set([
          ...s.hands[seat],
          ...s.talon[seat],
          ...s.played,
          ...s.trick.map((p) => p.card),
          ...s.tricks.flat().map((p) => p.card),
          ...(s.lastTrick ?? []).map((p) => p.card),
          ...(s.declarationsShown ? s.declarations : []).flatMap((d) => d.cards),
        ].map((c) => `${c.rank}${c.suit}`));
        for (const other of [0, 1, 2, 3].filter((o) => o !== seat)) {
          for (const c of [...s.hands[other], ...s.talon[other]]) {
            const id = `${c.rank}${c.suit}`;
            if (!ownOrPublic.has(id)) expect(visible.has(id), `seat ${seat} sees ${id} held by ${other}`).toBe(false);
          }
        }
        expect(JSON.stringify(v)).not.toContain(String(s.seed));
        expect(Object.keys(v)).not.toContain('hands');
        expect(Object.keys(v)).not.toContain('seed');
        checked++;
      }
      s = advance(s, seats, 0, 1).state;
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('table codes', () => {
  it('use only unambiguous characters', () => {
    let n = 0;
    const code = makeCode(() => n++ % CODE_ALPHABET.length);
    expect(code).toHaveLength(CODE_LENGTH);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});

describe('replay (architecture §5: seed + options + action log rebuild any game)', () => {
  it('rebuilds the exact state from the seed and the logged moves', () => {
    const seats = fillWithBots(emptySeats(), 'hard');
    const start = startState(opts('hard'), 424242);
    const { state, moves } = advance(start, seats, 0, 5000);
    expect(belaGame.isOver(state)).toBe(true);
    expect(replay(opts('hard'), 424242, moves.map((m) => m.action))).toEqual(state);
  });

  it('rejects a log containing an illegal move', () => {
    expect(() => replay(opts('easy'), 1, [{ type: 'play', card: { suit: 'hearts', rank: 'A' } }])).toThrow(/ILLEGAL_ACTION/);
  });
});
