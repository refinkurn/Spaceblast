// Touch controls only where they are used. A computer with a mouse and keyboard
// starts without the on-screen stick and Charge button (body.no-touch); the
// first real touch brings them back, so a touchscreen laptop still works.

/** Should the on-screen controls show at start? Only when touch is the main pointer. */
export function startsWithTouch(coarsePointer: boolean): boolean {
  return coarsePointer;
}

export function installInputMode(): void {
  const set = (touch: boolean) => document.body.classList.toggle('no-touch', !touch);
  set(startsWithTouch(window.matchMedia('(pointer: coarse)').matches));
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') set(true); }, { capture: true, passive: true });
}
