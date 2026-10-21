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

- `SIN` — the Cloudflare data centre the room runs in (rooms are placed in
  Asia-Pacific; see `ROOM_REGION` in `server/worker.ts`).
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

## Put it online for friends (free)

Cloudflare hosts both the game page and the rooms. Free plan, no card.

1. Make a free account at https://dash.cloudflare.com/sign-up
2. In the `spaceblast` folder run `npx wrangler login` (opens the browser
   to approve).
3. Run `npm run deploy`.
4. It prints your link, like `https://spaceblast.<your-name>.workers.dev`.
   Send that to friends. Run `npm run deploy` again after every change.

Free plan limits are plenty for testing (roughly a few hundred matches a
day). If it ever grows past that, the paid Workers plan is $5/month.

Note: the claude.ai preview link can't open rooms; use the Cloudflare link.

## Files

- `src/net/protocol.ts` — messages and room code rules
- `src/net/frames.ts` — plays the server's frames, aims your presses ahead by your ping
- `src/net/predict.ts` — draws your own astronaut from your latest presses
- `src/net/link.ts` — the connection: ping, automatic reconnect, rejoin after reload
- `src/net/client.ts` — the WebSocket connection
- `src/flow/online.ts` — create / join / lobby screens
- `server/room.ts` — the room: seats, settings, the round clock, rejoining (shared by both servers below)
- `server/dev_relay.ts` — relay inside `npm run dev`
- `server/worker.ts` + `wrangler.toml` — the Cloudflare server

## Leaving the app

If a player switches apps or locks their phone, the others see "Waiting for
Player N…". After 8 seconds that player is dropped from the room (their
astronaut is out for the round) and the match goes on. They see a message and
can join again with the code from the next round.

## Not done yet

- Online co-op Story Mode.

## Hosting and databases (for later)

- **Why Cloudflare and not Vercel:** Vercel can host the web page for free,
  but it can't keep the live connections an online game needs (its
  functions stop after each request). Cloudflare runs both the page and the
  rooms on one free account. The page could still move to Vercel later:
  build it with `VITE_RELAY_URL=wss://spaceblast.<you>.workers.dev` and it
  will use the Cloudflare rooms.
- **Database:** not needed yet (progress and settings live on each device).
  For accounts, cloud saves or leaderboards later, Cloudflare D1 (a free
  SQL database on the same account) is the natural choice; Supabase or
  Firebase also have free tiers. Saving goes through `src/flow/progress.ts`
  and `src/flow/settings.ts`, so that is the one place to switch over.
