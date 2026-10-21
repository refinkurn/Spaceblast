# Story score + online leaderboard

Decided by Refindo on 2026-10-21. Built the same day.

## Score (computed when a level is cleared)
The score is worked out in `src/services/score.ts`, from the sim state when a level clears. It is not part of the sim: it never changes play, so it is not in `hashState()`.

Points:
- Clear: 2,000.
- Martians cleared: 500 each.
- Time bonus: `max(0, (par - seconds) * 20)`.
  - Par is 75 s for normal levels and 60 s for the level 20 duel.
  - Boss levels have no par and no time bonus.
- Hearts left: 1,000 each. Each level starts with 3 hearts, so a clear has 1 to 3.

There are no dots or gems; Refindo chose to drop that part.

## Stars (replaces the old rule)
- **1 star:** cleared.
- **2 stars:** the score reaches the level target, `scoreTarget(level)`. The target is a clear with 2 hearts, half the Martians, and a quarter of the par time spare.
- **3 stars:** 3/3 hearts and under par. Boss levels need 3/3 hearts only.

Old saves keep their stars: the best is kept, as before. The best score per level is saved locally (`progress.ts`, `scores`).

## Identity (no sign-in)
`src/services/profile.ts` stores the leaderboard identity in localStorage:
- a random `device_uuid`
- a name, `Bosco_123` by default

Players change the name on the Leaderboard screen. Names are 2–12 letters, numbers, spaces, `_` or `-`. A word filter (English and Indonesian) checks names both in the game and on the server. The server replaces a rude name with a default instead of rejecting the score.

## API
`server/leaderboard.ts` is shared by the dev relay (in memory) and Cloudflare (a Durable Object with SQLite, free plan).

- `POST /api/scores` takes the `ScoreSubmission` payload (`src/services/leaderboard_types.ts`).
  - The server keeps each device's best per stage.
  - It replies with the device's rank, best score and saved name.
  - `400` means a bad field, such as a score above `maxScore(level)`. The client drops that score.
  - `429` means the device posted again within 3 s, or more than 300 times a day. The client tries again later.
- `GET /api/scores?stage=stage_1_3&device=<uuid>` returns the top 10 plus the device's own row.
- Stage ids are sector-level: level 8 is `stage_2_3`.

## Client
`src/services/leaderboardApi.ts` queues scores in localStorage, keeping the best per stage. It sends them:
- right after a clear
- when the browser comes back online
- 3 s after start-up

The end-of-level card shows Score, Bonus and, once the reply comes back, the Online rank. The Story level map has a **Leaderboard** button: one level at a time, top 10, your rank, and your name.

## Known limits
The client sends its own score, so a determined player can fake one within the caps. A server replay check is a later step: the client would send the seed and inputs, and the server would replay the level.
