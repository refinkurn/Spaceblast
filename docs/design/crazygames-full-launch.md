# CrazyGames Full Launch parts (portal build only)

Roadmap M2 and docs/PORTAL.md "Full Launch": ads through the SDK, their username
on the leaderboard, progress on their account. Same rules as
docs/design/crazygames-sdk.md: portal build only, everything through
src/services/crazygames.ts, silent no-op when the SDK is blocked, slow or
`'disabled'`, nothing in src/sim/ or src/net/. Producer spec, 2026-11-15.
Re-read docs.crazygames.com/sdk/html5-v3 (ads, user, data) before building; their docs win.

## Ads (midgame), switched off until Full Launch

- New switch `CRAZY_ADS` in src/config/portal.ts, `false` now: Basic Launch allows
  no ads at all. Turning it on at Full Launch is a one-line change.
- Wrapper: `midgameAd(): Promise<void>` calls `SDK.ad.requestAd('midgame', { adStarted,
  adFinished, adError })`. It resolves at once when the switch is off, the SDK is not
  ready or the ad errors; it never rejects; it resolves anyway if neither `adStarted`
  nor `adError` arrives within 5 s, so a player is never stuck on a blank screen.
- While an ad plays: all sound muted (Web Audio master, restored after) and taps on
  the game ignored. Gameplay is already stopped there (menus only).
- Where (between levels and after rounds, never mid-play):
  - Story: after a level ends (clear or game over), on the tap that starts the next
    level or the retry, before the level loads. Not on the "Map" tap.
  - Battle vs Bot: on the tap that leaves the end-of-match screen.
  - Online: only when the player leaves the room for the menu. Never between online
    rounds: the room's clock keeps running and the player would miss the round.
- Their SDK limits how often a midgame ad shows; we add no timer of our own.
- `adsAvailable(): boolean` = switch on, SDK ready and `SDK.ad.hasAdblock()` false
  (checked once after init). The rewarded extra heart (later item) uses it.

## Username on the leaderboard (user module)

- After init, `SDK.user.getUser()` (and `SDK.user.addAuthListener` for a login during
  play). A logged-in user: their username becomes the leaderboard name.
- Their usernames can hold characters our filter refuses (e.g. a dot): replace each
  character outside `A-Za-z0-9 _-` with `_`, then `cleanName` (src/services/name_filter.ts).
  If that still gives null, keep the device name.
- While logged in, the name field on the leaderboard screen shows the username and
  is read-only (a short hint says it comes from the CrazyGames account). Logged out
  or no SDK: today's device name and rename, unchanged.
- The device id (`uuid`) stays the leaderboard identity; only the name changes.

## Progress on the account (data module)

- `SDK.data` works like localStorage and follows the CrazyGames account when logged in.
- In the portal build with the SDK ready, Story progress (`spaceblast.story`,
  src/flow/progress.ts) is written to both localStorage and `SDK.data`.
- Boot still reads localStorage (the SDK may not be ready). When init finishes,
  read `SDK.data`'s copy, run it through `sanitize`, and merge with what is loaded:
  highest `unlocked`, best stars and score per level, larger stats, `true` wins for
  the seen flags, union of the seen-card lists (`introPending` true only if both
  are). Save the merge to both places and refresh the Story map if it is open.
- If their docs say the data module must be switched on in the developer page,
  add that step under "Needs Refindo" in docs/HANDOFF.md.
