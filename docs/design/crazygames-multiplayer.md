# CrazyGames multiplayer and settings (portal build only)

Roadmap M2 (Full Launch): "room info, invite link, instant join, rooms kept across
rounds". Their requirements page (docs.crazygames.com/requirements/multiplayer) marks
room sharing and Instant Multiplayer as required, and the game module's `muteAudio`
setting as required for HTML5. Same rules as docs/design/crazygames-sdk.md: portal
build only, silent no-op when the SDK is blocked, slow or `'disabled'`, nothing in
src/sim/ or src/net/ or server/. Producer spec, 2026-11-16.
Re-read docs.crazygames.com/sdk/game before building; their docs win over this file.

src/services/crazygames.ts is already over 300 lines: put the new wrapper calls in
a new file, src/services/crazygames_room.ts, using `crazySdk()` from the old one.

## Room data (replaces the deprecated invite button)

- `SDK.game.showInviteButton` / `hideInviteButton` are deprecated in favour of
  `SDK.game.updateRoom({ roomId?, isJoinable?, inviteParams? })` and `SDK.game.leftRoom()`.
- In a room's lobby (host or guest): `updateRoom({ roomId: code, isJoinable: true,
  inviteParams: { roomId: code } })`. Same `roomId` param name as today, so
  `inviteRoom()` and existing invite links keep working.
- Round starts: `updateRoom({ isJoinable: false })`. Back in the lobby: joinable again.
  Room full (no free seat): not joinable.
- The player leaves the room (or the connection is lost for good): `leftRoom()`.
- `SDK.game.addJoinRoomListener((params) => ...)`: a friend joins through the
  CrazyGames UI while the game is open. Use `params.roomId` (checked with
  isRoomCode). In a menu, the Story map or the Multiplayer screen: same as an
  invite today (Multiplayer, code filled in). In a Story level, Battle vs Bot or an
  online round: ignore it (they can join from the menu).
- Keep `showInvite` / `hideInvite` only if their docs still require the button;
  otherwise replace their call sites in src/flow/online.ts.

## Instant Multiplayer

- `SDK.game.isInstantMultiplayer` true after init: the player came as the first of a
  party. Skip quick start and the menu; open Multiplayer and create a new room at
  once with the saved name and colour (default match settings). They land in the
  lobby, joinable at once (room data above). An invite (`inviteRoom()` not null)
  wins over this: join that room as today instead of creating one.
- Our rooms are private already (code only), so no other setting is needed.
- If creating the room fails: stay on the Multiplayer screen with today's error.

## muteAudio setting

- `SDK.game.settings.muteAudio` true: all game sound off, above the player's own
  sound settings (their docs: it takes priority). `addSettingsChangeListener` keeps
  it current. It must not change the saved settings, and it stacks with the
  midgame-ad mute (sound comes back only when neither asks for silence).
- `settings.disableChat`: nothing to do, the game has no chat.

## Later (not in these items)

Usernames shown in the online lobby (the CrazyGames username as the online name
when logged in), `loadingStart` / `loadingStop`, `happytime`.
