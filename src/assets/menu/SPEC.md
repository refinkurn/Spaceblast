# Main Menu Background - Asset Specification

**Project:** Spaceblast
**Asset:** Main menu key art (3 Astropaws on Mars)
**Version:** 0.1 (2026-10-18)
**Status:** Usable placeholder. Needs a higher-resolution, layered source before final.

## Files

| File | Use |
|---|---|
| `background/menu_bg_1920x1080.webp` | Default (web-mobile). About 240 KB |
| `background/menu_bg_1920x1080.jpg` | Fallback for browsers without WebP |
| `background/menu_bg_1280x720.webp` / `.jpg` | Low-end devices / slow connections |
| `overlay/menu_left_gradient_1920x1080.png` | Readability gradient for the menu text (separate so it can be tuned) |
| `menu_layout.json` | Focal point, safe areas, fit mode, in normalized 0-1 coordinates |

## Rendering rules

1. **Orientation:** landscape only.
2. **Fit:** `cover`. Scale the background to fill the screen, then crop around the focal point (hero dog's head, x 0.70, y 0.30). Never stretch.
3. **Layer order:** background, then gradient overlay (stretched to screen), then menu UI.
4. **Filtering:** smooth (bilinear) is fine here. This is painted art, unlike the pixel sprites, which need nearest-neighbor.
5. **Menu UI** goes inside `menu_safe_area`, the title inside `title_area`. Nothing goes over `character_zone`.

## Screen-shape behavior

| Screen | Result |
|---|---|
| 16:9 | Full image |
| 19.5:9 / 20:9 phones | Bottom ~18% (rocks) cropped. Characters and menu safe. Keep menu text 9% of screen height in from the left for notches |
| 4:3 tablets | Left ~25% cropped. Menu column overlaps the cat. Shrink the menu or accept |

## Open items (art)

1. Resolution: 1671x941 source is upscaled slightly to 1920x1080. Request 2560x1440 or larger for sharp results on high-DPI phones.
2. Layers: request background, characters and foreground rocks as separate layers for parallax and safer cropping.
3. Character consistency: the dog here (orange suit, scarf, no helmet) does not match the in-game corgi (blue suit, glass helmet, sneakers, pink badge).
4. Confirm the cat and capybara are in the game.
5. Style: painted menu vs pixel-art gameplay. Fine if deliberate.
