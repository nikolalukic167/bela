import { STRINGS, type StringKey } from '../i18n/strings';

/** Maps a ConvexError `{ code }` from the server to a translation key. */
export function errorKey(e: unknown): StringKey {
  const code = (e as { data?: { code?: unknown } } | null)?.data?.code;
  const key = `err.${String(code)}`;
  return key in STRINGS.hr ? (key as StringKey) : 'err.generic';
}
