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
| 2 | **Accounts & private tables** | Google sign-in, create table by link/code, seats, bots fill empty seats, reconnect, table options shown before joining | 1, Convex | auth scaffolded in `convex/` |
| 3 | **Ratings & leaderboard** | OpenSkill per player, `rating_history`, global board, rating graph, personal stats | 2 | |
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
Convex Auth (Google) ─────────────────────────▶   users, auth tables
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
  <domain>.ts      one file per domain: tables, users, ratings, friends, tournaments
  lib/             auth guards, validators, rate limiting, error types
docs/              architecture, ADRs, rules/<game>.md (spec the engine is tested against)
```

Dependency rule (enforce with an ESLint `no-restricted-imports` config):

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

Defined in `convex/schema.ts`; every field validated by `v.*`. Sketch:

| Table | Key fields | Notes |
|---|---|---|
| `users` | auth fields, `displayName`, `avatar`, `country`, `city`, `locale`, `createdAt` | Public profile fields kept separate from email. |
| `tables` | `code`, `hostId`, `options`, `status` (lobby/playing/finished), `seats[]` (`{userId}` \| `{bot}` \| empty), `rated`, `createdAt` | `rated` is set at start: false if any bot or if host chose friendly. |
| `tableState` | `tableId`, `state` (full engine state), `version` | **Server only**, never returned by any query. Separate table keeps it off accidental `ctx.db.get(table)` returns. |
| `actions` | `tableId`, `seq`, `seat`, `action`, `at` | Append-only; unique `(tableId, seq)`. |
| `games` | `tableId`, `players`, `result`, `rated`, `endedAt`, `endReason` (normal/abandoned) | One row per finished match. |
| `ratings` | `userId`, `scope` (`solo`\|`pair:<id>`), `mu`, `sigma`, `games` | OpenSkill (mu/sigma), not a single Elo number. |
| `rating_history` | `ratingId`, `gameId`, `mu`, `sigma`, `at` | Feeds the rating graph. |
| `pairs` | `userA`, `userB` (ordered), `status`, rating via `ratings` | Both must accept. |
| `friendships`, `invites` | pair of users + status; code, expiry, uses | Invites expire and are single-purpose. |
| `leagues`, `tournaments`, `clubs` | later phases | Added with their phase, not before. |
| `stats` | per-user aggregates | Derived; rebuildable from `games` + `actions`. |

Indexing: every query path has an index (`by_code`, `by_user`, `by_table_seq`, `by_rating`). No unindexed `filter` on growing tables.

## 7. Server design (Convex functions)

- **Thin entry points, deep service.** `convex/tables.ts` holds `query`/`mutation` wrappers that do: authenticate → validate args → call a plain function in `tableService` → return. All game orchestration lives in `tableService` (plain TS taking a `ctx`-like port), so it can be unit-tested without Convex.
- **Act flow** (`tables.act`): resolve caller → seat from the table (never from args) → check it is that seat's turn → check `action ∈ legalActions` → `apply` → append to `actions` → bump `version` (optimistic concurrency; retry on conflict) → schedule next system step.
- **Scheduled functions** drive everything time-based: bot moves (with a small human-like delay), trick collection, turn timers, reconnect grace expiry, abandoned-table cleanup. All idempotent and version-checked: a stale timer is a no-op.
- **Bots** decide from `view(seat)` only, through the same `bot(v, rng)` used offline. They are marked `{bot: true}` in seats and are excluded from rating updates (and make the game unrated).
- **Reconnect:** a disconnected seat keeps its place. A timer (default 90 s, configurable per table) starts on disconnect; on expiry a bot takes over (friendly game continues) or the game ends as `abandoned` (rated game). Returning before expiry cancels the timer. An abandoning player in a rated game takes the loss; the others are not penalised.
- **Ratings:** on game end, one mutation writes `games`, updates `ratings` and appends `rating_history`, atomically. Only rated games with four humans (or the pair rule) qualify. Rating maths lives in `src/ratings/` as pure functions with tests.
- **Errors:** typed `ConvexError` codes (`NOT_YOUR_TURN`, `ILLEGAL_ACTION`, `TABLE_FULL`, `NOT_FOUND`, `RATE_LIMITED`); the client maps them to translated messages. Never leak internal state in an error.

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
- Shuffle seed generated **on the server** with `crypto.getRandomValues`, stored in `tableState` only. Reveal it after the game ends (enables replay verification).
- Rate-limit actions per user per table; reject actions arriving with a stale `version`.
- Collusion: partners cannot be stopped from talking off-platform. Mitigate with emote-only chat, no live partner hand reveal, and flagging for statistically suspicious pairs later. Don't promise more than that.
- Rating abuse: friendlies and bot games are unrated; rated games need distinct accounts; per-opponent daily rating-gain cap against win-trading; account-age/games-played gate for leaderboards.

### 9.2 Authentication & sessions
- Google OAuth via Convex Auth. Secrets (`AUTH_GOOGLE_SECRET`, JWT keys, `CONVEX_DEPLOY_KEY`) live only in Convex dashboard / GitHub Actions secrets. Never in the repo, logs, or client bundle. (`scripts/convex-auth-setup.mjs` already refuses to log them.)
- Every mutation and every non-public query starts with an auth guard from `convex/lib/auth.ts` (`requireUser(ctx)`); there is no function that skips it by accident. Public queries are listed explicitly (e.g. public leaderboard).
- Authorisation is checked per object: host-only actions (start, kick, change options), member-only reads, owner-only profile edits.
- Account deletion endpoint (GDPR: players in HR/DE/AT/CH are in the EU/EEA or Swiss regime): deletes or anonymises profile, keeps anonymised game records for other players' histories.

### 9.3 Input & data
- Every function declares `args` with `v.*` validators, with length and range limits (display name ≤ 24 chars, trimmed, no control chars). Engine actions are additionally checked against `legalActions`.
- Never trust client-provided IDs for ownership; look up and compare.
- Invite codes: 8+ chars from a non-guessable alphabet (CSPRNG), expire (e.g. 24 h), rate-limited lookups, revocable by host.
- Rendering: React escapes by default; never use `dangerouslySetInnerHTML` with user data. Display names and chat render as text.
- Private tables are unlisted and not enumerable; public lobby (later) shows only what a joiner needs.

### 9.4 Abuse & privacy
- Rate limits on table creation, invites, friend requests, name changes.
- Block/mute and report for users; moderation actions logged. Offensive-name filter at profile save.
- Store the minimum personal data: Google name, avatar, email (for account recovery, never shown). Region is self-declared, coarse (country/city), optional.
- No third-party trackers in v1. If analytics are added: cookieless, aggregate, disclosed in a privacy page.

### 9.5 Web & supply chain
- CSP header via `<meta>` (GitHub Pages can't set headers): `default-src 'self'; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud; img-src 'self' data: https://lh3.googleusercontent.com`; no inline scripts.
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
| Server | `convex-test` | Not-your-turn, illegal action, wrong seat, double-submit, stale version, reconnect/abandon timers, rating update atomicity, authorisation for host-only actions. |
| Ratings | Vitest | Known OpenSkill cases; bot/unrated games change nothing; abandon handling. |
| E2E | Playwright | Two browser contexts at one table: create by link, join, play a hand, reconnect mid-game. |
| UI | Vitest + Testing Library (sparingly) | Language switch, legal-card hints, accessibility smoke. |

CI (`.github/workflows`): typecheck → lint → unit tests → build → (on `main`) deploy Pages + Convex. A red check blocks merge.

## 12. Observability & operations

- Structured server logs with `tableId`/`gameId`, **never** hands, seeds of live games, tokens, or emails.
- Counters to watch against the Convex free tier: function calls/month (~2,300 per match), storage. Alert at 70% of quota; the action log is compacted into `games` summaries after N days for friendlies (rated logs are kept for replay and disputes).
- Backups: Convex snapshot export on a schedule for production.
- Feature flags (a `config` table or env) for risky rollouts: ratings on/off, tournaments on/off.
- Cost fallback: if the free tier is exceeded, the order of reduction is turn timers → bot delay ticks → view refresh frequency; the upgrade path is Convex paid plan, not a rewrite.

## 13. Business features, without compromising the above

- **Cosmetics** (card backs, table themes, avatars): stored as `entitlements` per user; purely visual, never affect rules or ratings. Payments handled entirely by a hosted provider (Stripe Checkout / Paddle); the app never sees card data; webhooks verified by signature and idempotent.
- **Premium analytics/replays:** gated by entitlement on *read* of derived data; the underlying game records of one's own games stay accessible to everyone for dispute purposes.
- **Sponsored tournaments:** an organiser role on `tournaments`/`clubs`, sponsor branding as data; no ads inside the table.

## 14. Open decisions (record as ADRs when settled)

1. Display names: Google name by default, editable? Uniqueness rules?
2. Do signed-in local games against bots count for personal stats (unrated)?
3. Reconnect grace default and turn-timer defaults per mode (quick vs long game).
4. Pair rating: separate `pair` rating only, or also feed both members' solo ratings?
5. Region model: free text vs a fixed list of cities/clubs (affects leaderboards and moderation).
6. When (if ever) to open a public lobby; minimum concurrent-player threshold.
