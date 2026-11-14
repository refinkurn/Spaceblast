# Analytics

Two parts, both free, no cookies, no personal data.

## 1. Traffic: Cloudflare Web Analytics
Page views, countries, devices. Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → `spaceblast.vercel.app` → copy the token from the JS snippet. Put it in Vercel → Settings → Environment Variables as `VITE_CF_BEACON_TOKEN` (Production and Preview) and redeploy. Without the variable the beacon is simply not loaded (`src/services/web_analytics.ts`).

## 2. Game events: our own server
The page sends small batches to `POST /api/events` on the Cloudflare worker (`server/analytics.ts`), stored in the D1 database `spaceblast-analytics` (table `events`). Client: `src/services/analytics.ts`. Nothing is sent from `npm run dev`.

| Event | When | Fields |
|---|---|---|
| `session_start` | page opened, or back from the background | |
| `day` | first session of a UTC day on this device | `first_day`, `days` since then |
| `session_end` | page hidden or closed | `value` = seconds |
| `level_start` / `level_clear` / `level_fail` | Story | `level`, `value` = seconds played (clear/fail) |
| `round` | a battle round ended | `mode` = bot / online, `value` = seconds |

Every row also has `day` (server UTC date) and, from 2026-11-14, `src`: `site` (spaceblast.vercel.app) or `crazygames` (the portal build). Rows from before that date, and rows stored before the column exists, have `src` NULL. There is no player id: retention is counted from `day` events.

## Source column (one step for Refindo, 1 minute)
The server already sends `src`, but the live database needs the column. Until it exists the server stores events without it (nothing is lost, only the source). In Cloudflare → Storage & Databases → D1 → spaceblast-analytics → Console, run once:
```sql
ALTER TABLE events ADD COLUMN src TEXT;
```
Do it before the CrazyGames upload, so portal players can be told apart from day one.

## Queries
Run them in Cloudflare → Storage & Databases → D1 → spaceblast-analytics → Console (or ask the code session).

Daily players and sessions:
```sql
SELECT day, SUM(name='day') AS players, SUM(name='session_start') AS sessions
FROM events GROUP BY day ORDER BY day DESC LIMIT 14;
```
Day-1 and day-7 retention by first day:
```sql
SELECT first_day,
  SUM(days=0) AS new_players,
  ROUND(100.0*SUM(days=1)/MAX(SUM(days=0),1)) AS d1_pct,
  ROUND(100.0*SUM(days=7)/MAX(SUM(days=0),1)) AS d7_pct
FROM events WHERE name='day' GROUP BY first_day ORDER BY first_day DESC;
```
Story drop-off (starts, clears, fails per level):
```sql
SELECT level, SUM(name='level_start') AS starts, SUM(name='level_clear') AS clears, SUM(name='level_fail') AS fails
FROM events WHERE mode='story' GROUP BY level ORDER BY level;
```
Online rounds per player per day:
```sql
SELECT day, SUM(name='round' AND mode='online') * 1.0 / MAX(SUM(name='day'),1) AS online_rounds_per_player
FROM events GROUP BY day ORDER BY day DESC;
```
Median-ish session length (average, seconds):
```sql
SELECT day, ROUND(AVG(value)) AS avg_seconds FROM events WHERE name='session_end' GROUP BY day ORDER BY day DESC;
```

## The numbers CrazyGames judges (portal players only)
Basic Launch is judged on play time, day-1 retention and how many players stay at least a minute (docs/PORTAL.md). Per day:
```sql
SELECT day,
  SUM(name='session_start') AS sessions,
  ROUND(AVG(CASE WHEN name='session_end' THEN value END) / 60.0, 1) AS avg_minutes,
  ROUND(100.0 * SUM(name='session_end' AND value >= 60) / MAX(SUM(name='session_end'), 1)) AS stayed_1min_pct
FROM events WHERE src='crazygames' GROUP BY day ORDER BY day DESC LIMIT 21;
```
Day-1 retention of portal players:
```sql
SELECT first_day, SUM(days=0) AS new_players, ROUND(100.0*SUM(days=1)/MAX(SUM(days=0),1)) AS d1_pct
FROM events WHERE name='day' AND src='crazygames' GROUP BY first_day ORDER BY first_day DESC;
```
Did the quick start work? Share of portal sessions that reach a level, and that clear level 1:
```sql
SELECT day,
  ROUND(100.0 * SUM(name='level_start' AND level=1) / MAX(SUM(name='day' AND days=0), 1)) AS new_players_starting_level1_pct,
  ROUND(100.0 * SUM(name='level_clear' AND level=1) / MAX(SUM(name='level_start' AND level=1), 1)) AS level1_clear_pct
FROM events WHERE src='crazygames' GROUP BY day ORDER BY day DESC LIMIT 21;
```
