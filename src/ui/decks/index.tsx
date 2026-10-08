import { SUIT_SYMBOL, type Card as CardT, type Suit } from '../../core/cards';
import { useDeck } from '../settings';
import { CardBack, FrenchFace } from './french';
import { Emblem, HungarianFace } from './hungarian';
import type { DeckId } from './ids';

export { DECK_IDS, type DeckId } from './ids';

interface Deck {
  Face: (p: { card: CardT }) => React.JSX.Element;
}

export const DECKS: Record<DeckId, Deck> = {
  french: { Face: FrenchFace },
  hungarian: { Face: HungarianFace },
};

export { CardBack };

/** A suit as text: the usual glyph, or the Hungarian emblem for players using that deck. */
export function SuitMark({ suit }: { suit: Suit }) {
  const deck = useDeck();
  if (deck === 'hungarian') return <Emblem suit={suit} className="inline-block h-[1em] w-[1em] align-[-0.12em]" />;
  return <>{SUIT_SYMBOL[suit]}</>;
}

/** Small A of hearts in the given deck, for the picker. */
export function DeckPreview({ id }: { id: DeckId }) {
  const { Face } = DECKS[id];
  return (
    <span className="block w-9 drop-shadow" aria-hidden="true">
      <Face card={{ suit: 'hearts', rank: 'A' }} />
    </span>
  );
}
