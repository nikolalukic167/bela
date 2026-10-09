// Display-name rules (architecture §9.3, §9.4): length and characters, an offensive-name
// filter, and the rename rate limit. Pure, so it is unit-tested without Convex.
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH, RENAME_LIMIT, RENAME_WINDOW_MS } from './config';
import { TableError } from './errors';

/** 2–24 chars, no control characters. Used for every user-chosen name. */
export function cleanName(raw: unknown, min = MIN_NAME_LENGTH, max = MAX_NAME_LENGTH): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  // eslint-disable-next-line no-control-regex
  if (name.length < min || name.length > max || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new TableError('INVALID_INPUT');
  }
  return name;
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e' };

/**
 * Letters only, lowercase, without diacritics (đ → d), leetspeak undone, separators dropped:
 * "K.u.r@c", "kur4c" and "KURAC" all become "kurac".
 */
export function normalizeForFilter(raw: string, collapse = true): string {
  const letters = [...raw.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')]
    .map((c) => LEET[c] ?? c)
    .filter((c) => /[a-z]/.test(c))
    .join('');
  // "fuuuck" → "fuck"; done last so leetspeak like "sh11t" collapses too.
  return collapse ? letters.replace(/(.)\1+/g, '$1') : letters;
}

/**
 * Roots, matched anywhere in the normalised name. Kept short on purpose: whole words people
 * use to insult, slurs and hate symbols in Croatian and English. Too-short or common roots
 * ("ass", "cock", "nazi" ⊂ Nazif) are left out to avoid blocking real names.
 */
const BLOCKED = {
  hr: [
    'kurac', 'kurc', 'picka', 'picku', 'pizd', 'jeb', 'kurva', 'kurve', 'drolj', 'govno', 'sranje', 'seronj',
    'supak', 'peder', 'debil', 'kreten', 'ustasa', 'ustase', 'cetnik', 'zadomspremni', 'pickamaterin',
  ],
  en: [
    'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'asshole', 'retard', 'rapist',
    'hitler', 'siegheil', 'kike', 'wanker', 'twat', 'dickhead', 'cocksucker', 'paedo', 'pedofil', 'pedophil',
  ],
};
/** Real names and words that contain a blocked root. */
const ALLOWED = ['pedersen', 'pederson', 'scunthorpe', 'shitake', 'kikeri'];

// Roots with a doubled letter ("nigger") are matched before collapsing only: collapsed, they
// would also match innocent words ("niger").
const ROOTS = [...BLOCKED.hr, ...BLOCKED.en].map((root) => ({ root, raw: /(.)\1/.test(root) }));

export function isOffensive(name: string): boolean {
  const strip = (s: string) => ALLOWED.reduce((acc, ok) => acc.split(ok).join(''), s);
  const raw = strip(normalizeForFilter(name, false));
  const collapsed = strip(normalizeForFilter(name, true));
  return ROOTS.some(({ root, raw: rawOnly }) => (rawOnly ? raw.includes(root) : collapsed.includes(root) || raw.includes(root)));
}

/** Every name a person picks (guest, sign-up, rename) goes through here. */
export function acceptName(raw: unknown): string {
  const name = cleanName(raw);
  if (isOffensive(name)) throw new TableError('NAME_NOT_ALLOWED');
  return name;
}

/** At most RENAME_LIMIT renames per RENAME_WINDOW_MS; `times` are the recent renames. */
export function renameCheck(times: number[], now: number): { ok: true; times: number[] } | { ok: false } {
  const recent = times.filter((at) => at > now - RENAME_WINDOW_MS);
  return recent.length >= RENAME_LIMIT ? { ok: false } : { ok: true, times: [...recent, now] };
}
