import { isRoomCode } from '../net/protocol';

// Invite links: the game's URL with `?room=CODE`. Opening one goes to the
// Multiplayer screen with the code filled in; the player still taps Join.

/** The room code in a URL query string (`?room=abcd`), upper-cased, or null when missing or malformed. */
export function parseRoomParam(search: string): string | null {
  const raw = new URLSearchParams(search).get('room');
  const code = raw?.trim().toUpperCase() ?? '';
  return isRoomCode(code) ? code : null;
}

/** The link to share for a room, built from the current page's address. */
export function inviteUrl(code: string, href: string): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.toString();
}

/** Opens the phone's share sheet, or copies the link. Returns the note to show. */
export async function shareInvite(code: string): Promise<string> {
  const url = inviteUrl(code, window.location.href);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Spaceblast', text: `Join my Spaceblast room ${code}`, url });
      return '';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return ''; // closed the share sheet
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Link copied';
  } catch {
    return url; // last resort: show the link so it can be copied by hand
  }
}
