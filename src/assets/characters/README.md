# Character art

Everything here is data: new or changed art needs no code changes.
One folder per character, named by its id (`astropaw`, `captain-kit`, ...).

## character.json (the manifest, required)

```json
{
  "id": "astropaw",
  "name": "Astropaw",
  "label": "ASTROPAW",
  "color": "#3a7bff",
  "pixelArt": true,
  "body": { "atlas": "hero_fullbody_atlas.json" },
  "portrait": { "atlas": "hero_portrait_atlas.json", "frames": { "neutral": "hero_portrait_neutral" } },
  "poses": { "neutral": "idle", "surprised": "shocked", "happy": "victory" }
}
```

- `poses`: the pose names scenes use (`pose: 'surprised'` in story_scenes.ts),
  each mapped to an animation in the body atlas. A pose that isn't listed
  falls back to `neutral`, then to the first pose.
- `body` / `portrait`: optional. Without them the game draws a placeholder card
  in `color` with `label` and the pose name.
- `portrait.frames`: pose -> portrait frame for the dialogue box; missing poses
  use the neutral portrait. No portrait at all: the box shows the body frame.
- `pixelArt`: true scales by whole multiples with no smoothing.
- Portrait-only characters (Captain Kit: radio only, no `body`) show their
  portrait in the scene's big slot as well as in the dialogue box.

## Atlases (the art team's export format)

`<name>_atlas.json` + the PNG named in `meta.image`, in the same folder:
`frames` (name -> x, y, w, h, pivot) and `animations` (name -> fps, loop,
frames). Looping animations cycle; the others hold their last frame. The pivot
(feet, or the bottom of a bust) stands on the bottom centre of the space.
Keep each atlas at 1024 px per side or less.

To replace art: drop in the new atlas JSON + PNG (same names, or update
`body.atlas` / `portrait.atlas`), then check `poses` still names animations
that exist. `npm test` checks every manifest and atlas.

The art team's specs live next to each atlas: astropaw/bosco-sprite-spec.md,
ducking/ducking-sprite-spec.md, captain-kit/kit-portrait-spec.md. All art faces
right; the scene shows characters on the left, facing the dialogue.
