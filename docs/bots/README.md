# Bela bots – code guide

Code: `src/games/bela/bots/`. Results and conclusions: [report.md](report.md).

Every bot is a function `(view: SeatView, rng) => BelaAction`. A `SeatView` holds only the seat's own
hand and public information (played cards, who played them, shown declarations, the bidding), so bots
cannot see hidden cards. The type system enforces this rule: there is no path from a bot to `BelaState`.

## Levels

| Level | File | Idea |
|---|---|---|
| 0 random | `index.ts` | Random legal action. Sanity baseline. |
| 1 heuristic | `../bot.ts` | Hand-tuned bidding (`trumpScore`) and play rules. |
| 2 tracker | `tracker.ts`, `knowledge.ts` | Level 1 rules, decided with card tracking, inference, and sampled probabilities. |
| 3 PIMC | `pimc.ts`, `solver.ts`, `sampler.ts` | Sample consistent deals, solve each one with all cards visible, play the best card on average. |
| 4 ISMCTS | `ismcts.ts` | One search tree over the information set, with a fresh determinization each iteration. |
| bidding | `bidding.ts`, `bidding-model.ts` | Heuristic or learned (regression on 320k simulated hands) trump calling, match-aware threshold. |

Players choose a difficulty in the new-game dialog (`BelaOptions.botLevel`):

| Difficulty | Bot |
|---|---|
| Easy | Level 1 with a 30% chance per card of a random legal play |
| Medium | Level 1 (the original bot, and the default) |
| Hard | Level 2 with learned bidding |
| Expert | Level 3 PIMC with learned bidding, at most 700 ms per card |

## Building blocks

- **`fast.ts`**: cards as indexes 0–31, hands as 32-bit masks, plus per-trump lookup tables. `legalMask`
  mirrors `legal.ts` exactly.
- **`knowledge.ts`**: Level 2 inference. One exact rule covers all play obligations. If a seat played
  card *x*, it could not have held any card *c* for which {x, c} would have made *x* illegal. That one
  rule covers voids, "no trumps left", "no higher trump", and "no higher card in the led suit". Shown
  declarations pin cards to seats.
- **`sampler.ts`**: deals the unseen cards to the other seats. It respects card counts and everything
  `knowledge.ts` inferred, placing the most constrained cards first.
- **`solver.ts`**: perfect-information alpha-beta for the rest of the hand. It uses a transposition
  table at trick boundaries and treats equal-value adjacent cards as one move. Its value is team 0's
  remaining card points (±90 for štiglja). That value is monotone in the final hand score, so pad and
  visi can be applied afterwards (`outcome.ts`). Speed is about 1.5M nodes/s: a 6-card position takes
  about 13 ms and a full 8-card hand about 300 ms.
- **`policy.ts`**: a fast heuristic for playouts (used by PIMC early in the hand, and by ISMCTS).
- **`outcome.ts`**: maps a searched result to the score the hand actually writes, using the real
  `scoreHand`. It includes declarations (sampled ones before they are shown), bela, pad, visi, and an
  optional match-win bonus.
- **`arena.ts`**: headless play. Hands are played in duplicate: each deal is played twice with the
  teams swapped, so card luck cancels out.

## Running experiments

```bash
# One duplicate tournament (shards across all CPU cores), appended to docs/bots/results/<name>.json
npx vite-node scripts/bots/tourney.ts <name> hands   <deals>   <botA> <botB> [<botA> <botB> ...]
npx vite-node scripts/bots/tourney.ts <name> matches <matches> <botA> <botB>

# OpenSkill ladder from match results
npx vite-node scripts/bots/rate.ts docs/bots/results/ladder.json

# Refit the learned bidding model (about 75 s)
npx vite-node scripts/bots/learn-bidding.ts [deals=20000] [threshold=10]
```

Bot specs (see `makeBot` in `index.ts`): `random`, `heuristic`, `tracker`, `pimc`, `ismcts`, with
options after a colon. For example: `pimc:samples=20,exact=5`, `tracker:bid=learned,risk=0.5`,
`tracker:off=safeWin+drawTrumps`, `heuristic:mistakes=0.2`, `ismcts:iters=800`.

Hand results report `meanDiff`: the average per hand of (A's written score − B's), with its standard
error over deal pairs. Match results report A's win rate.
