# Online rooms (room codes)

Play Battle with friends: type your name, tap **Play online → Create room**
and share the 4-letter code; the others type their name and the code and tap
**Join**. In the lobby everyone picks a colour. The host picks:

- **Round time**: 60s, 90s, 2:00, 2:30 or 3:00. When it runs out the arena
  collapses: blocks fall from the edge inwards and crush anyone underneath.
- **Scenarios**: Maze Shift and/or Blackout, at random moments (with the usual
  3 s warning).
- **Match**: Best of 3 (first to 2 round wins) or First to 3 wins.
- **Bots**: fill empty seats, Easy / Normal / Hard. Players + bots = 4 at
  most; the host can even play alone against bots.

After each round a short cinematic replays the last knock-out in slow motion
and shows the winner. When someone wins the match everyone sees the
congratulations screen, then "Back to room" returns to the lobby for the next
match. Blackouts never overlap the arena collapse.

## How it works (short version)

- Every phone runs the same game. Only button presses travel over the
  network, never the game itself, which is why `src/sim` must stay
  deterministic.
- The room server keeps the clock: 60 times a second it sends everyone's
  presses for that moment. Each phone plays those moments in order, so all
  games stay identical.
- **A slow connection only hurts its owner.** A press that reaches the
  server late doesn't hold anyone up: that astronaut keeps doing what it was
  doing. Each phone measures its own ping and sends its presses just early
  enough for its connection (a bad connection means slower controls for
  that player only, and a "Weak connection" note).
- **Your own astronaut answers at once.** Your presses only reach the shared
  game a round trip later, so your phone also draws your astronaut (and your
  new charges) from a private look-ahead copy of the game played with your
  latest presses. The shared game is never changed by it, so it can't cause
  a desync; if the guess was wrong (someone's charge blocked you), your
  astronaut snaps to the real spot. See `src/net/predict.ts`.
- **Dropped connection:** the phone reconnects by itself and replays the
  round so far to catch up; the others just see "Bo lost connection,
  reconnecting…". After a page reload, Play online shows "Rejoin room".
  Someone gone for more than 20 seconds is out for that round.
- Every second the phones compare a fingerprint of the game state. If they
  ever differ, the game shows "Out of sync" (that would be a bug in `src/sim`).

## The stats line (finding lag)

During online rounds a small line at the bottom shows, for this phone:

- `SIN` — where the room runs: the Cloudflare data centre (rooms are placed
  in Asia-Pacific; see `ROOM_REGION` in `server/worker.ts`), or on Fly.io
  always `SIN`.
- `ping 24±3 ms` — round trip to the room, and how much it wobbles.
  High ping = the server is far; big wobble = an uneven connection (Wi-Fi).
- `buffer 2+0` — updates held back to smooth out wobble, plus any backlog.
  A growing second number means this phone is falling behind.
- `late 0` — your presses that reached the server too late (counted per round).
- `ahead 9` — how many ticks your own astronaut is drawn ahead of the shared game.
- `60 fps · slowest 18 ms · work 4 ms` — frame rate, the slowest frame and
  the most time one frame took to run the game and draw (over 2 s).
  Low fps with high work = the phone itself is the bottleneck.

A screenshot from each phone during a laggy moment tells which it is. Open
the game with `?nostats` at the end of the address to hide the line.

## Test on your computer

    npm run dev

Open the address it prints in two browser tabs (or on a phone on the same
Wi-Fi), create a room in one and join it from the other. The relay runs
inside the dev server, nothing else to set up.

## Where it runs now (free)

Two free services, one for the page and one for the live connections:

- **Game page: Vercel**, https://spaceblast.vercel.app (project
  `space-blast/spaceblast`, linked to the GitHub repo). Every push builds
  it: `main` becomes the live page, other branches get preview links.
  Vercel can't keep live connections open, so the page talks to Cloudflare:
  in Vercel → Settings → Environment Variables (Production and Preview),
  `VITE_RELAY_URL=wss://spaceblast.refinkurn.workers.dev` and
  `VITE_API_BASE=https://spaceblast.refinkurn.workers.dev`. They are read at
  build time, so redeploy after changing them.
- **Rooms + leaderboard: Cloudflare**, https://spaceblast.refinkurn.workers.dev
  (`server/worker.ts`; it also serves its own copy of the page). Pushing to
  GitHub does **not** update it: after a change in `server/`, `src/net/` or
  the score rules, run `npm run deploy`. A change to the messages
  (`src/net/protocol.ts`) needs both: `npm run deploy` and a push.

Cloudflare from scratch (free plan, no card):

1. Make a free account at https://dash.cloudflare.com/sign-up
2. In the `spaceblast` folder run `npx wrangler login` (opens the browser
   to approve).
3. Run `npm run deploy`. It prints the link, like
   `https://spaceblast.<your-name>.workers.dev`; put that in the two Vercel
   variables above.

Free plan limits are plenty for testing (roughly a few hundred matches a
day). If it ever grows past that, the paid Workers plan is $5/month.

Note: the claude.ai preview link can't open rooms; use the Vercel link.

## Rooms on Fly.io (Singapore) — ready, not deployed

The rooms and the leaderboard can run on one Fly.io machine in Singapore
(`sin`) instead, so every room is in the same place, close to players in
South-East Asia. The game page stays on Vercel. Not deployed because Fly is
not free: one small always-on machine plus a 1 GB volume is a few dollars a
month (no Fly app or volume exists yet).

One-time setup (Windows PowerShell, in the `spaceblast` folder):

1. Install the Fly command line: `iwr https://fly.io/install.ps1 -useb | iex`,
   then `fly auth login` (opens the browser to approve).
2. `fly apps create spaceblast-server --org <your-org>` (`fly orgs list` shows
   it; if the name is taken, pick another and change `app` in `fly.toml` and
   the addresses below).
3. `fly volumes create spaceblast_data --region sin --size 1 --app spaceblast-server`
   (the leaderboard's SQLite file lives on it).
4. `npm run deploy:fly`. `https://spaceblast-server.fly.dev/healthz` should say `ok`.
5. Point the game page at it: in Vercel set

       VITE_RELAY_URL=wss://spaceblast-server.fly.dev
       VITE_API_BASE=https://spaceblast-server.fly.dev

   and redeploy. The stats line in an online round shows `SIN`.

Run `npm run deploy:fly` again after a server change. Good to know:

- **Exactly one machine.** Rooms live in its memory, so a second machine
  would split a room's players. `deploy:fly` passes `--ha=false` for that;
  never `fly scale count 2`.
- **A deploy restarts the machine and ends every room in progress.** Deploy
  when nobody is playing.
- `fly logs` shows the server's output, `fly status` the machine.
- Shared CPU: if rounds stutter only when many rooms are busy, a bigger
  machine (`[[vm]]` in `fly.toml`) is the fix.
- Going back to Cloudflare rooms: set the two Vercel variables back to the
  `workers.dev` addresses and redeploy. The Cloudflare rooms keep working meanwhile.
- Fly scores start empty: the Cloudflare leaderboard isn't copied over.

## Files

- `src/net/protocol.ts` — messages and room code rules
- `src/net/frames.ts` — plays the server's frames, aims your presses ahead by your ping
- `src/net/predict.ts` — draws your own astronaut from your latest presses
- `src/net/link.ts` — the connection: ping, automatic reconnect, rejoin after reload
- `src/net/client.ts` — the WebSocket connection
- `src/flow/online.ts` — create / join / lobby screens
- `server/room.ts` — the room: seats, settings, the round clock, rejoining (shared by all the servers below)
- `server/node_host.ts` — rooms and `/api/scores` on Node (shared by the dev relay and Fly)
- `server/dev_relay.ts` — relay inside `npm run dev`
- `server/fly.ts` + `Dockerfile` + `fly.toml` — the Fly.io server (`npm run build:server` builds it into `dist-server/`)
- `server/node_sqlite.ts` — the Fly leaderboard's SQLite file (Node's built-in `node:sqlite`)
- `server/worker.ts` + `wrangler.toml` — the Cloudflare server

## Leaving the app

If a player switches apps or locks their phone, the others see them as away.
If the connection dropped, their seat is kept for 20 seconds (`REJOIN_MS`)
so the phone can rejoin by itself; a connection that stays open but sends
nothing for 30 seconds (`SILENT_MS` in `server/room.ts`) is closed. Either
way, after that the player is out of the room (their astronaut is out for
the round) and the match goes on. They see a message and can join again
with the code, playing from the next round.

## Not done yet

- Online co-op Story Mode.

## Hosting and databases

- **Why rooms aren't on Vercel:** Vercel hosts the page for free, but its
  functions stop after each request, so it can't keep the live connections
  an online game needs. Cloudflare (free) or Fly.io (paid) run the rooms.
- **Database:** the leaderboard is SQLite inside a Cloudflare Durable Object
  (free plan); on Fly it would be a SQLite file on the volume. Progress and
  settings still live on each device. For accounts or cloud saves later,
  Cloudflare D1 is the natural choice; saving goes through
  `src/flow/progress.ts` and `src/flow/settings.ts`, so that is the one
  place to switch over.
