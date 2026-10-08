# Bela bot research report

Branch `nikola/bot-research`, October 2026. Code guide: [README.md](README.md). Raw results: `results/*.json`.

## Summary

- **Strongest bots:** PIMC (Level 3) and ISMCTS (Level 4). They beat the original rule bot by about
  **19 points per hand**, roughly 300 points over a match to 1001. Head to head they are tied
  (ISMCTS +1.7 ± 4.0 at a third of the compute, and +0.0 ± 4.0 when given about the same compute).
  Cheap ISMCTS (800 iterations, about a fifth of the compute) is only slightly weaker than PIMC.
- **Card tracking (Level 2):** +3.8 per hand over Level 1, but only after it switched from "what is
  possible" to sampled probabilities. The first version *lost* 6.9 per hand.
- **Learned trump calling:** a regression on 320k simulated hands gives **+2.8 ± 0.3** per hand
  over the hand-tuned threshold on 20,000 fresh deal pairs (+3.0 on the tuning deals). It wins mostly
  by falling less often (17% vs 21%).
- **Difficulty levels:** the four levels shipped to players form a clean OpenSkill ladder:
  Easy < Medium < Hard < Expert.

## Method

- **Duplicate hands:** each deal is played twice with the partnerships swapped. The reported number
  is A's average written hand score minus B's, averaged over deal pairs. ± is one standard error;
  95% intervals are ±1.96 SE. Hands start from 0:0, so match-level effects play no part.
- **Matches:** full matches to 1001, alternating which bot sits at seats 0+2. ± is the binomial
  standard error.
- **No peeking:** every bot receives only a `SeatView` (own hand plus public information). This is
  enforced by the types.
- **Tuning seeds:** tuning and main results use seeds 1000+. The held-out section re-runs the final
  choices on fresh seeds (900000+).
- **Correctness tests:** `src/games/bela/bots/bots.test.ts` checks that:
  - inference never excludes the true holder of a card;
  - sampled deals are valid;
  - the solver equals brute-force minimax on endgames;
  - every bot and level finishes legal hands.

## Results

### 1. Ladder (points per hand vs Level 1 rule bot)

| Bot | vs | Points/hand | ± SE | Deal pairs |
|---|---|---:|---:|---:|
| Level 0 random | Level 1 | −76.95 | 1.18 | 4000 |
| Level 2 tracker | Level 1 | +3.76 | 0.63 | 3000 |
| Level 3 PIMC | Level 1 | +19.20 | 1.37 | 1000 |
| Level 3 PIMC | Level 2 | +19.42 | 1.41 | 1000 |
| Level 4 ISMCTS (3000 it.) | Level 2 | +21.01 | 2.05 | 500 |
| Level 4 ISMCTS (3000 it.) | PIMC | +1.65 | 2.02 | 500 |

### 2. Level 2: possibility vs probability (each feature alone on top of Level 1)

| Feature | Judged by possibility | Judged by sampled probability |
|---|---:|---:|
| Draw trumps while opponents may hold some | +1.63 ± 0.43 | (same) |
| Win only with a card later opponents can't beat | −1.70 ± 0.42 | **+2.34 ± 0.45** |
| Smear points on partner's safe trick | −2.26 ± 0.41 | −0.14 ± 0.34 |
| Lead into partner's void for a ruff | +0.02 ± 0.22 | – |
| Hold back side aces at ruff risk | **−9.83 ± 0.69** | −1.98 ± 0.61 |
| All together | −9.24 ± 0.75 | +2.24 ± 0.72 |
| All except "hold back aces" (final Level 2) | – | **+3.76 ± 0.63** |

The lesson is that most inferred threats are merely *possible*, and acting on every possible threat is
worse than ignoring them all. Sampling about 24 consistent deals and acting when the risk is at most 35%
turned the same ideas into gains. Cashing aces early pays even at some ruff risk, so that feature is off.

### 3. Bidding

Both sides play Level 2; only trump calling differs (vs the hand-tuned `trumpScore ≥ 6.0`).

| Calling rule | Points/hand | Calls | Own contracts fall |
|---|---:|---:|---:|
| heuristic ≥ 5.0 | −4.65 ± 0.86 | 66% | 25% |
| heuristic ≥ 5.5 | −1.39 ± 0.64 | 59% | 23% |
| heuristic ≥ 6.5 | +0.80 ± 0.64 | 43% | 19% |
| heuristic ≥ 7.0 | −0.08 ± 0.85 | 36% | 19% |
| learned ≥ −40 | −7.09 ± 1.02 | 73% | 27% |
| learned ≥ −20 | −2.44 ± 0.87 | 62% | 23% |
| learned ≥ 0 | +2.26 ± 0.80 | 50% | 20% |
| **learned ≥ +10** | **+3.15 ± 0.78** | 45% | 18% |
| learned ≥ +20 | +2.90 ± 0.83 | 40% | 18% |
| learned ≥ +30 | +1.61 ± 0.94 | 33% | 18% |
| learned ≥ +40 | −0.36 ± 1.02 | 30% | 18% |
| learned ≥ +10, refitted model | +3.01 ± 0.74 | 44% | 18% |

The learned model (`bidding-model.ts`) predicts the caller team's hand score difference from 16
features of the six visible cards. The trump J (+70), 9 (+45), A (+31), and holding three or more trumps
(+22) dominate. Speaking position barely matters (≤ 2 points). R² is 0.10: most of a hand's outcome
depends on cards the caller cannot see. The ranking, which is all the threshold needs, is still useful.

The sweep used a first fit of the model (from an earlier Level 2); the refitted model's row confirms the
chosen threshold. The heuristic's original threshold of 6.0 was already near its best.

**Match-aware threshold** (raise it when about to win, lower it when the opponents are about to win):
match win rate 52.2% ± 1.1 vs the same bot without it, over 2000 matches. That is mild evidence, about
2 SE. Learned vs heuristic bidding in full matches: 53.7% ± 1.1.

### 4. PIMC settings (all vs Level 2)

| Setting | Points/hand | Compute (s per 1000 deal pairs, 4 cores) |
|---|---:|---:|
| 40 samples, exact solve from 6 cards (default) | +19.42 ± 1.41 | 615 |
| 40 samples, exact from 4 cards | +18.06 ± 1.45 | 35 |
| 40 samples, playouts only | +16.95 ± 1.42 | 22 |
| 20 samples | +16.10 ± 1.45 | 295 |
| 10 samples | +13.08 ± 1.43 | 150 |
| without bidding evidence | +18.42 ± 1.38 | 611 |
| ISMCTS 3000 iterations | +21.01 ± 2.05 | 388 |
| ISMCTS 800 iterations | +19.45 ± 2.03 | 120 |

(ISMCTS runs used 500 pairs; compute is scaled to 1000.)

- **Sample count matters most:** 10 → 40 samples adds about 6 points.
- **Exact solving is expensive and helps a little:** exact solving from 6 cards instead of playouts
  adds about 2.5 points (within noise) for roughly 28× the compute.
- **Bidding evidence:** weighting deals by the bidding is worth about +1 (not significant).

**Why PIMC wins:** with identical bidding on both sides, callers facing PIMC fall 26.8% of the time,
while PIMC's own calls fall 16.2%. PIMC also takes 9.8 more card points per hand. The gain is mostly
in defence.

### 5. Difficulty calibration (mistake rate = chance of a random legal card)

| Mistake rate on Level 1 | Points/hand vs Level 1 |
|---|---:|
| 10% | −3.04 ± 0.49 |
| 20% | −6.99 ± 0.62 |
| 30% (Easy) | −10.10 ± 0.71 |
| 50% | −17.06 ± 0.80 |

The cost is close to linear: about 3.4 points per hand for every 10% of mistakes. This gives a smooth
dial for weaker levels.

### 6. OpenSkill ladder (full matches to 1001)

200 matches per pairing, 1,400 matches in all. Each bot is rated as one player, using the
`openskill` package with its default model, as in `src/ratings`. Ratings are averaged over 20 random
match orders.

| Level | Bot | μ | σ | Ordinal (μ − 3σ) |
|---|---|---:|---:|---:|
| Expert | `pimc:bid=learned` | 33.6 | 1.57 | 28.9 |
| Hard | `tracker:bid=learned` | 30.0 | 1.51 | 25.5 |
| Medium | `heuristic` | 28.6 | 1.59 | 23.9 |
| Easy | `heuristic:mistakes=0.3` | 25.8 | 1.64 | 20.9 |
| – | `random` | 1.3 | 2.93 | −7.4 |

Match win rates behind it:

| Matchup | Win rate |
|---|---|
| Expert vs Hard | 67.5% |
| Expert vs Medium | 67.5% |
| Hard vs Medium | 57.0% |
| Hard vs Easy | 64.0% |
| Medium vs Easy | 61.5% |
| Medium vs random | 98.0% |

### 7. Held-out check (fresh deals, never used for tuning)

| Claim | Tuning seeds | Fresh seeds | Pairs (fresh) |
|---|---:|---:|---:|
| Level 2 vs Level 1 | +3.76 ± 0.63 | +3.61 ± 0.61 | 3,000 |
| Learned vs hand-tuned bidding | +3.01 ± 0.74 | +0.98 ± 0.79 | 3,000 |
| (same, larger sample) | | **+2.76 ± 0.30** | 20,000 |
| Hand-tuned threshold 6.5 vs 6.0 | +0.80 ± 0.64 | +0.41 ± 0.25 | 20,000 |
| Expert vs Hard (both learned bidding) | – | +18.80 ± 2.03 | 500 |
| ISMCTS 800 it. vs PIMC | – | −3.57 ± 1.85 | 500 |
| **ISMCTS 9000 it. vs PIMC, roughly equal compute** | – | **+0.04 ± 2.01** | 400 |

- **Level 2 and PIMC replicate.** Their gains hold on fresh deals.
- **The first bidding re-check came in low.** It was 2.5 SE below the tuning estimate. A 20,000-pair
  re-run puts the true gain at **+2.8 ± 0.3**: real, and only slightly smaller than tuned. A small
  sample can mislead in either direction, so the large run is the number to trust.
- **Compute-matched, ISMCTS and PIMC are equal.** At 800 iterations ISMCTS is slightly weaker than
  PIMC (−3.6 ± 1.9) while using about a fifth of the compute.

## Shipped difficulty levels

| Level | Bot | Why |
|---|---|---|
| Easy | Level 1 with 30% random cards | −10 per hand: beatable, but still plays sensibly |
| Medium | Level 1 (unchanged default) | Same bot players already know |
| Hard | Level 2 with learned bidding | +3.8 from play and +3.0 from bidding (measured separately); wins 57% of matches vs Medium; cheap |
| Expert | PIMC with learned, match-aware bidding, ≤ 700 ms per card | Strongest bot measured with full-match data |

## Limitations

- **Only bot-vs-bot:** these are strengths against our own bots, never against strong human players.
  A bot can exploit another bot's habits.
- **Tuning bias:** thresholds were chosen on the seeds they are reported on. Section 7 re-checks the
  choices on fresh deals, and the effects hold (bidding shrinks slightly, from +3.0 to +2.8).
- **One rule set:** counter-clockwise play, 1001, default house rules.
- **Not compute-matched:** apart from the dedicated PIMC vs ISMCTS run (section 7), comparisons
  give the stronger bots far more time per move.
- **Not new methods:** PIMC (Ginsberg's GIB for bridge, 1999; Buro et al. for Skat, 2009) and ISMCTS
  (Cowling, Powley & Whitehouse, 2012) are established. This work applies and measures them for
  Croatian Bela.

## Next steps

- Use ISMCTS for Expert if browser speed becomes a problem: 3000 iterations matches PIMC for a
  third of the compute; 800 iterations is slightly weaker but five times cheaper.
- Run PIMC on the server for online games, as planned; offline play keeps a time budget.
- Level 5 (self-play reinforcement learning) is still a research project. The cheapest first step
  is a learned evaluation that replaces the playout policy inside ISMCTS.
- Play-test with human players and rate the bots with the same OpenSkill pipeline as people.
