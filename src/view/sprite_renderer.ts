import { characterMeta, frameAt, resolvePose, sheetOf } from './sprite_loader';

// Draws one character at a pose onto a 2D canvas: a frame of its sprite sheet,
// or (until the art is in) a coloured card labelled "KIT - worried".
// Redraws only when the frame, pose or canvas size changes.

export class SpriteView {
  private id: string | null = null;
  private pose = 'neutral';
  private since = 0;
  private drawn = '';
  private ctx: CanvasRenderingContext2D | null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  get character(): string | null {
    return this.id;
  }

  /** Shows a character (null: nobody). The pose animation restarts on a change. */
  show(id: string | null, pose = 'neutral', now = performance.now()): void {
    if (id === this.id && pose === this.pose) return;
    this.id = id;
    this.pose = pose;
    this.since = now;
    this.canvas.hidden = !id;
  }

  draw(now = performance.now()): void {
    const ctx = this.ctx;
    const meta = this.id ? characterMeta(this.id) : undefined;
    if (!ctx || !meta) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    const pose = resolvePose(meta, this.pose);
    const sheet = sheetOf(meta.character);
    const { row, col } = sheet ? frameAt(meta, pose, now - this.since) : { row: 0, col: 0 };
    const key = `${meta.character}|${this.pose}|${row}|${col}|${w}x${h}|${!!sheet}`;
    if (key === this.drawn) return;
    this.drawn = key;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    // Fit a frame-shaped box, standing on the bottom edge.
    const scale = Math.min(w / meta.frameWidth, h / meta.frameHeight);
    const dw = meta.frameWidth * scale, dh = meta.frameHeight * scale;
    const dx = (w - dw) / 2, dy = h - dh;
    if (sheet) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, col * meta.frameWidth, row * meta.frameHeight, meta.frameWidth, meta.frameHeight, dx, dy, dw, dh);
      return;
    }
    // Placeholder: the asked-for pose is shown even if the sheet won't have it.
    const pad = dw * 0.08;
    const r = dw * 0.08;
    ctx.fillStyle = meta.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(dx + pad, dy + pad, dw - pad * 2, dh - pad, [r, r, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0e1118';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(10, Math.round(dw * 0.075));
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.fillText(meta.label, w / 2, dy + dh * 0.5 - size * 0.7, dw - pad * 3);
    ctx.font = `600 ${Math.round(size * 0.8)}px system-ui, sans-serif`;
    ctx.fillText(this.pose, w / 2, dy + dh * 0.5 + size * 0.7, dw - pad * 3);
  }
}
