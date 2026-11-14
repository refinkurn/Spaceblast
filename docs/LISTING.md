# Portal listing (CrazyGames)

Everything to paste into the CrazyGames submission form. Refindo submits; agents keep this file and `listing/` current. Rules read from docs.crazygames.com (Game covers) on 2026-11-14: re-read before submitting.

## Text

**Title:** Spaceblast

**Short description (one line):**
Blast through Martian mazes as Bosco the corgi astronaut. Drop plasma charges, grab power-ups, find the Warp Gate, and battle friends online.

**Description:**
Spaceblast is a fast grid battle game with a story. You are Bosco, a young corgi pilot who ignored his captain's order and crash-landed on Mars, a planet the whole galaxy is forbidden to visit. Your ship's power cores are gone, the Martians are hungry, and someone down there is giving them orders.

Drop plasma charges to break rocks and clear a path, collect power-ups hidden inside, and step away before the blast. Find the Warp Gate to go deeper: across dusty valleys, an abandoned mining colony, a crystal cavern and a secret lab.

- Story mode: 20 levels in 4 sectors, each with a new kind of Martian and a new hazard, three bosses to outlast and a final duel.
- Battle mode: last astronaut standing wins the round. Play against a bot, or online with 2 to 4 players using a room code.
- Five power-ups: longer beams, extra charges, speed, a freeze pulse and an oxygen vest that takes a hit for you.
- Earn up to three stars per level and climb the leaderboard.
- Works with keyboard and mouse, or touch on a phone.

**Controls (desktop):**
- Move: arrow keys or WASD
- Drop a plasma charge: Space, X, or left click on the arena
- Pause: P or Escape

**Controls (mobile):**
- Move: the stick on the left side of the screen
- Drop a plasma charge: the CHARGE button on the right

**Category:** Action (alternatives if asked for more: Arcade, Multiplayer, Bomb)
**Tags to pick if offered:** bomb, maze, arcade, multiplayer, 2 player, space, animal, retro, survival, 3D
**Orientation:** Landscape. **Devices:** desktop and mobile. **Players:** single player and online multiplayer (2-4).
**Age:** suitable for everyone (cartoon knock-outs, no blood, no chat, no purchases, no ads of our own).
**Multiplayer note for reviewers:** online rooms run on our own server (Cloudflare); players join with a 4-letter room code. No login.
**Privacy:** the Privacy link in the game's menu. Anonymous gameplay events only, no personal data, no cookies.

## Covers (in `listing/`)

Made by `node scripts/listing_covers.mjs` from the menu key art and the game's title type. Only the game's name as text, no borders, no icons.

| File | Size | For |
|---|---|---|
| `listing/cover-landscape.jpg` | 1920x1080 (16:9) | landscape cover |
| `listing/cover-portrait.jpg` | 800x1200 (2:3) | portrait cover |
| `listing/cover-square.jpg` | 800x800 (1:1) | square cover |

Note: the key art shows Captain Kit standing beside Bosco; in the story Kit is radio only. It is the same art as the game's menu, so the listing matches what players see. Replace it here when the new 9:16 menu art exists (run the script again).

## Videos (in `listing/`)

Silent H.264, 30 fps, real gameplay at true speed (a bot plays; recorded frame by frame with `node scripts/listing_capture.mjs`, joined with ffmpeg). Each opens on its static cover, no cursor, no black bars, no promotional text.

| File | Size | Length | Shows |
|---|---|---|---|
| `listing/video-landscape.mp4` | 1920x1080 (16:9) | 15.2 s | cover, Story level 1-3 (Gooplings, Hungry Gooplings), a Battle vs Bot round with a cross blast |
| `listing/video-portrait.mp4` | 1080x1620 (2:3) | 15.3 s | cover, Story level 1-3, a Battle vs Bot round in the crystal cavern arena |

The game is landscape-only, so in the portrait video the arena is small in the middle of the frame. If CrazyGames rejects it, a cropped close-up version is the fix (agents can make it).
