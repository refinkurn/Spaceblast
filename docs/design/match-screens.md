# Pause menu, end-of-match screen, lobby slots

Decided by Refindo on 2026-10-21. This is UI only: no changes in `src/sim/`, `src/net/` or `server/`.

## Rules that stay
- **Pausing is not a sim command.** Offline play pauses through the `paused` flag in the `main.ts` loop, the same way cards and scenes pause it now. The sim simply isn't stepped. Online play cannot pause, because the room server runs the clock.
- Respect safe areas on all four sides. Touch targets are at least 48 px. Use SVG icons, not emoji.
- Don't blur the 3D canvas, because `backdrop-filter` is too slow on 2020 phones. Dim it instead (dark semi-transparent backdrop).
- Touch controls release when an overlay opens. `touch.release()` already does this when `paused` turns on.

## 1. Pause menu (Story and Battle vs Bot)
- **Button:** the HUD's top-right `Menu` button becomes a 48 px pause icon. Sound and Full-screen stay beside it, as in `docs/design/hud-intro.md`.
- **Card:** a centred card of about 280 px wide.
  - Title: "PAUSED".
  - A column of four buttons: **Resume**, **Restart level** (Story) or **Restart round** (Battle), **Settings**, **Quit to menu**.
- **Behaviour:**
  - While the card is open, the game is paused via the `paused` flag.
  - **Resume** closes the card. Escape or P toggles the card too.
  - **Restart level** calls `story.play(level, false)`, which skips the story scenes. **Restart round** restarts the current battle round.
  - **Settings** opens the existing settings page above the card. Its Back returns to the pause card.
  - **Quit to menu** asks "Quit? Progress on this level is lost." with **Quit** and **Keep playing**, then calls `openMenu()`.
- **Auto-pause:** offline, the game pauses itself when the tab is hidden (`visibilitychange`).
- **Online:** the same button keeps today's "Leave the match?" banner. No pause card.

## 2. End-of-match screen (`#banner`, `screens.showBanner`)
- **Layout:** a full-screen dark backdrop over the finished arena, with a centred card.
  - Big title: **VICTORY** or **DEFEATED**, and for a Story level clear, **LEVEL CLEAR** or **SURVIVED!**.
  - Beside the title, a 2D sprite of the local astronaut using the existing poses: Bosco `happy` on a win, `defeated` on a loss.
  - Buttons stacked at the bottom: the primary button (**Next level** / **Next round** / **Retry level**) and **Main menu**. Keep the existing once-per-banner guard against frantic taps.
- **Summary block: only stats the game already has.**
  - **Story:**
    - time: `state.tick` as m:ss
    - lives lost
    - stars, from the existing `starsFor`
    - Martians cleared: count `state.martians` with `alive === false`
  - **Battle and online:** round time, plus the score tally that is shown now.
  - "Newly discovered entities" is **not** part of the summary. Encounter cards only exist in Story mode.
- **Canon fix:** boss levels must not say "destroyed". In `story_mode.ts`, the title `${BOSS_NAMES[spec.boss]} destroyed!` becomes `${BOSS_NAMES[spec.boss]} survived!` or "Hive ruptured!" for hives, matching `OUTRO_SCENES`. Bosses can't be destroyed (see `docs/story/canon.md`).

## 3. Lobby: 4 player slot cards (UI over the existing room settings)
- **Layout:** a header with the room code. Under it, a row (or 2×2 grid) of four slot cards, P1 to P4. Each shows the name, the colour, and HOST, BOT or OPEN.
  - Slots fill with seated players first.
  - The host's `bots` count then fills the next slots, all at the same `botLevel`.
  - The remaining slots show OPEN.
- **Host tap actions:**
  - Tapping an OPEN slot adds a bot (`bots + 1`, the existing setting).
  - Tapping a BOT slot removes one (`bots - 1`).
  - Use the existing settings message. The room already shrinks bots when a 4th player joins.
- Bot difficulty stays one choice for all bots: the existing Easy / Normal / Hard control.
- Non-hosts see the slots without tap actions.
- Remove the old bots stepper once the slot cards replace it.
- Keep **Start match** prominent (at least 48 px) and the scenario toggles (Maze Shift, Blackout) as the "stage" choice. There are no separate maps.
- Layout follows `docs/design/menu-dialogue.md`: a left panel that scrolls inside itself.

## Not in this batch (need rules/online work with Refindo present)
- A **Ready / Not ready** toggle, and Start enabled only when everyone is ready. This needs new room messages in `server/room.ts` and `src/net/`.
- **Per-slot bot difficulty** (Bot Easy in one slot, Bot Hard in another). This needs a room settings change.

## Done when
- Offline:
  - Pause → Resume continues exactly where the game left off.
  - Restart and Quit work.
  - Online keeps the leave prompt.
- The end screen shows the sprite and the summary for a Story clear, a Story game over and a Battle round.
- Boss clears no longer say "destroyed".
- In the lobby, the host can add and remove bots by tapping slots, and a 4th player joining still works.
- `npm test` and `npm run build` pass, with tests for the summary text and the boss title.
