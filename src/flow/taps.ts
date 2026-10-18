// Phones don't send "click" for a tap that shared the screen with another
// finger (it counts as a multi-touch gesture), even if that finger lifted
// first. Players often keep a thumb resting on the joystick, so end-of-level
// buttons, cards and scenes ignored their taps and the game seemed frozen.
// Here such a touch that lifts on a button (or a tap-to-continue surface)
// clicks it directly; a native click that still follows is swallowed, so
// nothing fires twice.

const TAPPABLE = 'button, #level-card, #intro-card, #cutscene, #start-screen';
/** A touch that moved further than this is a drag, not a tap. */
const SLOP = 12;

export function installMultiTouchTaps(): void {
  /** Touches now down; `multi`: another finger was down at some point during it. */
  const down = new Map<number, { x: number; y: number; multi: boolean }>();
  let synthetic: { el: Element; at: number } | null = null;

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    for (const t of down.values()) t.multi = true;
    down.set(e.pointerId, { x: e.clientX, y: e.clientY, multi: down.size > 0 });
  }, true);
  window.addEventListener('pointercancel', (e) => down.delete(e.pointerId), true);
  window.addEventListener('pointerup', (e) => {
    const start = down.get(e.pointerId);
    down.delete(e.pointerId);
    // Only when another finger was down during this touch: a lone tap clicks normally.
    if (!start || !start.multi) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const el = hit?.closest(TAPPABLE);
    if (!el || (el as HTMLButtonElement).disabled) return;
    // Not the touch controls themselves (they work with pointer events already).
    if (el.closest('#stick-zone, #action-zone')) return;
    synthetic = { el, at: performance.now() };
    (hit as HTMLElement).click();
  }, true);
  // The same tap's real click, if the browser sends one after all.
  window.addEventListener('click', (e) => {
    if (!synthetic || !e.isTrusted) return;
    const recent = performance.now() - synthetic.at < 600;
    const same = (e.target as Element | null)?.closest(TAPPABLE) === synthetic.el;
    synthetic = null;
    if (recent && same) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}
