export const DECK_IDS = ['hungarian', 'french'] as const;
export type DeckId = (typeof DECK_IDS)[number];

/** Mađarice: the deck most Croatian bela players grew up with. French cards stay one tap away in the menu. */
export const DEFAULT_DECK: DeckId = 'hungarian';
