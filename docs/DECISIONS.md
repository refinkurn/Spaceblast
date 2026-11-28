# Decisions

Decisions agents made without waiting for Refindo, newest first. Tier 1 = reversible and inside what the roadmap, canon, rules and design already say. Tier 2 = players will notice it, still easy to undo: Refindo has until the "Veto by" date to say no (tell the design chat "veto D-n"); silence means accepted.

## D-5 Pause "Restart level" keeps a watched-for heart (2026-11-28, Tier 2)
Decided: after a rewarded "+1 heart (ad)" retry, restarting the level from the pause menu keeps the 4th heart. A game over still resets to 3. Why: the player paid for the heart by watching an ad; taking it away on a restart would feel like a broken promise. Rejected: reset to 3 on restart (simpler, but punishes a paying player). Revert: drop the last argument of `story.play` in the pause `restart` in src/main.ts. Veto by: 2026-11-30. Status: Active

## D-4 Rewarded heart button: "+1 heart (ad)", third button on the game-over card (2026-11-28, Tier 2)
Decided: the rewarded retry is a third button between "Retry level N" and "Map", labelled "+1 heart (ad)" with the replay icon; it shows only when ads are on and available. Why: the label must say plainly that it plays an ad; a longer label ("Watch an ad: retry with +1 heart") wrapped to three lines on an 800x450 phone. Rejected: replacing the normal Retry (players without ads would lose it). Revert: text in locales.json `story.retryBonus`. Veto by: 2026-11-30. Status: Active

## D-3 No Durable Object hibernation for now (2026-11-14, Tier 1)
Decided: do not build hibernation for idle lobbies before launch. Why: it only saves server time while lobbies sit idle; the game has had 1-4 players a day (analytics, 3-10 Nov), so there is nothing to save, and the build risks lost seats after a wake-up. Rejected: build it now (two deploys, a handler rewrite, a new dev dependency). Revisit: when the Cloudflare dashboard shows Durable Object duration near the free limit during the CrazyGames soft launch.
Revert: n/a (nothing built). Status: Active

## D-2 Analytics events carry their source (2026-11-14, Tier 1)
Decided: every event says where the page runs (`site` or `crazygames`). Why: M1 exists to get real numbers from portal players; without a source they would be mixed with our own site. Rejected: a separate database for the portal (more to maintain). Needs one step from Refindo (docs/ANALYTICS.md, "Source column"); until then events are stored without the source.
Revert: revert the commit; the column can stay. Status: Active

## D-1 Quick start for first-time portal players (2026-11-14, Tier 2)
Decided: in the CrazyGames build, a player on a fresh save goes from the first tap straight into Story level 1. The opening crawl and prologue play once as a look back ("Earlier today / How Bosco got here") before the next level. Our own site is unchanged. Why: a new player used to pass the start screen, the menu, the crawl, a 20-shot prologue and two cards before moving; CrazyGames judges how many players stay a minute, and Full Launch requires gameplay within one click (docs/PORTAL.md). Story order is a presentation change only: canon is untouched. New text: three short strings (`story.earlier*` in locales.json); the story chat may reword them.
Rejected: shortening the prologue for everyone (changes the story on our site too); skipping the story entirely on the portal (loses pillar 2, "a story worth finishing").
Revert: set `QUICK_START` to `false` in src/config/portal.ts (one line). Veto by: 2026-11-16. Status: Active
