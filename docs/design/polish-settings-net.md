# Settings, game feel, invites and reconnect

Decided by Refindo, 2026-10-21. The changes are UI and input only: `src/flow/`, `src/input/`, `src/view/`, `index.html` and `style.css`. Nothing in this spec changes `src/sim/`, `src/net/` or `server/`.

## Rules that stay
- A countdown or a reconnect screen holds the game through the `paused` flag in the `main.ts` loop. It never sends a start command to the sim.
- Online rounds start on the room server's clock. The client cannot delay them.
- Settings save to `localStorage` through `src/flow/settings.ts`, as they do now. Wrap every read and write in try/catch.
- Use the game's own words: **Charge**, not "bomb". Touch targets stay at least 48 px.

## 1. Settings: joystick mode + vibration (`settings.ts`, `index.html #settings`, `src/input/touch.ts`)
Add a **Joystick** setting with two choices. It goes next to the existing Controls size, Music and Sound sliders.
- **Floating** (default, today's behaviour): the stick appears where the left thumb first touches the gutter.
- **Fixed**: the stick base sits at a fixed spot in the left gutter, bottom-left above the safe area, and pressing anywhere in the gutter steers relative to that base.

Add **Vibration** as an On/Off toggle.
- Use `navigator.vibrate` when it exists. Show the toggle only when it exists, because iOS Safari has none; a Capacitor plugin can come later.
- The vibration events are wired in part 2.

Both settings apply instantly and are saved.

## 2. Game feel: start countdown, damage vignette, vibration (`src/flow/`, `main.ts`, style.css)
**Countdown** (Story and Battle vs Bot only, offline):
- It starts after the level card or round banner closes and before play begins.
- It shows `3 · 2 · 1 · BLAST!`: big centred numbers, about 0.6 s each.
- The game is held with the `paused` flag, and touch input is released.
- It is skipped when the tutorial coach is showing its first prompt on level 1, so the tutorial timing is unchanged.
- Online has no countdown for now (see "Not in this batch").

**Damage vignette:**
- When the local player loses a life or armor, a red glow flashes at the screen edges for about 0.35 s. Detect this the same way as the HUD hearts flash, by comparing with the last frame.
- Use CSS only (`box-shadow: inset` or a radial gradient on a fixed overlay), with `pointer-events: none`.
- Respect `prefers-reduced-motion` with a softer, shorter flash.

**Vibration**, if it is on:
- 30 ms when the local player places a Charge. Use the existing sim events that drive `src/flow/sound.ts`.
- 80 ms when the local player is hurt.

## 3. Invites + reconnect screen (`src/flow/online.ts`, `main.ts`, `index.html #online`)
The room code stays as it is now: 4 letters.

**Invite button** in the lobby header, next to the room code:
- Label: **Invite**.
- It uses `navigator.share({ url })` when available (the phone's share sheet), otherwise it copies the link to the clipboard and shows "Link copied".
- The link is the game URL with `?room=CODE`.

**Opening an invite link:** opening the game with `?room=CODE` goes straight to the Multiplayer screen with the code filled in and focus on the name field.
- It joins only after the player taps **Join**.
- Remove `room` from the URL afterwards (`history.replaceState`).

**Reconnect screen:**
- While `online.onReconnecting(true)` is active, show a full-screen dim overlay with a spinner and "Reconnecting to room CODE…".
- It hides on `false`, alongside the existing "Reconnected!" flash.
- If the link gives up, the existing `onExit` already returns to the menu with a reason.
- No attempt counter, because that number lives in `src/net/link.ts`.

## Not in this batch (need Refindo present with sim-specialist, or a decision)
- **Numeric room PIN** (6 digits, numeric keypad): changes the code format in `src/net/protocol.ts`, `server/` and rejoin. 4 digits is too few codes; use 6.
- **Charge skins** (Classic, Asteroid Core, Plasma Sphere): a new cosmetic, art, and a `Profile` field so other players see it.
- **QR code**: needs a QR generator (a new dependency or about 300 lines). The share sheet covers phones for now.
- **Online start countdown**: needs a start lead time from the room server.
- **Colour picker**: already done. There are 8 colours, taken ones are disabled, and the server enforces it.

## Done when
- Fixed and Floating joysticks both steer correctly. Switching takes effect without a reload.
- On Android, vibration fires on placing a Charge and on getting hurt, and is off when the toggle is off.
- The countdown shows before each Story level and Battle round, and play starts exactly after BLAST!.
- The vignette flashes on damage.
- An invite link opens Multiplayer with the code filled in. Pulling the network mid-round shows the reconnect screen, and it hides once the connection is back.
- `npm test` and `npm run build` pass. Add tests for the settings defaults and loading, and for parsing `?room=`.
