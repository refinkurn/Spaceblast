# Roadmap

Refindo owns this file: it is the vision. Agents work from it and never change it on their own. The Producer turns the current milestone into Ready items in docs/HANDOFF.md; anything not covered here goes to Blocked as a question for Refindo.

Status: DRAFT 2026-10-31. Items marked **(decide)** need Refindo before the Producer queues them.

## Vision

Spaceblast is Bomberman meets Pac-Man with Nintendo-style storytelling: Bosco the corgi Astropaw, stranded on forbidden Mars, beats the Martian hives and captures Ducking. Retro pixel characters, low-poly 3D arena, playful tone with a noir villain, family-friendly.

- Players: millennials and early Gen Z retro fans, higher-RPM countries first.
- Platform: web first (phone browser, landscape), apps later via Capacitor.
- Main goal: online multiplayer. Story mode is the hook and the tutorial.
- Business: ad revenue first; paid acquisition only once the numbers show a player is worth more than they cost.

## Pillars (every item must serve one)

1. Feels great on a phone in 10 seconds: instant load, clear controls, juicy hits.
2. Story worth finishing: 20 levels, 4 sectors, one new idea per level.
3. Online that just works: invite link, no login, no desync.
4. Measured: every decision after launch is backed by numbers.

## Milestones

### M0. Launch-ready (now)
- Phone checklist cleared (docs/PHONE_TEST.md) and its findings fixed.
- Automated phone-size screenshots of key screens in CI on every push (Playwright; fails on a blank or broken screen).
- Analytics: free Cloudflare Web Analytics for traffic, plus game events stored by our own server: session start, level start/clear/fail, story progress, online round played, session length, returning player (day 1 / day 7). No personal data, no cookies needed.
- Art gaps closed: Ducking full-body and portraits, Kit worried/relieved, 9:16 menu key art (prompts in the project doc asset-regeneration-prompts.md); 3D Ducking in canon colours.
- Balance proposal resolved **(decide)**.

### M1. Soft launch on CrazyGames (Basic Launch)
- Build a portal version: game files only, rooms still on our Cloudflare server, no external login, no external ads, no outside links in play.
- Listing pack: description, controls, cover images and a short gameplay video.
- Goal: real players and real numbers. Basic Launch shows the game to a small slice of players and has no monetisation; that is fine, this milestone is about data.
- Exit when: 2-4 weeks of data; we know day-1 retention, story level drop-off and online rounds per player.

### M2. Monetise (CrazyGames Full Launch)
- CrazyGames SDK: GameplayStart/stop, ads only through the SDK (between levels and after rounds, never mid-play), a rewarded ad for an optional bonus: one extra heart when retrying a Story level (Refindo, 2026-10-31), works with ad blockers.
- Multiplayer items they ask for: room info, invite link, instant join, rooms kept across rounds, chat off switch (we have no chat).
- Account items: use the CrazyGames username for the leaderboard name, progress linked to their account.
- Login comes before any purchase: today players have no account (a device profile only), so a purchase would be lost with the device. Step 1 is CrazyGames account login (their auto-login, progress saved to the account) inside the portal build. A login of our own for the website comes only if purchases are sold there **(decide then)**.
- Payout: monthly from EUR 100 by wire or PayPal **(Refindo sets up the account and payment details)**.

### M3. Grow
- Weekly metrics report and one experiment per week (ad placement, first-level pacing, rewarded reward).
- Own site (spaceblast.vercel.app) keeps working for invites and players who find us directly.
- Apps via Capacitor (postponed item in HANDOFF) once retention justifies the store fees.
- In-game purchases (cosmetics, not power): only after login works. On CrazyGames purchases are invite-only (Xsolla, after Full Launch), so we apply once the numbers are good **(decide items and prices)**.
- Paid acquisition only when lifetime value per player is measured **(decide budget)**.

## Monetisation path

Chosen order: CrazyGames first, then apps. Why:
- CrazyGames takes open submissions, is non-exclusive and runs our own multiplayer server; Basic Launch is a free soft launch that gives the data we lack.
- Poki pays 100% on players we bring and 50/50 on theirs, but it is selective (closed beta, they contact you) and requires web exclusivity, which clashes with CrazyGames and our own site. Revisit only if Poki reaches out, or if CrazyGames numbers are strong enough to make the switch worth it **(decide then)**.
- Own-site ads (Google H5 Games Ads) need traffic and approval first; not before M3.
- App stores cost fees and need paid traffic to be found; not before M3.

## Always Refindo's call (agents prepare, Refindo approves)

Spending money; creating accounts (CrazyGames, Poki, AdSense, app stores); legal, tax and payment forms; submitting or publishing a build to any portal or store; changes to this file; changes to game rules or canon.
