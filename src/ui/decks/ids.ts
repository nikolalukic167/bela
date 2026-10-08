export const DECK_IDS = ['french', 'hungarian'] as const;
export type DeckId = (typeof DECK_IDS)[number];
