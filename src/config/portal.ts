// Portal builds (`npm run build:portal`): the game inside a web portal's page
// (CrazyGames first). The portal supplies full screen, sharing and its own rules
// (docs/PORTAL.md), so a portal build turns a few of our own features off.

/** '' for our own site; the portal's id (e.g. 'crazygames') in a portal build. */
export const PORTAL: string = (import.meta.env?.VITE_PORTAL as string | undefined) ?? '';

export const isPortal = PORTAL !== '';

/** Marks the page so CSS can hide what a portal forbids (body.portal ...). */
export function markPortal(): void {
  if (isPortal) document.body.classList.add('portal', `portal-${PORTAL}`);
}

/**
 * Quick start (docs/PORTAL.md): a portal player who has never played lands in
 * level 1 on the first tap, with no menu, crawl, scene or cards in between; the
 * opening story plays after that first clear. `?quickstart` tries it on our own site.
 */
export const QUICK_START: boolean = isPortal || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('quickstart'));

/**
 * Quick start happens once per save: `fresh` means no Story progress, no opening
 * card seen and no quick start before. Never for someone following a room invite
 * (pass the address the page was opened with: the invite is removed from it at load).
 */
export function wantsQuickStart(enabled: boolean, fresh: boolean, search: string): boolean {
  return enabled && fresh && !new URLSearchParams(search).has('room');
}
