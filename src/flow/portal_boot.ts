import { canJoinFromUi, sdkEntry } from './crazy_join';
import type { OnlineRoom } from './online';
import type { Screens, MenuChoice } from './screens';
import type { StoryMode } from './story_mode';
import { initCrazySdk, inviteRoom } from '../services/crazygames';
import { watchLoading } from '../services/crazygames_loading';
import { isInstantMultiplayer, onJoinRoom } from '../services/crazygames_room';
import { markPortal } from '../config/portal';

export interface PortalBootDeps {
  screens: Screens;
  online: OnlineRoom;
  story: StoryMode;
  startModeNow: (m: MenuChoice) => void;
}

/** CrazyGames boot wiring (portal build only; every call is a no-op without the SDK). */
export function installPortalBoot(d: PortalBootDeps) {
  const { screens, online, story, startModeNow } = d;
  markPortal();
  watchLoading(); // CrazyGames loadingStart once the SDK is ready (portal build only)
  // Loads in the background, never holds up the start screen.
  initCrazySdk().then(() => {
    // Opened from a CrazyGames invite: same as ?room=CODE (Multiplayer, code filled in, the player taps Join).
    // First of a CrazyGames party (Instant Multiplayer): straight into a new room. An invite wins.
    const entry = sdkEntry(inviteRoom(), isInstantMultiplayer());
    if (!entry || !screens.menuOpen) return;
    startModeNow('online');
    if (entry === 'create') online.createNow();
    else online.prefillCode(entry.join);
  });
  // A friend joins through the CrazyGames UI while the game is open: like an invite, but only from a menu (never mid-play).
  onJoinRoom((code) => {
    if (!canJoinFromUi({ inRoom: online.connected, menuOpen: screens.menuOpen, storyMapOpen: story.mapOpen, onlineScreenOpen: online.screenOpen })) return;
    if (!online.screenOpen) { story.closeOverlays(); screens.hideMenu(); online.open(); }
    online.prefillCode(code);
  });
}
