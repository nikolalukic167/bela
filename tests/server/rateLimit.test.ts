import { describe, expect, it } from 'vitest';
import { takeToken } from '../../convex/lib/rateLimit';

const limit = { burst: 3, refillMs: 1000 };
/** The bucket after a granted request (fails the test if it was refused). */
function granted(r: ReturnType<typeof takeToken>) {
  if (!r.ok) throw new Error('refused');
  return { tokens: r.tokens, at: r.at };
}

describe('takeToken (token bucket)', () => {
  it('a fresh bucket allows a burst, then refuses', () => {
    let b = granted(takeToken(null, 0, limit));
    expect(b).toEqual({ tokens: 2, at: 0 });
    b = granted(takeToken(b, 0, limit));
    b = granted(takeToken(b, 0, limit));
    expect(takeToken(b, 10, limit).ok).toBe(false);
  });

  it('refills one token per interval, up to the burst size', () => {
    const empty = { tokens: 0, at: 0 };
    expect(takeToken(empty, 999, limit).ok).toBe(false);
    expect(takeToken(empty, 1000, limit)).toEqual({ ok: true, tokens: 0, at: 1000 });
    expect(takeToken(empty, 60_000, limit)).toEqual({ ok: true, tokens: 2, at: 60_000 });
  });

  it('keeps the fraction of a token already earned', () => {
    const b = granted(takeToken({ tokens: 0, at: 0 }, 1500, limit));
    expect(b).toEqual({ tokens: 0, at: 1000 });
    expect(takeToken(b, 2000, limit).ok).toBe(true);
  });
});
