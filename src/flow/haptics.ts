// Vibration for touch devices. Off where navigator.vibrate is missing (iOS Safari)
// or when the player turned it off in Settings. Events are wired where they happen.

export const haptics = {
  enabled: true,
  /** Buzz for `ms` milliseconds (ignored when unsupported or off). */
  buzz(ms: number): void {
    if (!this.enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try { navigator.vibrate(ms); } catch { /* blocked by the browser */ }
  },
};
