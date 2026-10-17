// Floating virtual joystick in the left gutter plus the charge button in the
// right gutter. Pointer events cover touch, mouse and pen alike.

export class TouchSource {
  /** Stick vector, screen space (+x right, +y down), length 0..1 after dead zone. */
  vector = { x: 0, y: 0 };
  private place = false;
  /** Set on press, cleared when read, so a tap shorter than a tick still counts. */
  private placeTapped = false;

  private pointer = -1;
  private cx = 0;
  private cy = 0;
  private radius = 56;
  private readonly deadZone = 0.22;

  constructor(
    private zone: HTMLElement,
    private base: HTMLElement,
    private knob: HTMLElement,
    button: HTMLElement,
  ) {
    zone.addEventListener('pointerdown', (e) => this.start(e));
    zone.addEventListener('pointermove', (e) => this.move(e));
    zone.addEventListener('pointerup', (e) => this.end(e));
    zone.addEventListener('pointercancel', (e) => this.end(e));

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
    this.reset();
  }

  /** Place button for this tick: held now, or tapped since the last read. */
  readPlace(): boolean {
    const v = this.place || this.placeTapped;
    this.placeTapped = false;
    return v;
  }

  private start(e: PointerEvent) {
    if (this.pointer !== -1) return;
    e.preventDefault();
    this.pointer = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    // The stick appears where the thumb lands, clamped inside the zone.
    const r = this.zone.getBoundingClientRect();
    this.cx = Math.min(Math.max(e.clientX, r.left + this.radius), r.right - this.radius);
    this.cy = Math.min(Math.max(e.clientY, r.top + this.radius), r.bottom - this.radius);
    this.base.style.left = `${this.cx - r.left}px`;
    this.base.style.top = `${this.cy - r.top}px`;
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
    this.base.style.left = '50%';
    this.base.style.top = '62%';
  }

  /** Settings: bigger or smaller controls (the CSS sizes follow --ctl). */
  setScale(scale: number): void {
    this.radius = 56 * scale;
    document.documentElement.style.setProperty('--ctl', String(scale));
  }
}
