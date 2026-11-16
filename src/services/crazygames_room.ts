// CrazyGames room data and the join-room listener (docs/design/crazygames-multiplayer.md).
// Portal build only: with no ready SDK (our own site, blocked, disabled) every call is a silent no-op.
import { isRoomCode } from '../net/protocol';
import { crazySdk, onCrazyReady } from './crazygames';

/** What the SDK was last told about our room; null = not in a room. */
let told: { code: string; joinable: boolean } | null = null;
let listening = false;

/** Forget everything (tests). */
export function resetCrazyRoom(): void {
  told = null;
  listening = false;
}

function guarded(what: string, call: () => void): void {
  try { call(); } catch (err) { console.warn(`CrazyGames SDK: ${what} failed`, err); }
}

/**
 * The room we are in and whether a friend can still join (lobby with a free seat: yes;
 * a round running or the room full: no). Only a change reaches the SDK.
 */
export function updateRoom(code: string, joinable: boolean): void {
  const sdk = crazySdk();
  if (!sdk || !code) return;
  if (told && told.code === code && told.joinable === joinable) return;
  told = { code, joinable };
  guarded('updateRoom', () => sdk.game?.updateRoom?.({ roomId: code, isJoinable: joinable, inviteParams: { roomId: code } }));
}

/** The player left the room (or the connection is gone for good). Only called if a room was announced. */
export function leftRoom(): void {
  const sdk = crazySdk();
  if (!sdk || !told) return;
  told = null;
  guarded('leftRoom', () => sdk.game?.leftRoom?.());
}

/**
 * A friend joins through the CrazyGames UI while the game is open: `handler` gets the room code
 * (checked like ?room=). Registered once, when the SDK is ready.
 */
export function onJoinRoom(handler: (code: string) => void): void {
  onCrazyReady(() => {
    const sdk = crazySdk();
    if (!sdk || listening) return;
    listening = true;
    guarded('addJoinRoomListener', () => sdk.game?.addJoinRoomListener?.((params) => {
      const raw = params?.roomId;
      const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
      if (isRoomCode(code)) guarded('join handler', () => handler(code));
    }));
  });
}

/** The player came as the first of a CrazyGames party (Instant Multiplayer). False without the SDK. */
export function isInstantMultiplayer(): boolean {
  try {
    return crazySdk()?.game?.isInstantMultiplayer === true;
  } catch (err) {
    console.warn('CrazyGames SDK: isInstantMultiplayer failed', err);
    return false;
  }
}
