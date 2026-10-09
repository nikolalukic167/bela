import { SUIT_SYMBOL, type Card as CardT, type Rank, type Suit } from '../../core/cards';
import { useI18n } from '../../i18n/i18n';
import type { StringKey } from '../../i18n/strings';
import { useDeck } from '../settings';
import { CardBack, FrenchFace } from './french';
import { Emblem, HUNGARIAN_RANK_LABEL, HungarianFace, preloadHungarian } from './hungarian';
import type { DeckId } from './ids';

export { DECK_IDS, DEFAULT_DECK, type DeckId } from './ids';

/** Everything that differs between decks: drawing, and how ranks and suits are named. Theme data, not UI branches. */
interface Deck {
  Face: (p: { card: CardT }) => React.JSX.Element;
  rankLabel: (r: Rank) => string;
  suitKey: (s: Suit) => StringKey;
  preload?: () => void;
}

export const DECKS: Record<DeckId, Deck> = {
  french: { Face: FrenchFace, rankLabel: (r) => r, suitKey: (s) => `suit.${s}` },
  hungarian: {
    Face: HungarianFace,
    rankLabel: (r) => HUNGARIAN_RANK_LABEL[r] ?? r,
    suitKey: (s) => `suitHu.${s}`,
    preload: preloadHungarian,
  },
};

export { CardBack };

/** A suit as text: the usual glyph, or the Hungarian emblem for players using that deck. */
export function SuitMark({ suit }: { suit: Suit }) {
  const deck = useDeck();
  if (deck === 'hungarian') return <Emblem suit={suit} className="inline-block h-[1em] w-[1em] align-[-0.12em]" />;
  return <>{SUIT_SYMBOL[suit]}</>;
}

/** Rank, suit and card names in the viewer's deck and language ("O Srce", "Q Herc", "Queen of Hearts"…). */
export function useCardNames() {
  const { t } = useI18n();
  const deck = DECKS[useDeck()];
  const rank = deck.rankLabel;
  const suit = (s: Suit) => t(deck.suitKey(s));
  return { rank, suit, card: (c: CardT) => `${rank(c.rank)} ${suit(c.suit)}` };
}

/** Small ace of hearts in the given deck, for the picker. */
export function DeckPreview({ id }: { id: DeckId }) {
  const { Face } = DECKS[id];
  return (
    <span className="block w-9 drop-shadow" aria-hidden="true">
      <Face card={{ suit: 'hearts', rank: 'A' }} />
    </span>
  );
}
