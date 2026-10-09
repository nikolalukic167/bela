# Karte – Bela (Croatian Belot) in the browser

![Karte](public/og-image.png)

A responsive web app for playing **Bela** against three bots, built so more card games can be added later.

**Live:** https://nikolalukic167.github.io/bela/ (after GitHub Pages is enabled, see below)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/bela/
npm test           # engine, bots, and the server functions (convex-test)
npm run typecheck  # app + convex/ type-check
npm run lint       # ESLint, incl. the layer rule (architecture §4)
npm run e2e        # Playwright against a throwaway local Convex backend (no account needed)
npm run build      # type-check + production build into dist/
```

## Structure

```
src/core/          game-agnostic: cards, seeded RNG, GameDefinition interface, game registry
src/games/bela/    pure Bela engine (rules, legality, declarations, scoring, bot) + ui/
src/ratings/       OpenSkill player ratings: replay match history, leaderboard, predictions
src/ui/            shared UI: Card, decks (Hungarian + French), Logo, icons, Modal, useGame hook
src/pages/         Home (game picker), Play/:gameId, Rules/:gameId
src/online/        online lobby and table pages (Convex)
src/account/       sign-in (guest, username, Google) and account context
src/admin/         hidden admin panel (test data, bot matches)
convex/            server: auth, tables, admin; lib/tableLogic.ts is the pure core
tests/             server tests: tests/server (pure), tests/convex (convex-test)
e2e/               Playwright browser tests (run via scripts/e2e.sh)
config/            build config (Content-Security-Policy)
src/i18n/          Croatian / English strings
docs/rules/bela.md exact rules the engine implements
docs/bots/         bot levels (random → heuristic → tracking → PIMC → ISMCTS), experiments, report
docs/design/       brand guide, Hungarian deck (SVG/PNG), visual concept
scripts/cards/     generators for the Hungarian deck and the brand assets
```

## Bots

Players pick the bot strength (Easy / Medium / Hard / Expert) when starting a game. How the bots work
and how they were measured: [docs/bots/README.md](docs/bots/README.md) and [docs/bots/report.md](docs/bots/report.md).

### Adding another game
1. Implement `GameDefinition` (`src/core/game.ts`) in `src/games/<id>/` – pure functions over JSON state.
2. Build its table under `src/games/<id>/ui/` using `useGame` and the shared `Card`.
3. Mark it `available: true` in `src/core/registry.ts` and route it in `src/pages/Play.tsx`.

Because engines are pure and serialisable, the same code can later run on a server for online multiplayer.

## UI

App chrome (menu, navbar, dialogs, buttons) uses [daisyUI](https://daisyui.com) 5 on Tailwind CSS 4, with the custom
`bela` theme in `src/styles.css`. Only the card-table layout there is custom CSS.

Cards default to the Hungarian deck (mađarice), generated from public-domain suit artwork plus original aces and
court figures: [docs/design/hungarian-deck/](docs/design/hungarian-deck/README.md). Brand, colours, icons and
Croatian copy conventions: [docs/design/brand.md](docs/design/brand.md).

## Online play

Sign-in works without Google (guest name or username + password). Players can open a table, share its code or link, and bots fill empty seats. Admins get a hidden panel with test data and bot-vs-bot matches (see architecture §15).

See [docs/architecture.md](docs/architecture.md) for the full architecture, priorities, security and code standards, and [docs/online-games-plan.md](docs/online-games-plan.md) for the backend analysis (recommendation: Convex) and the first online phases.

## Ratings

See [docs/ratings.md](docs/ratings.md). Ratings are computed from an append-only match history and are meant to run server-side once online play exists.

## Hosting (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Claude Code skills

`.claude/skills/` contains the 27 stable skills from [mattpocock/skills](https://github.com/mattpocock/skills)
(the set shipped by its `mattpocock-skills` plugin, MIT – see `.claude/skills/LICENSE-mattpocock-skills`),
copied at upstream commit `f3fc5632f401156837ee3872f14fe33ccf1024ea`. Run `/setup-matt-pocock-skills` once to
configure them for this repo. To update, re-copy from upstream or use `npx skills update`.
Note: upstream's `code-review` skill shares its name with Claude Code's built-in `/code-review`.
