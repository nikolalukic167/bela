# 0001: Guest and username accounts next to Google

Status: accepted

## Context
Online tables needed accounts, and the only sign-in was Google, which needs a Google Cloud OAuth client and puts a barrier in front of friends who just want to join a table. We also want a way to test online play with bots without real users noticing test data.

## Decision
- Add two Convex Auth providers: **Anonymous** (guest with a display name) and **Password** (username + password, no email). Keep Google.
- A username is mapped to the reserved address `<username>@users.karte.invalid`, because the Password provider keys accounts by email. Real addresses are rejected in `profile()`.
- Test data is flagged `isTest` and hidden from real users on the server. A hidden admin panel (`isAdmin`, granted only from the Convex dashboard) seeds it, runs bot-vs-bot matches and deletes it.
- Online bots are limited to easy / medium / hard; expert stays offline (too slow for a Convex mutation).

## Consequences
- Guests lose their account when browser storage is cleared. Username accounts have no password recovery (no email). Both are acceptable for casual play and are listed as open items.
- Anyone can create unlimited guest accounts, so nothing a guest does may count toward rated play. Ratings (phase 3) must require a non-guest account.
- The username-to-email mapping is a convention of ours, not of Convex Auth: if email verification or recovery is added later, usernames need a real email field and a migration.
- Test data lives in the production tables, separated by a flag rather than a separate deployment; every real-user read path must keep filtering `isTest` (covered by tests in `tests/convex/admin.test.ts`).
