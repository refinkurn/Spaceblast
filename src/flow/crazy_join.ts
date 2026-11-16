// A friend joins through the CrazyGames UI while the game is open (services/crazygames_room.ts):
// from a menu, the Story map or the Multiplayer screen it opens Multiplayer with the code filled in;
// during a Story level, Battle vs Bot or an online round it is ignored (they can join from the menu).

export interface JoinScreens {
  /** In a room already (connected or reconnecting). */
  inRoom: boolean;
  menuOpen: boolean;
  storyMapOpen: boolean;
  /** The Multiplayer screens (name + code, or the lobby) are up. */
  onlineScreenOpen: boolean;
}

export function canJoinFromUi(s: JoinScreens): boolean {
  return !s.inRoom && (s.menuOpen || s.storyMapOpen || s.onlineScreenOpen);
}
