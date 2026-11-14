# CrazyGames SDK (portal build only)

Roadmap M2 (Full Launch) needs the CrazyGames HTML5 SDK v3. We wire the parts
that are safe during Basic Launch now, so Full Launch is a switch, not a rush.
No ads in these items: Basic Launch allows none (docs/PORTAL.md). Producer spec, 2026-11-14.
Re-read docs.crazygames.com/sdk/html5-v3 before building; their docs win over this file.

## Rules

- Portal build only (`isPortal`, src/config/portal.ts). Our own site never loads it.
- One switch in src/config/portal.ts: `CRAZY_SDK` (true when `PORTAL === 'crazygames'`).
- One wrapper module: `src/services/crazygames.ts`. Nothing else touches `window.CrazyGames`.
- Loaded at runtime from `https://sdk.crazygames.com/crazygames-sdk-v3.js` (their CDN,
  as their docs require). Not an npm dependency, not bundled.
- The game must play exactly as today when the script is blocked (ad blocker),
  slow or missing: every wrapper call is a silent no-op until `SDK.init()` resolved,
  and a load or init failure is caught once and logged once (console.warn).
- Do not wait for the SDK before showing the start screen. Start loading it at
  boot; calls made before it is ready are dropped (not queued), except the
  current gameplay state, which is re-sent once when init finishes.
- `SDK.environment` `'disabled'` (outside crazygames.com and not local) = no-op.
- Nothing in src/sim/ or src/net/ changes.

## Wrapper API (src/services/crazygames.ts)

```
initCrazySdk(): void                 // boot: load script + init, never throws
setGameplay(active: boolean): void   // calls gameplayStart/Stop on changes only
loadingStart() / loadingStop()       // optional, around the first level load
inviteLink(code): string | null      // SDK.game.inviteLink({ roomId: code })
showInvite(code) / hideInvite()      // SDK.game.showInviteButton / hideInviteButton
inviteRoom(): string | null          // SDK.game.getInviteParam('roomId'), checked with isRoomCode
```

## Gameplay start / stop

Gameplay is active when a Story level, a Battle vs Bot round or an online round
is running and not paused. main.ts already computes `paused` each frame
(pause card, cards, countdown, cutscene, cinematic, upright phone, overlay);
active = a round is running && !paused. `setGameplay` only calls the SDK on a
change, so it is cheap to call every frame. Menus, story map, level cards,
end-of-match screens and the lobby are stopped.

## Invites (multiplayer)

- Our invite button stays hidden in the portal (CSS rule in style.css).
- Lobby open (host or guest) with a room code: `showInvite(code)`; lobby closed or
  the round starts: `hideInvite()`.
- Page opened from a CrazyGames invite: `inviteRoom()` gives the code; treat it
  exactly like `?room=CODE` today (Multiplayer screen, code filled in, player taps
  Join). Quick start must also skip for it (wantsQuickStart).

## Later (not in these items)

Ads (midgame between levels / after rounds, rewarded extra heart on a Story
retry), user module (username on the leaderboard, auto login), data module
(progress on the account): queued when Full Launch is near.
