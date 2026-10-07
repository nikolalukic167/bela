import { describe, expect, it } from 'vitest';
import { legalCards, type Played } from './legal';
import { cards, ids } from './testkit';

const trickOf = (str: string): Played[] => cards(str).map((card, seat) => ({ seat, card }));

describe('legal plays', () => {
  it('must follow suit and beat if possible', () => {
    expect(ids(legalCards(cards('7h Ah 10h 9s'), trickOf('Kh'), 'spades'))).toEqual(['10h', 'Ah']);
  });
  it('may play any card of the suit when unable to beat', () => {
    expect(ids(legalCards(cards('7h 8h 9s'), trickOf('Ah'), 'spades'))).toEqual(['7h', '8h']);
  });
  it('must trump when void in led suit', () => {
    expect(ids(legalCards(cards('7s Js Ad'), trickOf('Ah'), 'spades'))).toEqual(['7s', 'Js']);
  });
  it('must overtrump when possible', () => {
    expect(ids(legalCards(cards('7s Js Ad'), trickOf('Ah 9s'), 'spades'))).toEqual(['Js']);
  });
  it('need not beat a trumped trick when following suit', () => {
    expect(ids(legalCards(cards('7h Ah'), trickOf('Kh 7s'), 'spades'))).toEqual(['7h', 'Ah']);
  });
  it('may discard anything when void in led suit and trumps', () => {
    expect(ids(legalCards(cards('7d Ac'), trickOf('Kh'), 'spades'))).toEqual(['7d', 'Ac']);
  });
  it('in trumps, the 9 beats the ace and J beats the 9', () => {
    expect(ids(legalCards(cards('9s Js 7s'), trickOf('As'), 'spades'))).toEqual(['9s', 'Js']);
  });
});
