// This page's build version, sent with every room join (?v=). A room seats
// only the build of its first player, so two versions never share a round
// (they could play it differently: a desync). vite.config.ts puts the commit
// in __BUILD__ (server/build_version.ts); the dev server and tests use 'dev'.

declare const __BUILD__: string | undefined;

export const BUILD: string = typeof __BUILD__ === 'string' && __BUILD__ ? __BUILD__ : 'dev';

const UPDATE_KEY = 'spaceblast.update-reload';
/** After one update reload, a second refusal within this long shows a message instead. */
export const UPDATE_RETRY_MS = 10 * 60 * 1000;

/**
 * A room refused this page's build ('update'). The first time, reload (`go`)
 * to fetch the latest page; true when it did. False when it already reloaded
 * a short while ago (the room runs another build: show the message), or when
 * there is nowhere to remember that, since a reload could then loop.
 */
export function reloadForUpdate(
  store: Pick<Storage, 'getItem' | 'setItem'> | null,
  now: number,
  go: () => void,
): boolean {
  if (!store) return false;
  try {
    const at = Number(store.getItem(UPDATE_KEY));
    if (at > 0 && now - at >= 0 && now - at < UPDATE_RETRY_MS) return false;
    store.setItem(UPDATE_KEY, String(now));
  } catch {
    return false;
  }
  go();
  return true;
}
