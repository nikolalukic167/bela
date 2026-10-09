import { describe, expect, it } from 'vitest';
import { CHAT_BURST, CHAT_TEXT_MAX, CHAT_WINDOW_MS } from '../../convex/lib/config';
import { QUICK_PHRASES, cleanChatText, isPhrase, rateLimited, textAllowed, visibleMessages } from '../../convex/lib/chatLogic';

describe('quick phrases', () => {
  it('are a fixed list of keys; anything else is rejected', () => {
    expect(QUICK_PHRASES.length).toBeGreaterThan(5);
    for (const p of QUICK_PHRASES) expect(isPhrase(p)).toBe(true);
    expect(isPhrase('I have the jack of hearts')).toBe(false);
    expect(isPhrase('')).toBe(false);
  });
});

describe('free text', () => {
  it('is allowed only in the lobby of an unrated table', () => {
    expect(textAllowed({ status: 'lobby', rated: false })).toBe(true);
    expect(textAllowed({ status: 'lobby', rated: true })).toBe(false);
    expect(textAllowed({ status: 'playing', rated: false })).toBe(false);
    expect(textAllowed({ status: 'finished', rated: false })).toBe(false);
  });

  it('is trimmed, collapsed and bounded, and refuses control characters', () => {
    expect(cleanChatText('  bok   svima ')).toBe('bok svima');
    expect(cleanChatText('')).toBeNull();
    expect(cleanChatText('   ')).toBeNull();
    expect(cleanChatText('x'.repeat(CHAT_TEXT_MAX))).toHaveLength(CHAT_TEXT_MAX);
    expect(cleanChatText('x'.repeat(CHAT_TEXT_MAX + 1))).toBeNull();
    expect(cleanChatText('a\u0007b')).toBeNull();
    expect(cleanChatText(42)).toBeNull();
  });
});

describe('rateLimited', () => {
  it(`allows ${CHAT_BURST} messages per window, then waits for the oldest to age out`, () => {
    const now = 100_000;
    const recent = Array.from({ length: CHAT_BURST - 1 }, (_, i) => now - i * 100);
    expect(rateLimited(recent, now)).toBe(false);
    expect(rateLimited([...recent, now - 50], now)).toBe(true);
    expect(rateLimited([...recent, now - CHAT_WINDOW_MS], now)).toBe(false);
  });
});

describe('visibleMessages', () => {
  const row = (author: string, at: number, expiresAt = at + 1000) => ({ userId: author, at, expiresAt });
  it('drops expired entries and authors the viewer muted, oldest first', () => {
    const rows = [row('b', 3), row('a', 1), row('c', 2, 50), row('a', 4)];
    expect(visibleMessages(rows, 100, new Set(['b'])).map((r) => r.at)).toEqual([1, 4]);
  });
});
