import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildDeck, RANKS_32 } from '../../core/cards';
import { DECK_IDS, DECKS } from './index';

describe('decks', () => {
  const cards = buildDeck(RANKS_32);
  for (const id of DECK_IDS) {
    it(`${id}: draws all 32 cards, each one different`, () => {
      const { Face } = DECKS[id];
      const svgs = cards.map((card) => renderToStaticMarkup(<Face card={card} />));
      expect(cards).toHaveLength(32);
      expect(new Set(svgs).size).toBe(32);
      for (const svg of svgs) expect(svg).toMatch(/^<svg viewBox="0 0 60 84"/);
    });
  }
});
