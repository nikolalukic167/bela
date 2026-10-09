# Architecture

How Karte/Bela is built, in what order, and the rules the code must follow. It extends [online-games-plan.md](online-games-plan.md) (backend choice: Convex) and covers the whole product roadmap, not just the first online phase.

## 1. Principles

1. **Empty lobby is the biggest risk.** Build what lets four people play *today* (private tables, bots, reconnect) before anything that needs a crowd (public matchmaking, regional boards).
2. **The server is the only authority.** Clients send intents ("play this card"); the server validates, applies, and returns a per-seat projection. Nothing a client sends is trusted.
3. **One rules engine, written once.** The pure TypeScript engine runs in the browser (offline play, bots, tutorials) and on the server (online play). No second implementation, ever.
4. **Hidden information never leaves the server.** Full state, deck seed, other hands, and talon cards are server-only.
5. **Deep modules, small interfaces.** A module exposes few functions and hides a lot (see `codebase-design` skill). Seams exist where behaviour varies: game engine, persistence, identity, clock.
6. **Rated play is sacred.** Anything that can affect a rating (bots, unrated friendlies, abandoned games) is classified explicitly, in data, at game creation, never inferred later.

## 2. Priorities and phases

| # | Phase | Delivers | Depends on | Status |
|---|---|---|---|---|
| 1 | **Core game** | Accurate rules and scoring, bots, local play, i18n (hr/en), tutorial & legal-card hints | none | mostly done (`src/games/bela`) |
| 2 | **Accounts & private tables** | Sign-in without Google (guest name or username + password) and with Google, create table by link/code, seats, bots fill empty seats, reconnect, table options shown before joining | 1, Convex | **done** (see §15): accounts, private tables, server-side bots, admin tools, reconnect, turn timers, rematch, cleanup, e2e |
| 3 | **Ratings & leaderboard** | OpenSkill per player, `rating_history`, global board, rating graph, personal stats | 2 | **mostly done**: rated tables, `games`, ratings + history, public leaderboard, own rating graph; personal stats page open |
| 4 | **Social** | Friends, fixed pairs (own rating), head-to-head, regional boards (country/city/club field on profile) | 3 | |
| 5 | **Competitive** | Seasons/leagues, tournaments (round-robin, brackets), clubs, replays, achievements | 3, 4 | |
| 6 | **Extras** | Cosmetics, premium analytics, sponsored tournaments, other games (Briškula, Trešeta), physical-table scorekeeper | 3 | |

Rules for ordering:
- Reconnect handling and bots ship **with** phase 2, not after: they are what keeps a table alive when a friend drops.
- Match history (every action stored) ships with the first online game even though replays are phase 5; retrofitting it is much harder than storing it from day one.
- Public matchmaking is deliberately *not* on the list until private tables show real usage.

## 3. System overview

```
GitHub Pages (static React SPA)                Convex (the only backend)
────────────────────────────────               ───────────────────────────────────
pages/ UI  ── useGame (local adapter)          convex/
           └─ useOnlineGame (online adapter) ─▶   tables.ts   queries/mutations (thin)
                                                  tableService  orchestration (deep module)
src/core/  GameDefinition  ◀──── imported ────▶   src/core + src/games/* (same engine)
src/games/bela/  pure engine                      ratings.ts    OpenSkill, pure
                                                  scheduled fns bots, trick collect, timers
Convex Auth (guest / password / Google) ──────▶   users, auth tables
```

- Frontend is static and holds **no secrets**. The Convex URL and Google client ID are public by design.
- Convex is the single vendor for auth, database, realtime and scheduling. Reactive queries replace hand-written WebSockets.
- Local play (vs bots, tutorial) never touches the server: free, works offline, and survives backend outages.

## 4. Code layout

```
src/
  core/            game-agnostic: cards, rng, GameDefinition, registry. No React, no I/O.
  games/<id>/      one folder per game
    state.ts rules.ts legal.ts scoring.ts engine.ts view.ts bot.ts   pure, JSON in/out
    ui/                                                             React table for this game
  ratings/         OpenSkill wrapper, pure (shared by server and tests)
  ui/              shared components + game adapters (useGame, useOnlineGame)
  pages/           routes only; compose, don't contain logic
  account/         auth context and profile UI
  i18n/            strings (hr, en, ...); no literal user text in components
convex/
  schema.ts        single source of truth for stored data
  <domain>.ts      one file per domain: tables, users, admin, ratings (later), friends, tournaments
  lib/             auth guards (requireUser/requireAdmin), tableLogic (pure orchestration), config, error codes
tests/
  server/          pure tests of convex/lib (no Convex runtime)
  convex/          convex-test integration tests of the real functions (edge-runtime)
docs/              architecture, ADRs, rules/<game>.md (spec the engine is tested against)
```

Dependency rule (enforced by `no-restricted-imports` in `eslint.config.js`; `npm run lint`):

```
core  ←  games/*  ←  ui, pages          convex/ may import core + games + ratings
                                         core and games/*/(non-ui) never import React, Convex, DOM
```

## 5. Game engine contract

`GameDefinition<S, A, O, V>` in `src/core/game.ts` stays the seam. Requirements:

- **Pure and deterministic.** `apply(state, action)` returns a new state; randomness comes only from the seeded `Rng` created in `setup`. Same seed + same actions = same game. This gives free replays, dispute resolution, and bot-vs-bot regression tests.
- **Serialisable.** State and actions are plain JSON (no classes, `Date`, `Map`). They are stored as-is.
- **`legalActions` is the validator.** The server rejects any action that is not in `legalActions(state, seat)`; the UI uses the same list for hints.
- **`view(state, seat)` is the only thing a client ever receives.** It must exclude: other hands, unplayed talon cards, the deck seed, and the face-down state of anything not yet revealed. Declarations stay hidden until the rules reveal them.
- **Options are data** (`BelaOptions`: target, direction, `belaAlwaysCounts`, `tie`). New house rules extend this type, get a default that preserves current behaviour, and are covered in `docs/rules/bela.md` plus a scoring test. Options are frozen when the game starts and stored with the table, so a rule change can never alter a game in progress.
- **Modes** (2-, 3-, 4-player; 501/701/1001) are options + seat count on the same engine, not forks. Add `seats` to `GameDefinition` rather than hardcoding 4.
- **Action log.** Online tables store `{seed, options, actions[]}` append-only. State is a cache that can be rebuilt from the log; the log is the audit trail and the replay source.
- Ratings, stats, and achievements are computed from the **finished game record**, in separate modules. The engine knows nothing about them.

## 6. Data model (Convex)

Defined in `convex/schema.ts`; every field validated by `v.*`. Built so far: everything down to `ratingHistory`; the rest is the plan.

| Table | Key fields | Notes |
|---|---|---|
| `users` | auth fields, `isAnonymous` (guest), `isAdmin`, `isBot`, `isTest`, `renameTimes`, `deletedAt`, `nameKey` (indexed `by_name_key`); later `country`, `city`, `locale` | Our flags are optional so Convex Auth can create users. `isAdmin` is granted only from the Convex dashboard (§15). A deleted account is a stub `{name, deletedAt}` (§9.2). |
| `tables` | `code`, `codeExpiresAt`, `timerProfile`, `hostId`, `options`, `status` (lobby/playing/finished), `seats[]` (`{kind:'empty'}` \| `{kind:'user',userId,name}` \| `{kind:'bot',name,level}`), `isTest`, `speed` (live/fast), `result`, `createdAt` | `rated` arrives with ratings (phase 3); until then no game is rated. `isTest` tables are invisible to real users (§15). |
| `tableStates` | `tableId`, `state` (full engine state), `version` | **Server only**, never returned by any query. Separate table keeps it off accidental `ctx.db.get(table)` returns. `version` is bumped per action; scheduled steps carry the version they expect, so a stale one is a no-op. |
| `actions` | `tableId`, `seq`, `seat`, `action` | Append-only; `seq` = version before the action. Seed + options + actions rebuild a game. |
| `memberships` | `userId`, `tableId` | Index for "my tables" and the per-user table limit. |
| `presence` | `tableId`, `userId`, `lastSeen` | Last heartbeat per human at a running table. Separate from `tables` so heartbeats don't re-run every `watch` query. |
| `games` | `tableId`, `players` (user per seat, null for bots), `scores`, `winner`, `rated`, `endReason` (normal/abandoned), `abandonedBy`, `quartetKey`, `endedAt` | One row per finished non-test match, written with the rating update. |
| `ratings` | `userId`, `mu`, `sigma`, `gamesPlayed`, `lastPlayedAt`, `display` (mu − 3σ, indexed for the board) | OpenSkill, not a single Elo number. Solo scope only; pair ratings come with phase 4. |
| `ratingHistory` | `userId`, `gameId`, `mu`, `sigma`, `display`, `delta`, `at` | One point per player per rated game; feeds the rating graph. |
| `blocks`, `mutes` | `userId` + `blockedId` / `mutedId` | Block keeps both sides off each other's tables; mute is private to the muter (§9.4). |
| `reports` | `reporterId`, `reportedId`, `reason` (name/abuse/cheating/other), `tableCode`, `status`, `resolution` | Reviewed in `/admin`. Fixed reasons, no free text. |
| `moderationLog` | `actorId`, `action` (report/block/unblock/dismiss/resetName), `targetId`, `reportId`, `at` | Append-only. Ids only, no names. |
| `retiredCodes` | `code`, `tableId` | Invite codes the host replaced; resolve only for players seated at that table (§9.3). |
| `rateLimits` | `key`, `tokens`, `at` | Token buckets (`act:<table>:<user>`, `lookup:<user>`); idle ones are deleted daily. |
| `config` | `key`, `on` | Feature flags (§12); a missing row means on. |
| `usage` | `day`, `tables`, `actions`, `games` | Per-UTC-day counts from the quota-watch cron (§12). |
| `pairs` | `userA`, `userB` (ordered), `status`, rating via `ratings` | Both must accept. Planned. |
| `friendships`, `invites` | pair of users + status; code, expiry, uses | Invites expire and are single-purpose. Planned. |
| `leagues`, `tournaments`, `clubs` | later phases | Added with their phase, not before. |
| `stats` | per-user aggregates | Derived; rebuildable from `games` + `actions`. |

Indexing: every query path has an index (`by_code`, `by_user`, `by_table`, `by_table_seq`, `by_test`, `by_rating`). No unindexed `filter` on growing tables.

## 7. Server design (Convex functions)

- **Thin entry points, deep service.** `convex/tables.ts` holds `query`/`mutation` wrappers that do: authenticate → validate args → call a plain function in `tableService` → return. All game orchestration lives in `tableService` (plain TS taking a `ctx`-like port), so it can be unit-tested without Convex.
- **Act flow** (`tables.act`): resolve caller → seat from the table (never from args) → check it is that seat's turn → check `action ∈ legalActions` → `apply` → append to `actions` → bump `version` (optimistic concurrency; retry on conflict) → schedule next system step.
- **Scheduled functions** drive everything time-based: bot moves (with a small human-like delay), trick collection, turn timers, reconnect grace expiry, abandoned-table cleanup. All idempotent and version-checked: a stale timer is a no-op.
- **Bots** decide from `view(seat)` only, through the same `bot(v, rng)` used offline. Online tables offer easy / medium / hard: expert (PIMC, ~700 ms per move) would exceed Convex's mutation time limit, so it stays offline-only. A whole hard match costs about 75 ms of bot compute, so "fast" test tables play many moves per call. They are marked `{bot: true}` in seats and are excluded from rating updates (and make the game unrated).
- **Reconnect:** an open table page sends `tables.heartbeat` every 20 s (`HEARTBEAT_MS`). A disconnected seat keeps its place for 90 s (`RECONNECT_GRACE_MS`). One scheduled `checkPresence` per seat re-arms itself once per grace period (not per heartbeat, to save function calls); on expiry a bot **stands in** under the player's name (`seat.standInFor`) and the friendly game continues. The player's first heartbeat on return takes the seat back. If every human is away the table waits instead of playing on. Leaving makes the bot permanent. In a **rated** game there is no stand-in: leaving or dropping past the grace period ends the match as `abandoned`, the leaver's team loses, and only the leaver (not their partner) takes the rating loss. The grace period comes from the table's timer profile.
- **Turn timers:** while the table waits on a human, `scheduleNext` arms `tables.timeout` (version-checked). When the move time runs out, the server plays a medium bot's move for that seat, which they keep; an unclicked hand summary deals on by itself. `watch` returns the `deadline`; the page counts down the last 20 s.
- **Timer profiles** (§14.3): the host picks one at creation (`tables.create({ timerProfile })`); it is stored on the table, never changes, and a rematch keeps it. `timeoutFor` and the presence check read it (`TIMER_PROFILES` in `lib/config.ts`): **relaxed** 180 s grace / 90 s per move / 60 s summary, **normal** (default, the original) 90 / 45 / 30 s, **quick** 45 / 20 / 15 s.
- **Rematch:** `tables.rematch` on a finished table opens one lobby with the same seats and options (away players seated in person again); the old table stores `rematchCode`, so everyone lands at the same table.
- **Cleanup:** `crons.ts` runs `tables.cleanup` daily: deletes lobbies never started within 24 h and running tables every human has been away from for 24 h (`STALE_TABLE_MS`). Finished tables are history and stay.
- **Ratings:** a table is rated or not from creation (`tables.create({ rated })`). Rated tables need four different account holders: no bots, no guests (`ratedBlocker`). On game end the same mutation writes `games`, updates `ratings` and appends `ratingHistory` (`convex/ratings.ts` → pure `convex/lib/ratingLogic.ts` → `src/ratings/`). The quartet cap (3 rated games per 24 h for the same four) turns extra games unrated. The **per-opponent daily gain cap** (`DAILY_GAIN_CAP`, 4 display points in 24 h) stops win-trading with rotating partners: a winner gains at most the room left against the opponent they already took most from that day (the game still counts; the cut comes off `mu`, losses are untouched; `capGain`/`gainsByOpponent` in `ratingLogic.ts`). `ratings.leaderboard` is public and lists players with 10+ rated matches and an account at least 7 days old (`LEADERBOARD_MIN_AGE_MS`) by name only.
- **Rate limits:** token buckets in `rateLimits` (`lib/rateLimit.ts`). `tables.act` allows a burst of 10 moves per user per table, then one per 250 ms (`ACT_LIMIT`), and answers `RATE_LIMITED` beyond that; turn timers and bot steps are internal and never limited. Convex rolls back a failed mutation, so a move rejected for another reason (not your turn, illegal) returns its token: the bucket caps accepted moves, not attempts. The daily cleanup deletes buckets idle for a day.
- **Errors:** typed `ConvexError` codes (`NOT_YOUR_TURN`, `ILLEGAL_ACTION`, `TABLE_FULL`, `NOT_FOUND`, `RATE_LIMITED`, `NAME_NOT_ALLOWED`, `RENAME_TOO_SOON`, `BLOCKED`, `CODE_EXPIRED`, `FEATURE_OFF`, …); the client maps them to translated messages. Never leak internal state in an error.

## 8. Client design

- Two adapters behind one hook interface: `useGame` (local, runs the engine in the browser) and `useOnlineGame` (subscribes to `tables.myView`, sends `tables.act`). The table components consume `{view, legalActions, act}` and don't know which is in use.
- UI components are presentational; game logic stays in `games/*`. No rules in JSX.
- State: local React state + Convex reactive queries. No global store until a concrete need appears.
- Optimistic UI only for harmless things (selecting a card). Moves wait for the server.
- i18n: every string through `i18n`; Croatian and English required for every new feature; plural/format helpers, no concatenated sentences. Card deck styles (French, Hungarian, Dalmatian-style) are theme data, not branches in components.
- Accessibility: keyboard play, visible focus, not colour-only suit cues, `prefers-reduced-motion` respected.
- Chat during rated play: **emotes/quick phrases only**, no free text (partners must not share hands). Free chat only in the lobby and unrated friendlies, off by default for rated tables.

## 9. Security

**Threat model:** a logged-in player who tampers with requests or reads network traffic to see hands, act out of turn, inflate ratings, or harass others; plus opportunistic abuse of the public app.

### 9.1 Game integrity
- Server-side engine; clients get `view(seat)` only. A test asserts that, for every phase of a simulated game, JSON-serialised `view(s, seat)` contains none of the other seats' cards, talon cards, or the seed. This test is a release gate.
- Seat identity comes from `getAuthUserId` + table lookup, never from a request argument.
- Shuffle seed generated **on the server** with `crypto.getRandomValues`, stored in `tableState` only. `watch` reveals it (`seed`) once the table is `finished`, never before: seed + `options` + the action log replay the match to its result (`replay` in `tableLogic.ts`; tested in `tests/convex/seedReveal.test.ts`, which also checks every phase of a live game for the seed).
- Rate-limit actions per user per table (built: `ACT_LIMIT`, §7); reject actions arriving with a stale `version`.
- Collusion: partners cannot be stopped from talking off-platform. Mitigate with emote-only chat, no live partner hand reveal, and flagging for statistically suspicious pairs later. Don't promise more than that.
- Rating abuse: friendlies and bot games are unrated; rated games need distinct accounts; per-opponent daily rating-gain cap against win-trading; account-age/games-played gate for leaderboards (all built, §7).

### 9.2 Authentication & sessions
- Three ways in, all via Convex Auth, none required for local play: **guest** (display name only, session lives in the browser), **username + password** (persistent, no email, see §15) and **Google OAuth**. Secrets (`AUTH_GOOGLE_SECRET`, JWT keys, `CONVEX_DEPLOY_KEY`) live only in Convex dashboard / GitHub Actions secrets. Never in the repo, logs, or client bundle. (`scripts/convex-auth-setup.mjs` already refuses to log them.)
- Every mutation and every non-public query starts with an auth guard from `convex/lib/auth.ts` (`requireUser(ctx)`); there is no function that skips it by accident. Public queries are listed explicitly (e.g. public leaderboard).
- Authorisation is checked per object: host-only actions (start, kick, change options), member-only reads, owner-only profile edits.
- Account deletion (GDPR: players in HR/DE/AT/CH are in the EU/EEA or Swiss regime), **built**: `users.deleteAccount`, from *My account* (`/account`) after a confirmation. The player leaves every table through the same `leaveTable` as `tables.leave` (lobby: seat freed, host handed on, empty table deleted; friendly game: a bot keeps the seat; rated game: abandoned, their team loses). Their name is replaced by `DELETED_NAME` in every seat they hold (`anonymiseSeats`). Deleted: Convex Auth accounts, verification codes, sessions, refresh tokens and verifiers; rating and rating history; memberships and presence; blocks, mutes and reports in both directions. The `users` row is replaced by `{name: DELETED_NAME, deletedAt}` so `games.players` and other players' histories keep working; `requireUser` refuses a deleted user, so a token issued before the deletion stops working at once. Tested in `tests/convex/deleteAccount.test.ts`, which scans every table for the name and email. Known gap: a friendly game the player had *earlier* left mid-game kept a bot under their name (no link back to them), and that name stays.

### 9.3 Input & data
- Every function declares `args` with `v.*` validators, with length and range limits (display name ≤ 24 chars, trimmed, no control chars). Engine actions are additionally checked against `legalActions`.
- Never trust client-provided IDs for ownership; look up and compare.
- Invite codes (built): 8 chars from the unambiguous alphabet via `crypto.getRandomValues` (31⁸ ≈ 8.5·10¹¹ codes). A code admits new players for 24 h (`INVITE_TTL_MS`, then `CODE_EXPIRED`); seated players can always come back. The host can revoke it (`tables.newCode`): the old code goes to `retiredCodes`, still resolves for seated players (their page follows `watch().code` to the new one) and for nobody else. `join` with an unknown or hidden code returns `null` instead of throwing, so the spent token of the per-user lookup bucket (`LOOKUP_LIMIT`: 10, then one per 30 s) is kept; past it, `RATE_LIMITED`. Tables from before keep their 6-character codes and never expire.
- Rendering: React escapes by default; never use `dangerouslySetInnerHTML` with user data. Display names and chat render as text.
- Private tables are unlisted and not enumerable; public lobby (later) shows only what a joiner needs.

### 9.4 Abuse & privacy
- Rate limits on table creation, invites, friend requests, name changes (built: 3 renames per 24 h, `RENAME_TOO_SOON`; 10 reports per day).
- **Names** (built): `convex/lib/names.ts` checks every chosen name: guest sign-in, username sign-up (not sign-in, so a list change never locks anyone out) and `users.rename`. It lowercases, strips diacritics (đ → d), undoes leetspeak (0→o, 1→i, 4→a, @→a…), drops separators and collapses repeated letters, then looks for Croatian and English roots; a short allow-list covers real names that contain one. Refused names get `NAME_NOT_ALLOWED`. Google names are not filtered (decided).
- **Unique names** (decided, built in `convex/lib/uniqueNames.ts`): two names are the same when they match ignoring case and spacing (`nameKey`: "Ana", "ana" and " Ana " collide; letters still count, so "Đurđa" ≠ "Durda"). Checked through the `by_name_key` index at guest sign-in, username sign-up and rename (`NAME_TAKEN`; the dialog and *My account* offer the first free variant from the public `users.suggestName`, e.g. "Ana 2"). The check for sign-ins runs in Convex Auth's `afterUserCreatedOrUpdated` callback, inside the mutation that stores the user, so a refused name stores nothing. Google sign-ins keep their Google name, or get the first free variant automatically. Rows without a key never block anyone: deleted accounts, admin-reset names (`Igrač`), bots and test accounts; the two app-given names are reserved, so nobody can pick them. Players from before this got their key from `internal.users.backfillNameKeys` (run from the dashboard, repeated with the returned cursor until `isDone`): the earliest holder keeps a name, later duplicates become "Name 2". Renaming changes the name for new tables; seats at existing tables keep the old one.
- **Block, mute, report** (built, `convex/moderation.ts`): players pick another human by *seat* at a table they share (never by a client-sent user id), from *Players at this table* on the table page. Block: `tables.join` refuses (`BLOCKED`) when either side has blocked anyone seated. Mute: private; `moderation.mutedSeats({code})` gives the seats whose emotes and quick phrases the page should hide. Report: fixed reason, one open report per pair, shown in `/admin` where an admin dismisses it or resets the name to `Igrač`. Reports, blocks, unblocks and admin decisions go to `moderationLog`; mutes are not logged. Unblock and unmute from *My account*. `tables.rematch` leaves the seat of anyone blocked with the player who asks for it empty.
- Store the minimum personal data: display name, and for Google users avatar and email (never shown). Username accounts store no real email at all, so they have **no password recovery** (a known trade-off, revisit with email verification). Region is self-declared, coarse (country/city), optional.
- No third-party trackers in v1. If analytics are added: cookieless, aggregate, disclosed in the privacy page.
- **Privacy page** `/privacy` (hr + en, `src/pages/Privacy.tsx`), linked from the menu and the sign-in dialog: what the browser and the server store, processors (Convex, GitHub Pages, Google Fonts and Google sign-in), no tracking, retention and how deletion works. Keep it in step with `convex/schema.ts`. It names no controller contact yet.

### 9.5 Web & supply chain
- CSP via `<meta>` (GitHub Pages can't set headers), added to production builds by `config/csp.ts`: `script-src 'self'` (no inline scripts, no eval), `connect-src` only this build's own Convex deployment (https + wss), Google Fonts and Google avatars allowed, `object-src 'none'`. Not in dev, where Vite injects an inline script.
- Dependabot + `npm audit` in CI; pin via `package-lock.json`; review new dependencies. GitHub Actions pinned to commit SHAs and run with minimal `permissions:`.
- Secret scanning enabled on the repo; `.env*` gitignored.
- Production and dev Convex deployments are separate; the deploy key can only deploy.

## 10. Code standards

- **TypeScript strict**; no `any` without a comment explaining why. Shared types come from one place (engine types in `games/*`, DB types from Convex `Doc<>`).
- **Pure functions first.** Side effects only at the edges (UI hooks, Convex handlers, scheduled functions). Prefer data in/out over classes.
- **Parse, don't validate:** convert untrusted input to typed values at the boundary; inside, trust the types.
- **No magic numbers:** rules constants live in `rules.ts`; timings in one `config.ts` (reconnect grace, bot delay, invite TTL).
- **Naming:** domain language from `docs/rules/bela.md` (talon, zvanje/declaration, stiglja, pad/fall, visi/hang). Keep Croatian terms where they are the real game vocabulary and document them.
- **Small files, deep modules:** if a file needs a table of contents it should be split by responsibility, not by layer.
- **Errors:** return/throw typed errors; no swallowed `catch`. User-visible errors are translation keys.
- **Comments** explain *why* (rule interpretations, security reasoning), not what.
- **Decisions** that change architecture get a short ADR in `docs/adr/NNNN-title.md` (context, decision, consequences).
- **Git:** small PRs, one concern each; Conventional-style commit subjects; rule or scoring changes always include a test and a `docs/rules` update.

## 11. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Engine | Vitest | Rules, legality, declarations, scoring tables from `docs/rules`; property test: any sequence of random legal actions ends in a valid terminal state, totals 162 points per hand. |
| Determinism | Vitest | Same seed + log ⇒ identical state; replay of stored games in CI. |
| Bots | Vitest | N simulated matches complete without illegal moves (exists: 200). |
| View leakage | Vitest | See 9.1. Release gate. |
| Server | `convex-test` (in `tests/convex`) | Not-your-turn, illegal action, wrong seat, double-submit, stale version, reconnect/abandon timers, rating update atomicity, authorisation for host-only actions. |
| Ratings | Vitest | Known OpenSkill cases; bot/unrated games change nothing; abandon handling. |
| E2E | Playwright | Two browser contexts at one table: create by link, join, play a hand, reconnect mid-game. |
| UI | Vitest + Testing Library (sparingly) | Language switch, legal-card hints, accessibility smoke. |

CI: `ci.yml` on every PR runs typecheck → lint → unit/server tests → build → `npm audit` (prod, high), and an **e2e** job: `npm run e2e` starts a throwaway local Convex backend (`CONVEX_AGENT_MODE=anonymous`, no account or secrets), builds against it and runs Playwright (`e2e/`): two browser contexts create, join and play a table and reconnect; a player renames, blocks and reports another, then deletes their account (`e2e/account.spec.ts`); local play on desktop and phone; console errors (incl. CSP violations) fail the test. `deploy.yml` (on `main`) lints, tests and deploys Pages + Convex. Actions are pinned to commit SHAs; Dependabot updates npm and actions weekly. A red check blocks merge.

## 12. Observability & operations

How-to and dashboard steps: [operations.md](operations.md).

- **Structured logs** (built): `logEvent` (`convex/lib/log.ts`) writes one JSON line per key event (table created/started, code replaced, stand-in/reclaim, game finished, rate limited, flag changed, cleanup, usage, quota warning, compaction) with `tableId`/`gameId`. Its field list is closed: **never** hands, seeds of live games, state, tokens, or emails.
- **Quota watch** (built): against the Convex free tier (1M function calls/month, 0.5 GB storage). A daily cron (`maintenance.countUsage`) counts the previous UTC day's tables and actions (paged) into `usage`; the admin panel sums 30 days, estimates calls as actions × 5 (`CALLS_PER_ACTION`; ~2,300 per match) and warns at 70% (`QUOTA_WARN_AT`), and the cron logs `quota.warning`.
- **Action-log compaction** (built): the action log of finished **unrated** non-test tables is deleted after 30 days (`maintenance.compactLogs`); their `games` row and final state stay. Rated logs are kept for replay and disputes.
- **Backups:** Convex snapshot export, scheduled on the Pro plan or by CLI export (`npx convex export --prod`); steps in operations.md.
- **Feature flags** (built): rows in `config`, switched in the admin panel, missing means on: `ratings` (off: no new rated tables, no rating changes), `rematch`, `chat`. `flags.list` is public. Tournaments get a flag when they exist.
- Cost fallback: if the free tier is exceeded, the order of reduction is turn timers → bot delay ticks → view refresh frequency; the upgrade path is Convex paid plan, not a rewrite.

## 13. Business features, without compromising the above

- **Cosmetics** (card backs, table themes, avatars): stored as `entitlements` per user; purely visual, never affect rules or ratings. Payments handled entirely by a hosted provider (Stripe Checkout / Paddle); the app never sees card data; webhooks verified by signature and idempotent.
- **Premium analytics/replays:** gated by entitlement on *read* of derived data; the underlying game records of one's own games stay accessible to everyone for dispute purposes.
- **Sponsored tournaments:** an organiser role on `tournaments`/`clubs`, sponsor branding as data; no ads inside the table.

## 14. Open decisions (record as ADRs when settled)

1. Display names: guests and username accounts pick their own (2–24 chars, filtered, renamed on *My account*, 3 times a day). Decided: names are unique ignoring case and spacing (§9.4), Google names are kept unfiltered (with a free variant when taken), and the deleted-player name stays Croatian.
2. Do signed-in local games against bots count for personal stats (unrated)?
3. Default timer profile per mode (quick vs long game, rated vs friendly). Profiles exist (§7: relaxed / normal / quick, host's choice per table); every table still defaults to normal (90 s grace, 45 s per move, 30 s on the hand summary). Open: should 1001 or rated tables default differently?
4. Pair rating: separate `pair` rating only, or also feed both members' solo ratings?
5. Region model: free text vs a fixed list of cities/clubs (affects leaderboards and moderation).
6. When (if ever) to open a public lobby; minimum concurrent-player threshold.

## 15. Guests, test data and the admin panel

Decided in [adr/0001-guest-and-username-accounts.md](adr/0001-guest-and-username-accounts.md).

**Accounts without Google.** `convex/auth.ts` registers the Anonymous provider (guest: name only) and the Password provider (username + password). Convex Auth's Password provider identifies accounts by "email", so a username maps to the reserved, non-routable address `<username>@users.karte.invalid` (`src/account/username.ts`); `profile()` rejects any other address, so real emails can't be used and nothing is ever sent. Guest sessions end when the browser's storage is cleared; the sign-in dialog offers a username account for people who want to keep their identity.

**Tables.** `convex/tables.ts` holds thin entry points; `convex/lib/tableLogic.ts` is the pure orchestration (who moves next, validating a human action, advancing bots), tested without Convex. Flow: `create` → friends `join` by code or link → host `addBot` / `clearSeat` / `start` (empty seats get bots) → `act` for humans, scheduled `step` for bots and trick collection. `watch` is the one read: the caller's `viewFor` seat projection, seat names and lobby info, never the stored state. Leaving a running game replaces the player with a bot. Humans can press "next hand"; a bot-only table deals by itself.

**Test data and bots in an admin panel.**
- `/admin` is hidden: no link except in the menu of users with `isAdmin`, and a non-admin who opens the URL is redirected home. The real protection is server-side: every function in `convex/admin.ts` starts with `requireAdmin`, which answers `NOT_FOUND` to everyone else.
- Nobody becomes admin through the app. Sign up with a username, then run `admin:setAdmin` with `{ "username": "…", "admin": true }` in the Convex dashboard (Functions → Run). It is an `internalMutation`, unreachable from clients.
- Everything the panel creates is flagged `isTest` (tables, bot accounts). Real-user queries never return test tables: `watch` answers `null`, `join` and `act` answer `NOT_FOUND`, `mine` omits them. Admins can spectate bot-only test tables from seat 0 and nothing else; at a real table an admin sees no cards.
- Tools: **Seed** (6 bot accounts, an open lobby to join, one live bot match, two finished ones), **Start a bot match** (level, live or fast, target), **Delete test data** (removes only `isTest` rows, including their action logs).
- The panel is English-only: it is an internal tool, an explicit exception to the i18n rule in §8.

**Limits.** At most 5 unfinished tables per user (`RATE_LIMITED`). Table codes are 8 characters from an unambiguous alphabet, generated with `crypto.getRandomValues`, and expire for joining after 24 h (§9.3; older tables keep 6). Names are validated server-side (2–24 chars, no control characters).

**Reconnect** is built (§7): heartbeats, a 90 s grace period, stand-in bots, reclaim on return, and a table that waits when everyone is away. Pure rules in `tableLogic.ts` (`presenceCheck`, `standIn`, `reclaimSeat`), tested in `tests/server/presence.test.ts` and `tests/convex/reconnect.test.ts`.

**Turn timers, rematch, cleanup, rated play and e2e** are built too (§7, §11). Still open: personal stats page.
