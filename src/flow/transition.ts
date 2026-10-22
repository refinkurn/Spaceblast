// Black micro-fade between screens (splash -> menu, menu -> Story map, map ->
// level, level -> next level, back to the menu): about 100 ms to black, the
// screen swap runs under the black, then about 150 ms back. It hides the frame
// where the old screen is gone and the new one (DOM and 3D scene) isn't drawn
// yet, without reading as a loading screen.
//
// fadeThrough(swap) runs `swap` at full black. Calls that arrive while it is
// going dark (or from inside a swap) join the same black frame, so nested
// flows (map Back -> openMenu) fade once. While it is dark the overlay takes
// every tap, so a double tap can't press a button on the screen behind it.
// Reduced motion: no fade, the swap runs at once.

/** Fade to black, and back out. Short enough to read as a cut, long enough to mask a rebuild. */
export const FADE_OUT_MS = 100;
export const FADE_IN_MS = 150;
/** Longest hold at full black waiting for the new screen's first frames. */
const MAX_HOLD_MS = 80;

type Phase = 'idle' | 'out' | 'black' | 'in';

let phase: Phase = 'idle';
let pending: (() => void)[] = [];
let timer = 0;
let overlay: HTMLElement | null = null;

function el(): HTMLElement {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fade';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
  }
  return overlay;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True from the start of a fade until the new screen is fully shown. */
export function fading(): boolean {
  return phase !== 'idle';
}

/** Runs `swap` under a quick black fade (or right away with reduced motion). */
export function fadeThrough(swap: () => void): void {
  if (reducedMotion()) {
    swap();
    return;
  }
  pending.push(swap);
  // Already going dark, or swaps are running under the black: this one joins them.
  if (phase === 'out' || phase === 'black') return;
  // Idle, or lifting from an earlier fade: go dark again from where it is.
  phase = 'out';
  clearTimeout(timer);
  const f = el();
  f.style.transitionDuration = `${FADE_OUT_MS}ms`;
  f.classList.add('on');
  timer = window.setTimeout(atBlack, FADE_OUT_MS);
}

function atBlack(): void {
  phase = 'black';
  // A swap may queue another (map Back -> openMenu): run until none are left.
  while (pending.length) {
    const jobs = pending;
    pending = [];
    for (const job of jobs) {
      try {
        job();
      } catch (e) {
        console.error(e);
      }
    }
  }
  // Two frames: the new screen's layout and the rebuilt 3D scene get painted under the black first.
  // The timer is a backstop: a background tab sends no frames, and the screen must never stay black.
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    clearTimeout(backstop);
    if (pending.length) {
      atBlack();
      return;
    }
    phase = 'in';
    const f = el();
    f.style.transitionDuration = `${FADE_IN_MS}ms`;
    f.classList.remove('on');
    timer = window.setTimeout(() => (phase = 'idle'), FADE_IN_MS);
  };
  const backstop = window.setTimeout(lift, MAX_HOLD_MS);
  requestAnimationFrame(() => requestAnimationFrame(lift));
}
