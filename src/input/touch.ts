// Virtual joystick (floating or fixed) in the left gutter plus the charge button in the
// right gutter. Pointer events cover touch, mouse and pen alike.

import { floatingCenter, restPosition, type JoystickMode } from './stick_geometry';

export class TouchSource {
  /** Stick vector, screen space (+x right, +y down), length 0..1 after dead zone. */
  vector = { x: 0, y: 0 };
  private place = false;
  /** Set on press, cleared when read, so a tap shorter than a tick still counts. */
  private placeTapped = false;

  private pointer = -1;
  private button!: HTMLElement;
  private cx = 0;
  private cy = 0;
  private radius = 56;
  private readonly deadZone = 0.22;
  private mode: JoystickMode = 'floating';

  constructor(
    private zone: HTMLElement,
    private base: HTMLElement,
    private knob: HTMLElement,
    button: HTMLElement,
  ) {
    this.button = button;
    zone.addEventListener('pointerdown', (e) => this.start(e));
    zone.addEventListener('pointermove', (e) => this.move(e));
    zone.addEventListener('pointerup', (e) => this.end(e));
    zone.addEventListener('pointercancel', (e) => this.end(e));
    // If the zone is hidden mid-touch (a scene starts), the browser may never send
    // pointerup; losing capture ends the touch too, so the stick can't get stuck.
    zone.addEventListener('lostpointercapture', (e) => this.end(e));

    const press = (down: boolean) => (e: PointerEvent) => {
      e.preventDefault();
      this.place = down;
      if (down) this.placeTapped = true;
      button.classList.toggle('pressed', down);
    };
    button.addEventListener('pointerdown', press(true));
    button.addEventListener('pointerup', press(false));
    button.addEventListener('pointercancel', press(false));
    button.addEventListener('pointerleave', press(false));
    button.addEventListener('lostpointercapture', press(false));
    window.addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => this.release());
    this.reset();
  }

  /** Place button for this tick: held now, or tapped since the last read. */
  readPlace(): boolean {
    const v = this.place || this.placeTapped;
    this.placeTapped = false;
    return v;
  }

  /** Lets go of everything (a scene or menu took over the screen). */
  release(): void {
    this.pointer = -1;
    this.place = false;
    this.placeTapped = false;
    this.button.classList.remove('pressed');
    this.reset();
  }

  private start(e: PointerEvent) {
    // A new finger always takes the stick: an old touch may never have ended
    // cleanly (iOS can drop pointerup), and refusing would freeze the stick.
    e.preventDefault();
    this.pointer = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId);
    } catch { /* the finger already lifted: the touch still works without capture */ }
    const r = this.zone.getBoundingClientRect();
    if (this.mode === 'fixed') {
      // Steer relative to the base that stays put, wherever in the gutter the finger lands.
      const b = this.base.getBoundingClientRect();
      this.cx = b.left + b.width / 2;
      this.cy = b.top + b.height / 2;
    } else {
      // The stick appears where the thumb lands, clamped inside the zone.
      const c = floatingCenter(r, this.radius, e.clientX, e.clientY);
      this.cx = c.x;
      this.cy = c.y;
      this.base.style.left = `${this.cx - r.left}px`;
      this.base.style.top = `${this.cy - r.top}px`;
    }
    this.base.classList.add('active');
    this.move(e);
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.pointer) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx *= this.radius / len;
      dy *= this.radius / len;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const n = Math.min(len, this.radius) / this.radius;
    this.vector = n < this.deadZone ? { x: 0, y: 0 } : { x: dx / this.radius, y: dy / this.radius };
  }

  private end(e: PointerEvent) {
    if (e.pointerId !== this.pointer) return;
    this.pointer = -1;
    this.reset();
  }

  private reset() {
    this.vector = { x: 0, y: 0 };
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
    const rest = restPosition(this.mode, this.radius);
    this.base.style.left = rest.left;
    this.base.style.top = rest.top;
  }

  /** Settings: floating (under the thumb) or fixed (bottom-left of the gutter). Applies at once. */
  setMode(mode: JoystickMode): void {
    this.mode = mode;
    this.release();
  }

  /** Settings: bigger or smaller controls (the CSS sizes follow --ctl). */
  setScale(scale: number): void {
    this.radius = 56 * scale;
    this.reset();
    document.documentElement.style.setProperty('--ctl', String(scale));
  }
}
