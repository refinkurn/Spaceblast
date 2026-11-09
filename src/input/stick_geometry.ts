// Where the virtual joystick's base sits. Pure, so it can be tested without a DOM.

export type JoystickMode = 'floating' | 'fixed';

/** Gap between the fixed stick and the bottom of the gutter (plus the safe-area inset in CSS). */
export const FIXED_MARGIN = 16;

/**
 * Floating: the base may sit anywhere on the screen, so it is clamped to the screen edges,
 * not to the touch zone (which covers only the left half, below the HUD).
 */
export function floatingBounds(
  zone: { bottom: number },
  screenWidth: number,
): { left: number; top: number; right: number; bottom: number } {
  return { left: 0, top: 0, right: screenWidth, bottom: zone.bottom };
}

/** Floating: the base appears under the thumb, kept inside the given bounds. */
export function floatingCenter(
  rect: { left: number; top: number; right: number; bottom: number },
  radius: number,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, rect.left + radius), rect.right - radius),
    y: Math.min(Math.max(y, rect.top + radius), rect.bottom - radius),
  };
}

/**
 * Middle of the left gutter. Floating mode widens the touch zone to half the
 * screen, so '50%' of the zone would put the idle stick over the arena's edge.
 */
const GUTTER_MIDDLE = 'max(calc(env(safe-area-inset-left) + var(--gutter) / 2), calc(56px * var(--ctl, 1) + 4px))';

/** CSS position of the base when nobody touches it: in the gutter, clear of the arena. Fixed: bottom of the gutter above the safe area. */
export function restPosition(mode: JoystickMode, radius: number): { left: string; top: string } {
  return mode === 'fixed'
    ? { left: '50%', top: `calc(100% - ${Math.round(radius + FIXED_MARGIN)}px - env(safe-area-inset-bottom))` }
    : { left: GUTTER_MIDDLE, top: '62%' };
}
