import { Dir } from '../sim/constants';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: Dir.Up, KeyW: Dir.Up,
  ArrowDown: Dir.Down, KeyS: Dir.Down,
  ArrowLeft: Dir.Left, KeyA: Dir.Left,
  ArrowRight: Dir.Right, KeyD: Dir.Right,
};
const PLACE_KEYS = new Set(['Space', 'KeyX']);

/** Tracks held direction keys, most recently pressed first. */
export class KeyboardSource {
  private held: Dir[] = [];
  place = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const d = KEY_DIRS[e.code];
      if (d !== undefined) {
        e.preventDefault();
        if (!e.repeat) this.held = [d, ...this.held.filter((h) => h !== d)];
      } else if (PLACE_KEYS.has(e.code)) {
        e.preventDefault();
        this.place = true;
      }
    });
    target.addEventListener('keyup', (e) => {
      const d = KEY_DIRS[e.code];
      if (d !== undefined) this.held = this.held.filter((h) => h !== d);
      else if (PLACE_KEYS.has(e.code)) this.place = false;
    });
    target.addEventListener('blur', () => {
      this.held = [];
      this.place = false;
    });
  }

  /** [primary, perpendicular fallback] or [] when nothing is held. */
  directions(): Dir[] {
    if (this.held.length === 0) return [];
    const first = this.held[0];
    const vertical = (d: Dir) => d === Dir.Up || d === Dir.Down;
    const alt = this.held.find((d) => vertical(d) !== vertical(first));
    return alt === undefined ? [first] : [first, alt];
  }
}
