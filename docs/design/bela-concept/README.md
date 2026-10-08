# Bela app: visual concept and implementation handoff

A design concept for the Bela UI. **It is a visual reference, not code to copy.** Rebuild it in the app's
real stack (React, daisyUI 5 on Tailwind CSS 4, custom table CSS in `src/styles.css`), reusing existing
components, state and the pure engine in `src/games/bela/`. Do not change game rules or engine behaviour.

Each screen has a source file (`*.dc.html`, plain HTML with inline styles: exact sizes, colors, spacing
and copy) and a screenshot (`*.preview.png`). Open the `.dc.html` for numbers; the PNG for the intended look.
The `<x-dc>` wrapper, `{{holes}}` and the `<script type="text/x-dc">` block belong to the design tool:
ignore them, and read the repeated card rows (hand fan) from the script's data arrays.

## Screens and where they map

| Screen | File | Size | Existing code to change |
|---|---|---|---|
| Home | `Main.dc.html` | 390x844 | `src/pages/Home.tsx`, `src/games/bela/ui/NewGameDialog.tsx` (bot strength) |
| Card table (phone) | `Table.dc.html` | 390x844 | `src/games/bela/ui/BelaTable.tsx`, `positions.ts`, `src/styles.css` |
| Call trump | `Trump.dc.html` | 390x844 | trump-call part of `BelaTable.tsx` |
| Online table | `Lobby.dc.html` | 390x844 | `src/online/OnlineLobby.tsx`, `OnlineTable.tsx` |
| Card table (desktop) | `TableWide.dc.html` | 1280x800 | same as phone table; sidebar uses `ScoreSheet.tsx` and `HandSummary.tsx` |

Recommended order, one PR each: Home, table (phone and desktop), call trump, online table.
Under about 900px the desktop table collapses to the phone layout, and the sidebar scoreboard becomes a sheet.

## Design tokens

| Token | Value | Use |
|---|---|---|
| felt-deep | `#0C2A20` | app ground, top and bottom bars, player chips |
| felt | `#123D2F` | table surface |
| felt-raised | `#17493A` | cards and panels on felt |
| felt-line | `#3F7A66` | outlines, dashed empty seats |
| ink-muted | `#9DB5A8` / `#B7CCC0` | secondary text |
| text | `#E8F0EA` | primary text |
| card | `#FBFAF5` | card face |
| card-ink | `#14201B` | black suits and rank text |
| suit-red | `#C23A2E` | hearts and diamonds |
| gold | `#E7B84B` | primary action, playable-card ring, "your turn" |
| gold-ink | `#1A1405` | text on gold |
| dimmed card | `#8FA39A` | cards you cannot legally play |

Fonts (Google Fonts): **Bricolage Grotesque** 600/800 for the wordmark, titles and big numbers; **DM Sans**
400/500/700 for everything else. Radii: cards 8px (10px on desktop), panels 16-24px, buttons 14-16px.
Touch targets are at least 44px. Suit glyphs are text with U+FE0E so they never render as emoji.

Suggested approach: define a custom daisyUI theme from these tokens instead of editing `forest`, so the
change stays in one place. Keep the existing `forest` palette available until the new theme ships.

## Behaviour shown in the screens

- Legal cards are lit (gold ring, lifted); illegal cards are dimmed. Use `legal.ts`; do not re-derive rules in the UI.
- Trump call: six cards visible, suit buttons show your count per suit, Pass is available, dealer cannot pass (shown as "cannot pass"). The two talon cards join after the call.
- Declarations are automatic and revealed after trick 1; bela is announced automatically.
- Online lobby: table code and share link, two teams (seats 0+2 vs 1+3), empty seats are filled by bots on start.
- Match target 1001. All names and scores in the mockups (Marta, Ivo, Ana, 312/287) are placeholders.

## Not designed yet

Rules, Ratings, sign-in, admin, hand summary and match-end screens, and the Croatian strings.
Keep using the existing screens and i18n (`src/i18n/`) for those.
