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
  private place = false;
  /** Left mouse button held (pressed on the arena). */
  private mouse = false;
  /** Set on key down, cleared when read, so a tap shorter than a tick still counts. */
  private placeTapped = false;
  /** Ignore the charge key until it is released (it was pressed to skip a card). */
  private placeBlocked = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const d = KEY_DIRS[e.code];
      if (d !== undefined) {
        e.preventDefault();
        if (!e.repeat) this.held = [d, ...this.held.filter((h) => h !== d)];
      } else if (PLACE_KEYS.has(e.code)) {
        e.preventDefault();
        this.place = true;
        if (!e.repeat) this.placeTapped = true;
      }
    });
    target.addEventListener('keyup', (e) => {
      const d = KEY_DIRS[e.code];
      if (d !== undefined) this.held = this.held.filter((h) => h !== d);
      else if (PLACE_KEYS.has(e.code)) {
        this.place = false;
        this.placeBlocked = false;
      }
    });
    // A left mouse click on the arena charges too (desktop browsers). Mouse only:
    // touch has its own charge button, and clicks on menus or buttons don't count.
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
      this.mouse = true;
      this.placeTapped = true;
    });
    target.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !this.mouse) return;
      this.mouse = false;
      this.placeBlocked = false;
    });
    target.addEventListener('blur', () => {
      this.mouse = false;
      this.held = [];
      this.place = false;
      this.placeBlocked = false;
    });
  }

  /** Place button for this tick: held now, or tapped since the last read. */
  readPlace(): boolean {
    const v = this.place || this.mouse || this.placeTapped;
    this.placeTapped = false;
    return v && !this.placeBlocked;
  }

  /** Forgets charge presses so far; a key still held is ignored until released. */
  clearPlace(): void {
    this.placeTapped = false;
    this.placeBlocked = this.place || this.mouse;
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
