import { afterMidgameAd, type AdDeps } from '../services/crazygames_ads';

// Where a CrazyGames midgame ad may play (docs/design/crazygames-full-launch.md, Ads): between
// rounds, on the tap that leaves a screen, never mid-play. Story results: flow/story_results.ts.

/** Battle vs Bot end screen: both ways out ("Play again" and "Menu") run after an ad. */
export function botMatchEndActions(go: { playAgain(): void; menu(): void }, deps?: AdDeps): { playAgain(): void; menu(): void } {
  return {
    playAgain: () => afterMidgameAd(go.playAgain, deps),
    menu: () => afterMidgameAd(go.menu, deps),
  };
}

/** Leaving an online room for the menu: an ad first when in a room, never between rounds. */
export function leaveRoom(inRoom: boolean, exit: () => void, deps?: AdDeps): void {
  if (inRoom) afterMidgameAd(exit, deps);
  else exit();
}
