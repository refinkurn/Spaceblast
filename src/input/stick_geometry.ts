// Where the virtual joystick's base sits. Pure, so it can be tested without a DOM.

export type JoystickMode = 'floating' | 'fixed';

/** Gap between the fixed stick and the bottom of the gutter (plus the safe-area inset in CSS). */
export const FIXED_MARGIN = 16;

/** Floating: the base appears under the thumb, kept inside the zone. */
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

/** CSS position of the base when nobody touches it. Fixed: bottom-left of the gutter above the safe area. */
export function restPosition(mode: JoystickMode, radius: number): { left: string; top: string } {
  return mode === 'fixed'
    ? { left: '50%', top: `calc(100% - ${Math.round(radius + FIXED_MARGIN)}px - env(safe-area-inset-bottom))` }
    : { left: '50%', top: '62%' };
}
