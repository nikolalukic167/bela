# Operations

Running the production Convex deployment: logs, feature flags, quota watch, action-log compaction and backups. The why is in [architecture.md §12](architecture.md#12-observability--operations); this page is the how. Convex facts were checked against docs.convex.dev in October 2026; the links are the sources.

## Logs

Server functions write one JSON line per key event through `logEvent` (`convex/lib/log.ts`):

```json
{"event":"game.finished","tableId":"k57…","gameId":"j97…","rated":true,"endReason":"normal"}
```

- Events: `table.created`, `table.started`, `table.codeReplaced`, `seat.standIn`, `seat.reclaimed`, `game.finished`, `rateLimited`, `flag.changed`, `cleanup.done`, `usage.counted`, `quota.warning`, `compaction.done`.
- Fields are a closed, typed list (ids, counts, short enums). Hands, live seeds, game state, auth tokens and emails cannot be passed: `LogFields` has no field for them, and a test checks the output.
- Where to read them: the dashboard's **Logs** page (a realtime view with a short history, not a complete archive) or `npx convex logs --prod` ([docs](https://docs.convex.dev/dashboard/deployments/logs), [debugging](https://docs.convex.dev/functions/debugging)). Long-term retention needs a log stream (Axiom, Datadog, PostHog or a webhook), which requires the Convex **Pro** plan ([log streams](https://docs.convex.dev/production/integrations/log-streams)). Filter on `"event":"quota.warning"` there for alerts.

## Feature flags

Rows in the `config` table, switched in the admin panel (**Feature flags**). A missing row means **on**.

| Flag | Off means |
|---|---|
| `ratings` | `tables.create({ rated: true })` answers `FEATURE_OFF`. Tables already created as rated stay rated and are rated when they finish (rated status is frozen at creation, architecture §1.6). Leaderboard and history stay readable. |
| `rematch` | `tables.rematch` answers `FEATURE_OFF`; "Play again" goes back to the table list. |
| `chat` | Read by the chat feature (lobby / emote chat). |

`flags.list` is public, so the client can hide what is off. Every switch is logged (`flag.changed`).

## Quota watch

The Convex free plan allows 1,000,000 function calls per month, 0.5 GB database storage and 1 GB database bandwidth per month; when the free caps are hit, mutations that write may fail ([limits](https://docs.convex.dev/production/state/limits)). Subscription re-runs count as function calls.

- A daily cron (`maintenance.countUsage`, 02:43 UTC) counts the tables and actions created the previous UTC day into `usage` (paged, so a busy day doesn't hit the per-mutation read limit).
- The admin panel's **Usage** box sums the last 30 days and estimates function calls as `actions × CALLS_PER_ACTION` (5: the move itself plus the `watch` re-runs it triggers). At 70 % of `QUOTA_CALLS_PER_MONTH` (`QUOTA_WARN_AT`) it shows a warning, and the cron logs `quota.warning`.
- It is an estimate. The real numbers are in the dashboard under **Usage**. If the warning fires, cut cost in the order of architecture §12: turn timers, bot delay ticks, view refresh.

## Action-log compaction

A daily cron (`maintenance.compactLogs`, 04:07 UTC) deletes the `actions` rows of **finished, unrated, non-test** tables that ended more than 30 days ago (`ACTION_LOG_TTL_MS`). The `games` row (players, scores, winner) and the final table state stay, so history and stats are unaffected. Rated tables keep their full log for replays and disputes. Each table is marked (`actionLog: 'compacted' | 'kept'`), so a run never looks at it again; big runs continue in a follow-up call.

## Backups

Convex backups are snapshots of every table (and optionally file storage). They do **not** include code, environment variables or scheduled functions ([backup & restore](https://docs.convex.dev/database/backup-restore)): code lives in git, and secrets must be kept separately (password manager).

### Scheduled backups (dashboard, needs Convex Pro)

1. Open the Convex dashboard → the project → the **production** deployment.
2. Go to **Settings → Backups** (the "Backup & Restore" page).
3. Tick **Backup automatically**, then choose the time and whether to back up **daily** or **weekly**, and whether to include file storage.
4. Daily backups are kept for 7 days and weekly ones for 14 days. Periodic backups require the Pro plan.

### Manual backup (any plan)

- Dashboard: the same page → **Backup Now**. Manual backups are kept for 7 days. Download one from the backup's menu → **Download** (a ZIP).
- CLI, from a machine with deploy access:

  ```sh
  npx convex export --prod --path ./backups/karte-$(date -u +%F).zip
  ```

  Without `--prod` it exports the *dev* deployment. Add `--include-file-storage` if files are ever stored ([export](https://docs.convex.dev/cli/reference/export)).

On the free plan, run the CLI export on a schedule (e.g. a weekly GitHub Actions job using a `CONVEX_DEPLOY_KEY` secret, storing the ZIP as a private artifact or in private storage). Treat the ZIP as personal data: it holds user names and Google emails.

### Restore

Restoring **wipes the existing data** in the target deployment, so take a fresh backup first.

- Dashboard: Backups page → the backup's menu → **Restore**. It can restore into the same deployment or another deployment on the same team (e.g. try it on dev first).
- CLI: `npx convex import --prod --replace backup.zip`. Without `--replace` (or `--append`) an import into tables that have data fails ([import](https://docs.convex.dev/database/import-export/import)).

After a restore, check the admin panel overview and the leaderboard. Scheduled functions are not restored: running tables will wait until a player sends a heartbeat or a move, which re-arms them.
