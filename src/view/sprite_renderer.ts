import { bodyFrame, characterMeta, imageOf, portraitFrame, type SpriteFrame } from './sprite_loader';

// Draws one character at a pose onto a 2D canvas: a frame of its atlas
// (full body, or the dialogue portrait), or until the art is in, a coloured card
// labelled "KIT - worried". Pixel art scales by whole multiples, unsmoothed.
// Redraws only when the frame, pose or canvas size changes.

export type SpriteMode = 'body' | 'portrait';

export class SpriteView {
  private id: string | null = null;
  private pose = 'neutral';
  private since = 0;
  private drawn = '';
  private ctx: CanvasRenderingContext2D | null;

  constructor(private canvas: HTMLCanvasElement, private mode: SpriteMode = 'body') {
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
    if (!ctx || !meta || !this.id) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    let frame: SpriteFrame | null = null;
    if (this.mode === 'portrait') frame = portraitFrame(this.id, this.pose) ?? bodyFrame(this.id, this.pose, 0);
    else frame = bodyFrame(this.id, this.pose, now - this.since);
    const img = frame ? imageOf(frame.image) : null;
    const key = `${this.id}|${this.pose}|${frame ? `${frame.rect.x},${frame.rect.y}` : '-'}|${w}x${h}|${!!img}`;
    if (key === this.drawn) return;
    this.drawn = key;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    if (frame && img) {
      const { rect, pivot } = frame;
      let scale = Math.min(w / rect.w, h / rect.h);
      if (frame.pixelArt && scale >= 1) scale = Math.floor(scale);
      ctx.imageSmoothingEnabled = !frame.pixelArt;
      // The pivot (feet, or the bottom of a bust) stands on the bottom centre.
      const dx = Math.round(w / 2 - pivot.x * scale), dy = Math.round(h - pivot.y * scale);
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx, dy, rect.w * scale, rect.h * scale);
      return;
    }
    this.placeholder(ctx, w, h, meta.label, meta.color);
  }

  /** Until the art is in: the character's colour, name and the asked-for pose. */
  private placeholder(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, color: string): void {
    const size = Math.min(w, h);
    const dx = (w - size) / 2, dy = h - size;
    const pad = size * 0.08, r = size * 0.08;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(dx + pad, dy + pad, size - pad * 2, size - pad, [r, r, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0e1118';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = Math.max(10, Math.round(size * 0.075));
    ctx.font = `800 ${font}px system-ui, sans-serif`;
    ctx.fillText(label, w / 2, dy + size * 0.5 - font * 0.7, size - pad * 3);
    ctx.font = `600 ${Math.round(font * 0.8)}px system-ui, sans-serif`;
    ctx.fillText(this.pose, w / 2, dy + size * 0.5 + font * 0.7, size - pad * 3);
  }
}
