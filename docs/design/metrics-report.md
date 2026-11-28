# Weekly metrics report (M3)

Refindo, 2026-11-28: start it now, so it is ready on the first day of Basic Launch.

## What it is
`npm run metrics` prints one table per number, one row per ISO week (Monday start, UTC),
split by source: `site`, `crazygames`, and `unknown` (rows with `src` NULL, before 2026-11-14
or before the column exists). Last 8 weeks by default; `--weeks N` changes that.

## Numbers (same meaning as the queries in docs/ANALYTICS.md)
| Column | From |
|---|---|
| players | `day` events (one per device per UTC day) summed over the week |
| new players | `day` events with `days = 0` |
| d1 % | new players of that week with a `days = 1` row, / new players |
| sessions | `session_start` |
| avg minutes | average `session_end.value` / 60, one decimal |
| stayed 1 min % | `session_end` with value >= 60, / all `session_end` |
| story level 1 start % | `level_start` level 1 / new players |
| level 1 clear % | `level_clear` level 1 / `level_start` level 1 |
| online rounds / player | `round` with mode online / players |

Story drop-off is a second table: per level, starts / clears / fails for the whole window, per source.

## How it reads the data
- Live: `npx wrangler d1 execute spaceblast-analytics --remote --json --command "<sql>"`
  (wrangler is already a dev dependency; needs `wrangler login` or `CLOUDFLARE_API_TOKEN`).
  One SQL that groups by day and src; the week grouping is done in code.
- Offline: `--file <rows.json>` reads the same JSON shape instead (used by the test and when
  there is no Cloudflare login). A small fixture lives beside the test.
- No login and no `--file`: print one line saying how to log in (ANALYTICS.md) and exit 1.

## Code shape
- Pure part (rows in, week tables out) in `src/services/metrics_report.ts`, with
  `src/services/metrics_report.test.ts` (Vitest only runs tests under src/ and server/).
  It is not imported by the game, so it adds nothing to the bundle.
- Runner `scripts/metrics_report.mjs`; the `metrics` line in package.json; how to run it and
  what each column means added to docs/ANALYTICS.md ("Weekly report").
- Zero divisions print `-`, never NaN. Output is plain text that pastes into the chat.
