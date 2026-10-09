import { describe, expect, it } from 'vitest';
import { QUICK_PHRASES } from '../../convex/lib/chatLogic';
import { STRINGS } from '../i18n/strings';
import { newArrivals } from './TableChat';

describe('quick phrases', () => {
  it('are translated in every language', () => {
    for (const lang of ['hr', 'en'] as const) {
      for (const p of QUICK_PHRASES) expect(STRINGS[lang], `${lang} phrase.${p}`).toHaveProperty(`phrase.${p}`);
    }
  });
});

describe('newArrivals', () => {
  it('ignores what was already there on first load, then reports only new ids', () => {
    const seen = new Set<string>();
    expect(newArrivals(seen, [{ id: 'a' }, { id: 'b' }], true)).toEqual([]);
    expect(newArrivals(seen, [{ id: 'a' }, { id: 'b' }, { id: 'c' }], false).map((m) => m.id)).toEqual(['c']);
    expect(newArrivals(seen, [{ id: 'b' }, { id: 'c' }], false)).toEqual([]);
  });
});
