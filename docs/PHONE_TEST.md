# Phone test checklist

Things built since 2026-10-21 that no one has seen on a real phone. Run it in one sitting (about 20 minutes), landscape, on https://spaceblast.vercel.app.
Tick what works. For anything wrong, write one line under "Found" (screen, what you did, what happened) and tell the design chat; it becomes a Ready item.

Run 2026-10-31 by Refindo on iPhone 11 (Safari + home screen) and a Meizu phone. Everything passed except the two lines under Found, both queued in HANDOFF.md Ready.

## Menus and screens
- [x] Menu: icon + label items, Back pinned top-left on every page, black micro-fade between screens
- [x] Settings and How to Play open as a centred card; ‹ › selectors work by touch
- [x] Level card: one centred box, launch button reachable
- [x] HUD: Sound / Pause / Full screen grouped top-right, not over the hearts; notch does not cut anything
- [x] HUD: CHARGE button looks like a solid plasma charge; power-up icons readable; Bosco portrait in the avatar
- [x] Pause during 3-2-1-BLAST!: nothing draws over the pause card

## Play feel (Story level 1-3, then a Battle vs Bot round)
- [x] 3-2-1-BLAST! count, red damage vignette, vibration on Charge and on hit (Android)
- [x] Low-poly astronaut: run cycle, arms forward on Charge, frame rate stays smooth
- [x] Oxygen Vest bubble pulses; Speed Boost trail appears when moving
- [x] Touch controls stay in the side gutters; buttons feel at least finger-sized

## Online (two phones, or phone + PC)
- [x] Lobby fits sideways with no scrolling; colour strip scrolls by swipe
- [x] Invite button opens the share sheet; the link opens Multiplayer with the code filled in
- [x] Astronauts glide, no shaking; your own moves respond instantly
- [x] Turn Wi-Fi off for 5 s mid-round: "Reconnecting…" shows, then the round continues

## Offline
- [x] Open the game once, then airplane mode: Story and Battle vs Bot still open
- [x] Installed to home screen (iOS): opens offline too

- [ ] Ducking v0.3 (clear helmet, eyepatch, cape, V emblem): check him in every cutscene where he speaks (portraits) and in his full-body poses; check Kit's worried and relieved portrait lines
- [ ] Balance (2026-11-03): Star Dots (small golden gems) show under about a third of the rocks in Story and are easy to see on every sector's floor; picking one blips and adds to the score; pink Hungry Gooplings in 1-3/1-4 chase you when close but can still be outrun

## Found
- iPhone 11, opened from the home screen: sometimes the bottom of the screen is cropped a little.
- Meizu: the floating joystick does not open wherever the thumb lands on the left side.
