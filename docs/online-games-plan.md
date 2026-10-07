# Online games and accounts: analysis and plan

## Why we need a service next to GitHub Pages
GitHub Pages only serves static files. It can host the app, but it cannot:
- store accounts
- verify a Google sign-in
- keep a shared game state between four browsers

Online Bela also has a hard requirement: **hidden information**. If a browser deals the cards, or the full game state sits where browsers can read it, any player can open DevTools and see every hand. The deck and the four hands must live on a server, and each player must only ever receive their own seat's view. The engine already has that projection, `viewFor(state, seat)` in `src/games/bela/view.ts`.

## Requirements
1. Google sign-in, plus an account and profile (name, avatar).
2. 4-seat online tables: invite friends by link, and empty seats are filled by bots.
3. The server holds the game. It runs our existing TypeScript engine (`apply`, `legalActions`, `viewFor`) so rules aren't written twice.
4. Free at hobby scale, with no credit card.
5. The frontend stays on GitHub Pages.

## Options compared
Free-tier figures are from public pricing pages and guides as of autumn 2026. Verify them before committing.

| | **Convex** | Firebase only | Firebase Auth + Cloudflare Durable Objects | Supabase |
|---|---|---|---|---|
| Google sign-in | Convex Auth + a Google OAuth client | Built in, one toggle | Firebase Auth | Built in + a Google OAuth client |
| Server-side game logic | **TypeScript mutations, free** | Needs Cloud Functions (Blaze plan, card on file) | TypeScript Durable Object per table | Edge Functions (Deno), 500k/month |
| Hidden hands safe? | **Yes**, a query returns only `viewFor` | Not without paid Functions | Yes | Yes, with Edge Functions + row-level security |
| Realtime updates | **Automatic** (reactive queries push changes) | Firestore listeners | Hand-written WebSocket protocol | Realtime channels |
| Bots / trick delays | Scheduled functions | Functions (paid) | Alarms | Cron/functions, awkward |
| Free tier | ~1M function calls/month, 0.5 GB | 50k reads/20k writes per day | 100k requests/day, 5 GB | 500 MB DB; **pauses after 7 days idle** |
| Vendors to manage | **1** | 1 | 2 | 1 |
| Code we write | Least | Little, but cheatable | Most (sockets, reconnects, token checks) | Medium |

### Estimated cost per match (Convex)
- One hand is about 45 actions: trump calls, 32 plays and 8 collects.
- Each action is one mutation, plus about four reactive view refreshes (one per player): about 225 calls per hand.
- A match of about 10 hands is about 2,300 calls.
- The free tier therefore covers roughly **400 full online matches a month**. Local games against bots cost nothing, since they never touch the server.

## Recommendation: Convex
- It is the only option where the engine runs **server-side, for free, in the same TypeScript, with one vendor**.
- The engine's existing shape maps straight onto it:
  - `apply` and `legalActions` become a mutation
  - `viewFor` becomes the query each player subscribes to
  - `autoAction` and the bots become scheduled functions
- Reactive queries mean no WebSocket code to write.
- The trade-off: Google sign-in needs a one-time Google Cloud OAuth client setup. With Firebase it's a toggle, but Firebase can't keep hands hidden without the paid plan.

**Runner-up:** Firebase Auth + Cloudflare Durable Objects. It's equally cheat-proof, with more headroom per day, but it means two dashboards and about twice the code.

## Architecture (Convex)
```
GitHub Pages (React app)                 Convex (server)
───────────────────────                  ──────────────────────────────
useQuery(tables.myView, {tableId}) ────▶ query: load state, find caller's seat,
   ↑ pushed on every change               return viewFor(state, seat)
useMutation(tables.act)            ────▶ mutation: check identity → seat,
                                          legalActions check, apply(), save,
                                          schedule bots / trick collection
Google sign-in (Convex Auth)       ────▶ users, accounts
```
Data model:
- `users`: name, avatar, stats
- `tables`:
  - code, options, status (`lobby | playing | finished`)
  - seats: an array of 4, each `{ userId } | { bot: true }`
  - `state`: the full `BelaState`, server only
  - timestamps
- `history`: finished matches per user, for stats

The full state is never returned to a client. Only `viewFor` output is.

## Phases
1. **Accounts.** Set up the Convex project and Convex Auth with Google. The menu's "Prijava" item works; the menu shows the name and avatar; sign-out works. Local play keeps working without an account.
2. **Lobby.** "Igraj online":
   - create a table and share its link or code
   - friends join seats; the host fills empty seats with bots and starts
3. **Server game.** `tables.act` and `tables.myView` run the engine. Bots and trick collection use the scheduler. The table UI reads from the server instead of local state; the existing `useGame` gets a second, online adapter.
4. **Robustness:**
   - reconnecting restores the seat
   - a player who leaves is replaced by a bot
   - an optional turn timer
   - rematch
5. **Profile and stats.** Games played, win rate, recent matches.
6. **Later:** matchmaking with strangers, quick chat/emotes, the other games (Briškula, Trešeta) on the same tables.

## What you'll need to do
These steps are one-time and need your accounts, so I can't do them:
1. Create a free Convex account (sign in with GitHub) and project. Send me the deployment URL; it's public and safe to share.
2. In Google Cloud Console, create an OAuth client (Web). Add the Convex callback URL it shows as a redirect URI, and put the client ID and secret into the Convex dashboard's environment variables. They never go in the repo.
3. Add a `CONVEX_DEPLOY_KEY` secret in GitHub, so the Pages workflow also deploys the server functions.

## Testing approach
- The engine rules are already covered by its unit tests.
- The server functions get tests with `convex-test`:
  - a seat can only act on its own turn
  - no query ever returns another seat's cards
  - bots fill and play empty seats
- The browser flow is checked with Playwright, using two browser contexts at one table.

## Open questions
- Display names: Google name by default, editable?
- Should signed-in players' local games against bots also count toward stats?
- Private tables only (invite link) at first, or also a public lobby?
