import { describe, expect, it } from 'vitest';
import { acceptName, isOffensive, normalizeForFilter, renameCheck } from '../../convex/lib/names';
import { RENAME_LIMIT, RENAME_WINDOW_MS } from '../../convex/lib/config';

const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code ?? 'threw';
  }
};

describe('normalizeForFilter', () => {
  it('lowercases, strips diacritics and đ, undoes leetspeak and drops separators', () => {
    expect(normalizeForFilter('Pička')).toBe('picka');
    expect(normalizeForFilter('Đuro')).toBe('duro');
    expect(normalizeForFilter('5H1T')).toBe('shit');
    expect(normalizeForFilter('f.u-c_k')).toBe('fuck');
    expect(normalizeForFilter('k u r @ c')).toBe('kurac');
  });

  it('collapses repeated letters so stretching a word does not hide it', () => {
    expect(normalizeForFilter('fuuuuck')).toBe('fuck');
  });
});

describe('isOffensive', () => {
  it.each(['fuck', 'FuCk3r', 'sh1t', 'b!tch', 'Kurac', 'kur4c', 'Pička', 'p1zda', 'jebem ti', 'Govno', 'peder', 'k.u.r.v.a', 'Hitler', 'n1gger', 'cunt'])(
    'rejects %s',
    (name) => expect(isOffensive(name)).toBe(true),
  );

  it.each(['Ana', 'Marko', 'Đurđa', 'Šime', 'Ivana', 'Luka 1001', 'Petra', 'Josip', 'Bela majstor', 'Glasshouse', 'Classic', 'Hancock'])(
    'accepts %s',
    (name) => expect(isOffensive(name)).toBe(false),
  );
});

describe('acceptName', () => {
  it('trims and returns an acceptable name', () => {
    expect(acceptName('  Ana   Marija ')).toBe('Ana Marija');
  });

  it('rejects length and control characters with INVALID_INPUT', () => {
    expect(code(() => acceptName('A'))).toBe('INVALID_INPUT');
    expect(code(() => acceptName('x'.repeat(25)))).toBe('INVALID_INPUT');
    expect(code(() => acceptName('An\u0007a'))).toBe('INVALID_INPUT');
  });

  it('rejects offensive names with NAME_NOT_ALLOWED', () => {
    expect(code(() => acceptName('Kurac'))).toBe('NAME_NOT_ALLOWED');
  });
});

describe('renameCheck', () => {
  const now = 10 * RENAME_WINDOW_MS;

  it(`allows ${RENAME_LIMIT} renames per window and drops old ones`, () => {
    let times: number[] = [];
    for (let i = 0; i < RENAME_LIMIT; i++) {
      const r = renameCheck(times, now + i);
      expect(r.ok).toBe(true);
      times = r.ok ? r.times : times;
    }
    expect(renameCheck(times, now + RENAME_LIMIT).ok).toBe(false);
    const later = renameCheck(times, now + RENAME_WINDOW_MS + RENAME_LIMIT);
    expect(later.ok).toBe(true);
    expect(later.ok && later.times).toEqual([now + RENAME_WINDOW_MS + RENAME_LIMIT]);
  });
});
