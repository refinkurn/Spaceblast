# In-arena characters: low-poly figures + procedural animation

Decided by Refindo, 2026-10-23. View only: `src/view/`. Nothing in `src/sim/`.

## Direction
In the arena, characters are **low-poly 3D, built in code**: no model files and no new dependencies. The 2D pixel-art atlases stay for cutscenes, cards and the HUD.

## Already built (2026-10-23)
`src/view/hero_anim.ts` (`HeroAnimator`) runs on today's placeholder astronaut:
- **Idle breathing:** a small rise and tilt.
- **Run lean:** a forward lean while moving.
- **Charge squash:** 0.75 tall and 1.15 wide, springing back in about 120 ms. The owner of a charge is whoever stands on its tile.
- **Hurt:** a 200 ms shake plus a white flash on `player_died` and `armor_hit`.

The figure below plugs into the same animator and adds the limb swing.

## To build: the low-poly astronaut figure (`src/view/astronaut_mesh.ts`)
A small hierarchy of shared geometries and flat-shaded materials, replacing the spheres in `HeroView`:
- **Body:** torso (rounded box, suit colour = player colour), backpack (small box with a cyan light), and two arms on shoulder pivots ending in white gloves.
- **Legs:** two legs on hip pivots ending in white boots.
- **Head:** a glass helmet (translucent sphere) around the character's head.
  - **Bosco:** a corgi head in orange and cream, with two pointed ears, a white muzzle and a dark nose.
  - **Ducking (level 20 duel):** a duck head with a flat yellow bill. Suit dark violet, not the plain orange of other bots.
  - **Online players and battle bots:** Bosco's head, with the suit in their chosen colour.
- **Size:** about 0.9 tile tall at most, so it reads at the current camera. The feet sit on the floor at `y = 0`. Keep the facing (`-z` is forward) and the existing walk bob, celebrate, shield blink and Oxygen Vest bubble.
- **Performance:** about 14 meshes per astronaut with shared geometry, no lights per figure, and shadows from the torso only. It must hold 60 fps with 4 astronauts on a 2020 phone. At reduced quality, drop the backpack light and use one merged mesh per limb.

## Animation on the figure (extend `HeroAnimator`)
- **Running:** a 4-phase swing. Legs swing ±35° on the hips, arms ±25° opposite to the legs, and the torso dips slightly on each step. The cycle speed follows the actual movement speed, so Speed Boost levels run faster. Blend in and out over about 80 ms.
- **Idle:** arms hang, a slow breathing rise, and the head tilts a little.
- **Charge drop:** the existing squash, plus a quick arm-forward "place" motion (100 ms).
- **Hurt:** the existing shake and flash, plus arms thrown up.
- **Celebrate:** the existing hop and spin, plus arms up.
- **Martians:** keep their blob bodies and the wobble they already have; no limbs.

## Done when
- Bosco, Ducking (level 20) and online players use the new figure. The run cycle reads clearly on a phone, and the feet don't slide much at normal speed.
- The squash, hurt, celebrate, shield blink and vest bubble all still work.
- There is no frame drop with 4 players (check the stats line in online play).
- `npm test` and `npm run build` pass, with tests for the limb angles (in phase, within limits, back to rest when stopping).
