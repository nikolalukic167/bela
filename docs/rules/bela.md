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
- House rules (new-game options, defaults first):
  - *Bela always counts* (off): when on, a failed caller still writes its own bela; opponents get the rest.
  - *Exact tie* (hangs): `hangs` = visi as above; `fails` = the tie is a pad.
- Match target 1001 (501/701 optional). If both teams pass the target, the higher wins; on a tie play continues.

## 3- and 2-player modes (spec, not implemented yet)

The engine has a seat count (`BelaOptions.players`, default 4) but refuses 2 and 3 players until the open questions below are settled. Evidence, quotes and sources are in [research-bela-2-3-players.md](research-bela-2-3-players.md). Source tags like [S1] refer to it. Rules marked **proposed** follow the majority of sources and still need a decision.

### Bela utroje (3 players)
- **Deck:** all 32 cards in play; hand total 162 + declarations + bela. [S1][S8][S9]
- **Deal:** 3 + 3 cards in hand, then 4 talon cards each. The 2 leftover cards go to the player on the dealer's right. [S1][S8][S9][S10]
- **Trump:** the player on the dealer's right **must** call from his first 6 cards; nobody passes. [S1][S8][S9][S10]
  - Variant (pass allowed, dealer forced, the 2 extra cards go to whoever calls): [S6][S7].
- **Talon and discard:** after the call everyone picks up their talon; the caller picks up 6 (4 + the 2 extra). The caller then discards 2 cards face down into his own tricks; their points count for him. Everyone plays 10 cards, so there are 10 tricks. [S1][S8][S10]
- **Sides:** for the hand, the caller plays alone against the other two, who form a temporary pair. Points are still written per player. [S1][S8][S9]
- **Play obligations:** the same as 4 players (follow, beat, trump, overtrump). There is no exemption for the temporary partner. [S1][S12]
- **Passing:** the caller needs **more** than the other two together. Then each player writes his own trick points, declarations and bela. [S1][S8][S9]
- **Pad:** the caller writes "–" and his points go to **nobody**. Each opponent writes only his own points. [S1][S8][S9]
  - Variants: the higher opponent takes the caller's points [S6][S12], or both opponents do [S12].
- **Exact tie (proposed):** a pad. No source mentions visi for 3 players; the wording is "more than".
- **Declarations (proposed, single source [S8]):** the two opponents count as one side when deciding which side's best declaration wins. Each player on the winning side writes only his own declarations, and only if he took at least one trick.
- **Bela:** 20 for whoever holds trump K+Q, as in the 4-player game.
- **Target:** 701 [S1][S5][S8][S9]. [S10] alone says 501.

### Bela udvoje (2 players, closed)
- **Deck and deal:** the 32 cards are shuffled. Each player gets 3 + 3 cards (non-dealer first), the next card is turned face up, then 4 talon cards each. The remaining 11 cards are out of play. That leaves 20 cards and 10 tricks, so the hand total varies from hand to hand. [S1][S8][S9][S11]
- **Trump calling:**
  - Round 1 is on the turned-up suit: the non-dealer accepts or passes, then the dealer does the same.
  - Round 2: the non-dealer may name another suit or pass. The dealer then **must** name one of the three other suits.
  
  [S1][S8][S9]
- **Seven swap:** a player holding the 7 of the trump suit among his first 6 cards may exchange it for the turned-up card. [S1][S5][S8]
- **Declarations:** the player with the best declaration writes all of his; the other writes none. Bela counts separately. [S8]
- **Passing and pad:** the caller passes with **more** points than the opponent. Otherwise (a tie included) the opponent writes everything. [S1][S8][S9]
- **Last trick and štiglja:** last trick +10, štiglja +90. [S1]
- **Target:** 501. [S1][S5][S8][S9][S10]
- **Open belot** (16 cards each, laid out in rows) is a different game. It is out of scope.

### Open questions (need a decision before implementing)
1. **3p pad:** do the caller's points vanish (main Croatian rule, proposed default), or go to the higher opponent, or to both? Make it an option?
2. **3p calling:** forced first player (main rule), or passing with the dealer forced (variant)?
3. **3p discard:** may the caller discard trumps or cards that form a declaration? No rules source says.
4. **3p declarations:** adopt [S8]'s rule (opponents count as one side, each writes only his own)?
5. **3p štiglja:** does +90 apply when the two opponents together take every trick, and who gets it?
6. **Ties in 2p and 3p:** treat an exact tie as a pad (proposed), with no visi?
7. **End of match in 3p:** two players can pass 701 in the same hand. Keep the engine's play-it-out rule ("na prolaz", higher total wins) or allow claiming mid-hand ("na dosta")? What happens on an exact tie between two players?
8. **2p seven swap:** only when the turned-up suit becomes trump ([S8]), or for any trump ([S1] is not explicit)?
9. **2p undealt stack:** face up (every card visible, [S8]) or only its bottom card ([S9])? This changes what the bots may know.
10. **2p unconfirmed declaration:** [S8] says it "is awarded to your opponent". Does the declaration transfer, or does the opponent just take everything through the štiglja/pad?

Implementation plan once these are settled:
- Add mode-specific deal and talon layouts and scoring for "solo vs pair" (3p) and "one vs one" (2p) behind `players`. Per-player scores replace the two team scores when `players` is 3.
- Add `positions` for 2 and 3 seats in the table UI.
- Teach the simple bot first. The advanced bots assume fixed partnerships.
- Offer local play against bots first, then online.
