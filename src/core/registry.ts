export interface GameInfo {
  id: string;
  name: string;
  players: string;
  available: boolean;
  descriptionKey: string;
}

/** Games listed on the home page. Add new games here. */
export const GAMES: GameInfo[] = [
  { id: 'bela', name: 'Bela', players: '4', available: true, descriptionKey: 'game.bela.desc' },
  { id: 'briskula', name: 'Briškula', players: '2–4', available: false, descriptionKey: 'game.briskula.desc' },
  { id: 'treseta', name: 'Trešeta', players: '2–4', available: false, descriptionKey: 'game.treseta.desc' },
];
