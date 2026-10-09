export const SUITS: readonly string[];
export const RANKS: readonly string[];
/** Card and emblem SVG sources, keyed by file name without extension. */
export function buildDeck(): { files: Record<string, string>; emblems: Record<string, string> };
