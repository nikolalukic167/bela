# Karte – Bela (Croatian Belot) in the browser

A responsive web app for playing **Bela** against three bots, built so more card games can be added later.

**Live:** https://nikolalukic167.github.io/bela/ (after GitHub Pages is enabled, see below)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/bela/
npm test           # engine unit tests + 200 simulated bot matches
npm run build      # type-check + production build into dist/
```

## Structure

```
src/core/          game-agnostic: cards, seeded RNG, GameDefinition interface, game registry
src/games/bela/    pure Bela engine (rules, legality, declarations, scoring, bot) + ui/
src/ui/            shared UI: SVG Card, Modal, useGame hook (bots, auto actions, persistence)
src/pages/         Home (game picker), Play/:gameId, Rules/:gameId
src/i18n/          Croatian / English strings
docs/rules/bela.md exact rules the engine implements
```

### Adding another game
1. Implement `GameDefinition` (`src/core/game.ts`) in `src/games/<id>/` – pure functions over JSON state.
2. Build its table under `src/games/<id>/ui/` using `useGame` and the shared `Card`.
3. Mark it `available: true` in `src/core/registry.ts` and route it in `src/pages/Play.tsx`.

Because engines are pure and serialisable, the same code can later run on a server for online multiplayer.

## Hosting (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Claude Code skills

`.claude/skills/` contains the 27 stable skills from [mattpocock/skills](https://github.com/mattpocock/skills)
(the set shipped by its `mattpocock-skills` plugin, MIT – see `.claude/skills/LICENSE-mattpocock-skills`),
copied at upstream commit `f3fc5632f401156837ee3872f14fe33ccf1024ea`. Run `/setup-matt-pocock-skills` once to
configure them for this repo. To update, re-copy from upstream or use `npx skills update`.
Note: upstream's `code-review` skill shares its name with Claude Code's built-in `/code-review`.
