# Player ratings

Code: `src/ratings/ratings.ts` (game-agnostic) and `src/games/bela/ratedMatch.ts` (Bela adapter).
It uses [OpenSkill](https://www.npmjs.com/package/openskill) (Weng-Lin, Plackett-Luce model, MIT), which is built for teams: each player keeps their own rating even though Bela is played 2v2.

## Model
- Each player has `mu` (skill) and `sigma` (uncertainty). New players move fast and veterans stabilise, with no K-factor to tune.
- **Display rating** is `mu - 3·sigma` (`displayRating`). A new player shows 0, and one lucky streak can't top the leaderboard.
- **Provisional** until 30 rated matches, because Bela has a lot of luck.
- **Whole matches only** (to 501/701/1001) are rated, never single hands. Partners are seats 0+2 and 1+3.

## Data
Matches are the source of truth. Ratings are derived from them.
- `MatchRecord`: id, playedAt, teams, final scores, winner, `rated`, optional `abandonedBy`. Records are append-only.
- `replay(matches)` rebuilds every rating from the history and also returns a per-player history (for progress graphs), skipped matches with reasons, and pre-match predictions. If the algorithm or config changes, run `replay` again.
- Online, this runs **on the server only** (`convex/ratings.ts`): each finished rated match is rated incrementally with `rateMatch` in the same mutation that records the game, and `replay` can rebuild everything from the `games` table. Clients only display results.

## Rules
| Rule | Default | Why |
|---|---|---|
| `rated: false` | - | Casual games count for partner stats but not ratings |
| `abandonedBy` | - | The leaver's team loses. Online, only the leaver's rating takes the loss; their partner's is left unchanged |
| Quartet cap | 3 rated matches per 24 h for the same four players (any seating) | Blunts win-trading between friends |
| Inactivity | after 30 idle days, sigma grows by 0.1/day in quadrature, capped at a new player's | Returning players re-adjust quickly |

## Predictions and matchmaking
- `predictMatch` uses the same logistic (Plackett-Luce) likelihood the ratings are fitted with. openskill's own `predictWin` uses a normal CDF, which is steeper. In the simulated league it called 85% favourites that actually won 67% of the time, so we don't use it.
- `balanceTeams` picks the split of four players closest to 50/50, which is usually strongest + weakest vs the middle two.
- `partnerStats` reports games and wins per partnership.
- `calibration(replay(...).predictions)` answers "do 70% favourites win about 70%?". Run it once there are a few hundred real matches to decide whether tuning is needed.

## Tests
`src/ratings/ratings.test.ts` includes a simulated league: 16 players with hidden skill and noisy outcomes play 2,500 matches. The test checks that the ratings recover the true order (Spearman > 0.85) and that predictions stay within 8 points of actual win rates.
