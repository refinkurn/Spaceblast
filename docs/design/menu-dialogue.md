# Menu + story dialogue (restyle)

Decided by Refindo, 2026-10-21. This is UI only: no changes in `src/sim/`, `src/net/` or `server/`. Everything in this spec is a restyle of what already exists in `src/flow/menu.ts`, `src/flow/cutscene.ts`, `index.html` and `src/style.css`.

## Rules that stay
- Respect `env(safe-area-inset-*)` on all four sides. Touch targets are at least 48 px.
- The menu's right side keeps the 2D art (the `menu.json` background plus the `menu-hero` sprite). No 3D models.
- Scenes pause the game through `cutscene.active`, as now. Skip calls the scene's own end callback. It never sends a sim command.

## 1. Main menu: 4 buttons, left column
The main menu (`#menu-main`) has four buttons: **Story Mode**, **Versus**, **Settings**, **Credits**.

- **Versus** opens a new page in the same left column (`MenuPage` `'versus'`) with two buttons:
  - **Battle vs Bot** opens the existing difficulty page (`'bot'`). Its Back returns to Versus.
  - **Multiplayer** opens the existing online flow, as `mode-online` does now.
- **Settings** gets a **How to Play** button that opens the existing `'howto'` page. Back from How to Play returns to Settings, not to the main menu.
- Remove the How to Play button from the main page. Keyboard and arrow navigation must still work on every page.
- The 4-button stack stays under 280 px tall: 48 px buttons with 8 px gaps comes to about 216 px. The title can sit above it, outside that limit.
- On every sub-page, **Back** is pinned top-left of the left panel (48 px), instead of at the bottom of the list. Escape still goes back.
- Long pages (Settings, How to Play, Credits) scroll inside the panel (`.menu-scroll`). The page itself never scrolls.
- **Multiplayer lobby** (`#online`): align it to the left panel width (`min(420px, 46vw)`) instead of the centred 800 px card, so the menu art shows on the right. It scrolls inside itself, and Back is pinned top-left.

## 2. Story dialogue: slim full-width banner
- The banner (`.cut-box`) is pinned to the bottom edge, full width. Keep the bottom safe-area padding.
  - Height is about 84 px for 2 lines. It may grow to fit a third line rather than cut text off.
  - Background is dark and semi-transparent.
- The portrait (`#cut-portrait`) is 64×64 px on the banner's left.
- The speaker name is 12–13 px, bold, uppercase, in the speaker's accent colour.
- Dialogue text is **16 px minimum** (`clamp(16px, 2.4vw, 20px)`), 2 lines.
- The standing character sprite (`.cut-sprite`) stays on the left, above the banner. It must not cover the banner.
- Skip stays top-right: at least 64×48 px, and labelled `Skip ›`. No emoji.
- Typewriter logic is unchanged: a tap while typing shows the whole line, and a tap when the line is complete goes to the next one.
- Narration lines (no speaker): hide the portrait slot and show the text in italic, as now.
- Cards that reuse cutscene shots (`intro_card.ts`) are not part of this change.

## Done when
- The menu shows 4 buttons. Versus → Battle vs Bot and Versus → Multiplayer both work. Settings → How to Play → Back returns to Settings.
- On a 740×360 landscape viewport:
  - The menu never scrolls the page.
  - The prologue scene shows the slim banner with readable text, and the sprite doesn't overlap it.
- `npm test` and `npm run build` pass.
