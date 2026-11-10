# Portal build (CrazyGames)

How Spaceblast goes onto a web portal. Rules read from docs.crazygames.com on 2026-11-10; re-read them before each submission. Refindo creates the account and submits; agents prepare.

## Make the build

`npm run build:portal` writes `dist-portal/` and `spaceblast-portal.zip` (the file to upload) and checks the limits below. Every push also builds the zip in GitHub Actions (Test run, artifact "spaceblast-portal").

What a portal build changes (`src/config/portal.ts`, `VITE_PORTAL=crazygames`):
- no full screen buttons of our own (the portal provides full screen; a custom button is prohibited)
- no "add to Home Screen" tip, web manifest or service worker
- no invite-link button (the link would point at our own site; the room code still shows)
- no Cloudflare Web Analytics beacon (our anonymous game events still go to our server)
- the page talks to our room server at spaceblast.refinkurn.workers.dev

Online rooms seat one build only. Portal players therefore meet players on our own site only when both run the same commit: **upload a fresh zip after every push that changes the game**, or portal players will only meet each other.

## CrazyGames rules that matter to us

| Rule | Limit | Spaceblast |
|---|---|---|
| Initial download | 50 MB; 20 MB to be on the mobile homepage | about 1.5 MB |
| File count | 1500 | 19 |
| Paths | relative only | yes (`base: './'`), checked by the build script |
| Browsers | Chrome and Edge; Safari or it is switched off there; smooth on a 4 GB Chromebook | not yet tested on a Chromebook |
| Controls | mouse + keyboard, and touch on mobile; no touch controls shown to desktop players | on-screen stick hides without touch (`src/input/input_mode.ts`) |
| Screen sizes | readable at 800x450 (mobile), 907x510, 1366x768, 1920x1080... | `npm run shots` covers 800x450 and 907x510 |
| Physics | same at 144 Hz as at 60 Hz | fixed 60-tick loop |
| Language | English | yes |
| Full screen | no custom button | hidden in the portal build |
| Links | no cross-promotion, no links to a playable web version, no app store links; a privacy page is allowed | only the Privacy link |
| Ads | none of our own; no ads at all during Basic Launch | none |
| Login | no outside login | none |
| Age | PEGI 12 | family-friendly |
| Orientation | set landscape in the submission; the site handles rotation | landscape |

## The two steps

1. **Basic Launch** (soft launch, no SDK needed, no ads). Lasts until the game has been live 7 days **and** has 500 plays; it ends at 21 days regardless. Updates go live at once. The numbers they judge:
   - average play time: strong games see 10+ minutes
   - day-1 retention: strong games see 10-15%
   - conversion (players who stay at least 1 minute): top games 80%+, loading under 10 s
2. **Full Launch** (if the numbers are good): the CrazyGames SDK becomes mandatory. Needed then:
   - gameplay start/stop events; ads only through the SDK (between levels and after rounds), and the game must work with an ad blocker
   - new players land in gameplay at once (one click at most): our start screen, menu and opening crawl must shorten for first-time portal players
   - progress saved to the CrazyGames account (their data module), their username on the leaderboard, automatic login
   - multiplayer: room info, invite link through their SDK, instant join, rooms kept across rounds
   - payouts: monthly through Tipalti once earnings reach EUR 100 (set up billing in the developer page early). The revenue share is in their Terms, not in the docs.

## Submission checklist (Refindo)

- [ ] Developer account at developer.crazygames.com
- [ ] Upload `spaceblast-portal.zip`; orientation landscape; desktop + mobile
- [ ] Test in their preview tool (QA tool) on a phone and a computer
- [ ] Listing: description, controls, 3 covers and 2 videos (sizes: their "Game covers" page)
- [ ] Billing details (Account -> Billing), so payouts are not delayed later
