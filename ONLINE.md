# Online rooms (room codes)

Play Battle with 2–4 friends: one person taps **Play online → Create room**
and shares the 4-letter code; the others tap **Play online**, type the code
and **Join**. The host taps **Start match**. First to 3 round wins takes it.

## How it works (short version)

- Every phone runs the same game. Only button presses travel over the
  network (about 30 tiny messages a second per player), never the game
  itself. This is called *lockstep* and it is why `src/sim` must stay
  deterministic.
- Your input is used 0.1 s after you press it, so it reaches everyone in
  time. If someone's connection hiccups, everybody waits a moment.
- The server is a small relay: it seats players, lets the host start
  rounds and forwards inputs in order (`server/room.ts`).
- Every second the phones compare a fingerprint of the game state. If they
  ever differ, the game shows "Out of sync" (that would be a bug in `src/sim`).

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
- `src/net/lockstep.ts` — input delay and waiting for everyone's input
- `src/net/client.ts` — the WebSocket connection
- `src/flow/online.ts` — create / join / lobby screens
- `server/room.ts` — the relay logic (shared by both servers below)
- `server/dev_relay.ts` — relay inside `npm run dev`
- `server/worker.ts` + `wrangler.toml` — the Cloudflare server

## Leaving the app

If a player switches apps or locks their phone, the others see "Waiting for
Player N…". After 8 seconds that player is dropped from the room (their
astronaut is out for the round) and the match goes on. They see a message and
can join again with the code from the next round.

## Not done yet

- Reconnecting after a dropped connection.
- Online co-op Story Mode.
