# Bela (Croatian Belot) – rules implemented

Engine: `src/games/bela/`. All numbers below live in `src/games/bela/rules.ts`.

## Setup
- 32 cards: 7 8 9 10 J Q K A × ♥ ♦ ♣ ♠. 4 players, 2 partnerships (seats 0+2 vs 1+3).
- Play direction counter-clockwise by default (option: clockwise).

## Deal and trump
1. 6 cards each, then 2 face-down talon cards each.
2. From the player after the dealer, each player calls a suit or passes. The dealer cannot pass (*mus*).
3. The talon is added to every hand (8 cards each).

## Card order and points
| Trump | J | 9 | A | 10 | K | Q | 8 | 7 |
|---|---|---|---|---|---|---|---|---|
| points | 20 | 14 | 11 | 10 | 4 | 3 | 0 | 0 |

| Plain | A | 10 | K | Q | J | 9 | 8 | 7 |
|---|---|---|---|---|---|---|---|---|
| points | 11 | 10 | 4 | 3 | 2 | 0 | 0 | 0 |

Last trick +10 → 162 per hand.

## Play obligations (`legal.ts`)
- Follow suit; if the trick is still won by the led suit, you must beat it when you can.
- Void in led suit → must trump; if already trumped, must overtrump when possible.
- Otherwise any card.

## Declarations (`declarations.ts`)
- Sequences (order 7 8 9 10 J Q K A): 3 = 20, 4 = 50, 5–7 = 100; 8 = **belot** (wins the match).
- Four of a kind: J 200, 9 150, A/10/K/Q 100.
- Best single declaration decides which team scores; ties broken by value → length → top card → trump suit → play order (first after dealer wins).
- That team scores all its declarations; declarations are revealed after trick 1. All declarations are made automatically.
- **Bela** (trump K+Q in one hand): 20, announced automatically when the second is played.

## Scoring (`scoring.ts`)
- Caller team total = card points + declarations + bela.
- More than half of the combined total → each team scores its own total.
- Less than half → **pad**: opponents score the combined total.
- Exactly half → **visi**: opponents score their part, callers' part is held and awarded to the winner of the next decided hand.
- **Štiglja** (all 8 tricks): +90.
- Match target 1001 (501/701 optional). If both teams pass the target, the higher wins; on a tie play continues.
