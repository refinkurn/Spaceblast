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
