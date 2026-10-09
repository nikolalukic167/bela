import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../../../scripts/cards/build-hungarian-deck.mjs';
import { buildDeck as build32, RANKS_32 } from '../../core/cards';
import { STRINGS } from '../../i18n/strings';
import { DECK_IDS, DECKS } from './index';
import { hungarianCardUrl } from './hungarian';

describe('decks', () => {
  const cards = build32(RANKS_32);
  for (const id of DECK_IDS) {
    it(`${id}: draws all 32 cards, each one different`, () => {
      const { Face } = DECKS[id];
      const svgs = cards.map((card) => renderToStaticMarkup(<Face card={card} />));
      expect(cards).toHaveLength(32);
      expect(new Set(svgs).size).toBe(32);
      for (const svg of svgs) expect(svg).toMatch(/^<svg viewBox="0 0 60 84"/);
    });

    it(`${id}: names every rank and suit in both languages`, () => {
      const deck = DECKS[id];
      for (const card of cards) expect(deck.rankLabel(card.rank)).toMatch(/^(7|8|9|10|[A-Z])$/);
      for (const lang of ['hr', 'en'] as const) {
        const names = ['hearts', 'diamonds', 'clubs', 'spades'].map((s) => STRINGS[lang][deck.suitKey(s as never)]);
        expect(new Set(names).size).toBe(4);
      }
    });
  }

  it('hungarian: every card has its own art file', () => {
    expect(new Set(cards.map(hungarianCardUrl)).size).toBe(32);
  });

  it('hungarian: the committed SVGs are exactly what scripts/cards/build-hungarian-deck.mjs generates', () => {
    const dir = join(__dirname, 'hungarian');
    const { files, emblems } = buildDeck();
    expect(readdirSync(join(dir, 'cards')).sort()).toEqual(Object.keys(files).map((f) => `${f}.svg`).sort());
    for (const [name, svg] of Object.entries(files)) expect(readFileSync(join(dir, 'cards', `${name}.svg`), 'utf8'), name).toBe(svg);
    for (const [name, svg] of Object.entries(emblems)) expect(readFileSync(join(dir, 'emblems', `${name}.svg`), 'utf8'), name).toBe(svg);
  });
});
