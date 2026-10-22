// Sideways strips (the lobby colours) scroll with a finger natively; with a
// mouse there is no sideways wheel or visible bar. This adds both: the wheel
// scrolls the strip sideways, and click-and-drag moves it. A drag never also
// clicks the swatch it started on.

/** Pixels the pointer must move before a press counts as a drag. */
export const DRAG_SLOP = 5;

/** The strip's new scrollLeft for a wheel turn (vertical wheels scroll it sideways). */
export function wheelScroll(scrollLeft: number, deltaX: number, deltaY: number): number {
  return scrollLeft + (Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX);
}

export function dragScroll(el: HTMLElement): void {
  el.addEventListener('wheel', (e) => {
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft = wheelScroll(el.scrollLeft, e.deltaX, e.deltaY);
  }, { passive: false });

  let start: { x: number; left: number } | null = null;
  let dragged = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // touch scrolls natively
    start = { x: e.clientX, left: el.scrollLeft };
    dragged = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (!dragged && Math.abs(dx) < DRAG_SLOP) return;
    dragged = true;
    el.classList.add('dragging');
    el.scrollLeft = start.left - dx;
  });
  window.addEventListener('pointerup', () => {
    start = null;
    el.classList.remove('dragging');
  });
  // The click that ends a drag is not a pick.
  el.addEventListener('click', (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
