// Pure chat rules (architecture §8), tested without Convex. Partners must not be able to share
// their hands, so a running game only carries a fixed list of phrase keys, translated on the
// client; free text exists only in the lobby of an unrated table.
import { CHAT_BURST, CHAT_LIST_SIZE, CHAT_TEXT_MAX, CHAT_WINDOW_MS } from './config';

/** Phrase keys. None of them says anything about cards; keep it that way when adding more. */
export const QUICK_PHRASES = [
  'hello',
  'goodLuck',
  'wellPlayed',
  'thanks',
  'sorry',
  'oops',
  'gg',
  'oneMore',
  'clap',
  'laugh',
  'surprised',
  'facepalm',
] as const;
export type QuickPhrase = (typeof QUICK_PHRASES)[number];

export const isPhrase = (p: unknown): p is QuickPhrase => typeof p === 'string' && (QUICK_PHRASES as readonly string[]).includes(p);

export const textAllowed = (table: { status: string; rated: boolean }) => table.status === 'lobby' && !table.rated;

/** Trimmed, whitespace collapsed, 1–CHAT_TEXT_MAX characters, no control characters; else null. */
export function cleanChatText(raw: unknown): string | null {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  // eslint-disable-next-line no-control-regex
  if (text.length === 0 || text.length > CHAT_TEXT_MAX || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

/** `recent` are the player's send times at this table; the window slides. */
export const rateLimited = (recent: number[], now: number) => recent.filter((at) => at > now - CHAT_WINDOW_MS).length >= CHAT_BURST;

/** Unexpired, not from a muted author, oldest first, at most CHAT_LIST_SIZE. */
export function visibleMessages<R extends { userId: string; at: number; expiresAt: number }>(rows: R[], now: number, muted: Set<string>): R[] {
  return rows
    .filter((r) => r.expiresAt > now && !muted.has(r.userId))
    .sort((a, b) => a.at - b.at)
    .slice(-CHAT_LIST_SIZE);
}
