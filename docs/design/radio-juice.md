# Kit radio toasts, camera shake, tile highlight

Decided by Refindo, 2026-10-21. View/UI only: `src/flow/`, `src/view/`, `index.html`, `style.css`. No changes in `src/sim/`.

## Feasibility check (done against the code)
1. **Camera.** `src/view/camera_rig.ts` already has `shake(seconds)`. It is a flat 0.06 offset for 0.18 s, applied in `update()` after the follow and close-up positioning. `game_view.ts` calls it on every `charge_exploded`, `maze_shift` and `boss_cross`.
   - **Adaptation:** upgrade this shake in place instead of adding a second system, so the two can't fight. The offset stays additive and is applied last. It never changes `base`, `look` or `aim`.
2. **Top-centre space.** `#alert` (Maze Shift, Blackout and collapse warnings) and `#announce` (boss waves) already use the spot under the HUD. The new HUD's top-centre holds the stage chip and the clock. The tutorial coach (`#coach`, "Tip") sits at the bottom centre.
   - **Adaptation:** toasts use the same top-centre lane as `#alert`, just under the HUD (respect safe areas). While `#alert` or `#announce` is showing, or the coach tip is up, a toast waits its turn. Alerts are about danger, so they win.
3. **Events.** There is no event emitter. `step()` collects `SimEvent`s and `main.ts` hands them to `view.effect()`, `sound.ts` and `story.event()`.
   - **Adaptation:** the toast controller gets the same events from `main.ts`.
   - Damage = `player_died` / `armor_hit` with the local id. Explosion = `charge_exploded`. Pick-up = `item_picked`. Gate = `gate_opened`.
   - Timers are state (`timeLeft` in battle and online, `boss.timer`). There is no timer event.
4. **Folders.** The brief's `src/ui/` and `src/render/` don't exist. Use `src/flow/radio_toast.ts` and `src/view/camera_rig.ts` (plus `hero_view.ts` for the highlight).

## 1. Kit radio toasts (`src/flow/radio_toast.ts`) — Story Mode only
Kit is the Story mode's radio voice. Battle vs Bot and Online have no Kit.

**Look:**
- A compact pill: Kit's 32 px portrait (from her atlas, `neutral`, or `worried` for danger lines), plus one line of text.
- Semi-transparent dark background with a cyan edge, about 15 px text.
- `pointer-events: none`, and `aria-live="polite"`.

**Motion:**
- Slides down about 0.25 s, stays 3 s, slides up.
- One toast at a time. The queue holds at most 3, and older duplicates are dropped.
- It never pauses the game and never takes input.
- `prefers-reduced-motion`: fade only.

**Triggers.** The brief's lines are adjusted to match the game and the canon:

| When | Line | Why changed |
|---|---|---|
| `gate_opened` (normal levels) | "Kit: Gate's open. Get to it, Bosco!" | Replaces the match-start line. The level card already gives Kit's briefing at the start. |
| Local player down to 1 heart (`player_died`, once per level) | "Kit: Hang in there, Bosco! Watch those Martians!" | Unchanged. |
| Oxygen Vest absorbs a hit (`armor_hit`, local) | "Kit: Vest took that one. Careful!" | New; the damage feedback the brief wanted. |
| Boss level, last wave starts (`boss_wave` = final wave) | "Kit: Last wave. Hold on!" | Replaces "Energy running out". Story levels have no clock, and there is no energy. |
| Power-up picked up, only **after** its intro card has been seen, at most once per item type per level | Beam Range+: "Kit: Longer beams. Nice." Extra Charge: "Kit: One more charge ready." Speed Boost: "Kit: Faster boots. Don't trip." Oxygen Vest: "Kit: Vest on. You can take a hit." Freeze Pulse: "Kit: Martians frozen. Move!" | "Core energy boosting" was off-canon: power-ups aren't the stolen cores. Toasting every pick-up would spam the player, and the first pick-up already shows a card. |

- Put the lines in `src/flow/radio_lines.ts`, a text-only file, so `script-integrator` can edit them.
- No toasts during cutscenes, cards, the pause menu or the countdown.
- On level 1, no toasts while the tutorial coach is showing.

## 2. Camera impact shake (`camera_rig.ts`, `game_view.ts`)
- **Signature:** `shake(strength 0..1)` replaces the seconds-based version. Update the 3 existing callers. Maze Shift = 0.5, and the boss cross attack = 0.8.
- **Explosions:** the strength comes from the Manhattan distance `d`, in tiles, between `charge_exploded` and the local player: `max(0, 1 - d / 7)`, scaled by 0.06. Explosions 7 or more tiles away don't shake.
  - Several explosions in one frame: use the strongest. Don't add them up.
  - Online with 4 players this stays calm, because only explosions near you count.
- **Decay:** a damped impulse, `offset = A · e^(−t/0.06) · sin(2π·18·t)` on x and z, plus a tiny roll. It is gone within 15 frames (0.25 s).
  - Time comes from the render loop's `dt` (view only, never sim time).
  - The offset is added after positioning and removed next frame, never stored in `base` or `look`.
- **Settings:** add **Screen shake: On / Off** next to Vibration, on by default. With `prefers-reduced-motion`, the default is Off.

## 3. Tile highlight under the player (`hero_view.ts`)
- A flat rounded square on the floor under the **local** player's current tile, at about 0.9 tile size.
- Colour: the player's own colour, at opacity 0.25 with a soft edge glow.
- It snaps to the tile the sim treats as the player's tile (`round(x / TILE)`), not the smooth in-between position, so it shows the cell coordinate. A short 60 ms slide between cells is fine.
- Hidden while the player is dead or respawning, and during cutscenes.
- Use one shared geometry, with `depthWrite: false` and `renderOrder` above the floor, so it doesn't flicker against the floor.

## Done when
- In Story mode the toasts appear for each trigger, queue without overlapping, and wait for alerts.
- No toasts in Battle or Online.
- An explosion right next to you shakes hard; one across the arena barely shakes or doesn't.
- The shake is gone within 0.25 s and the camera ends exactly where it started.
- Screen shake can be turned off.
- The highlight sits on the right tile.
- `npm test` and `npm run build` pass. Add tests for the toast queue (order, the cap, dropped duplicates) and the shake strength curve.
