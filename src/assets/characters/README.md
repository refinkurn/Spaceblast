# Character sprites

One folder per character, named by its id (`captain-kit`, `astropaw`, ...):

- `<id>.json`: pose metadata (this is what the game reads).
- `<id>.png`: the sprite sheet. Optional: without it the game draws a coloured
  placeholder card with the character's label and pose.

Sheet layout (old Nintendo style): one pose per row, its frames left to right,
every frame the same size (`frameWidth` x `frameHeight`, 128 x 128 for now).
Keep a sheet at 512 x 512 or less and save it as an indexed-colour PNG
(256 colours or fewer) to keep the download and phone memory small.

```json
{
  "character": "captain-kit",
  "name": "Captain Kit",
  "label": "KIT",
  "color": "#ffd23f",
  "frameWidth": 128,
  "frameHeight": 128,
  "poses": {
    "neutral": { "row": 0, "frames": 4, "duration": 100 }
  }
}
```

`duration` is milliseconds per frame. A scene shot picks a pose with
`pose: 'worried'`; a pose the sheet doesn't have falls back to `neutral`, then
to the first pose listed. New poses and characters need no code changes: add
the row to the sheet and the line to the JSON.
