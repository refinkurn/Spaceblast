import { bodyFrame, characterMeta, imageOf, portraitFrame, type SpriteFrame } from './sprite_loader';

// Draws one character at a pose onto a 2D canvas: a frame of its atlas
// (full body, or the dialogue portrait; a portrait-only character shows its
// portrait in both), or until the art is in, a coloured card
// labelled "KIT - worried". Pixel art scales by whole multiples, unsmoothed.
// Redraws only when the frame, pose or canvas size changes.

/**
 * 'body': fit the frame in the canvas. 'portrait': the dialogue portrait.
 * 'scene': the cutscene slot, the full height of the screen: every character is
 * scaled to the same drawn height and stands at the bottom, so the dialogue box
 * covers the legs (or the bottom of a bust) and the head and upper body show.
 */
export type SpriteMode = 'body' | 'portrait' | 'scene';

/** Scene characters: a full body is drawn this share of the screen height, standing at the bottom. */
const SCENE_HEIGHT = 0.86;
/** A bust (portrait-only character) is drawn this share of the space above the dialogue box... */
const BUST_HEIGHT = 0.8;
/** ...with this share of it tucked behind the box. */
const BUST_TUCK = 0.1;

/** Topmost non-transparent row of a frame (cached): how tall the drawing really is. */
const tops = new Map<string, number>();
function artTop(img: HTMLImageElement, f: SpriteFrame): number {
  const key = `${img.src.slice(-48)}|${f.rect.x},${f.rect.y}`;
  let top = tops.get(key);
  if (top !== undefined) return top;
  top = 0;
  try {
    const c = document.createElement('canvas');
    c.width = f.rect.w;
    c.height = f.rect.h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, f.rect.x, f.rect.y, f.rect.w, f.rect.h, 0, 0, f.rect.w, f.rect.h);
    const data = g.getImageData(0, 0, f.rect.w, f.rect.h).data;
    find: for (let y = 0; y < f.rect.h; y++) {
      for (let x = 0; x < f.rect.w; x++) if (data[(y * f.rect.w + x) * 4 + 3] > 0) { top = y; break find; }
    }
  } catch { /* unreadable image: treat the whole frame as art */ }
  tops.set(key, top);
  return top;
}

export class SpriteView {
  private id: string | null = null;
  private pose = 'neutral';
  private since = 0;
  private drawn = '';
  /** Scene mode: where the dialogue box starts, as a share of the canvas height. */
  private floor = 0.7;
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

  /** Where the canvas sits in its container (CSS px). */
  canvasRect(): { top: number; height: number } {
    return { top: this.canvas.offsetTop, height: this.canvas.clientHeight };
  }

  /** Scene mode: the top of the dialogue box, as a share of the canvas height. */
  setFloor(share: number): void {
    this.floor = Math.min(1, Math.max(0.3, share));
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
    // A portrait-only character (Captain Kit, on the radio) shows the portrait in the big slot too.
    else frame = bodyFrame(this.id, this.pose, now - this.since) ?? portraitFrame(this.id, this.pose);
    const img = frame ? imageOf(frame.image) : null;
    const key = `${this.id}|${this.pose}|${frame ? `${frame.rect.x},${frame.rect.y}` : '-'}|${w}x${h}|${!!img}|${this.floor.toFixed(3)}`;
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
      // The pivot (feet, or the bottom of a bust) stands on the bottom centre.
      let base = h;
      if (this.mode === 'scene') {
        // One reference frame per character (its neutral pose), so the size never jumps between poses.
        const body = bodyFrame(this.id, 'neutral', 0);
        const ref = body ?? portraitFrame(this.id, 'neutral') ?? frame;
        const drawn = Math.max(1, ref.pivot.y - artTop(imageOf(ref.image) ?? img, ref));
        const floor = h * this.floor;
        const target = body ? h * SCENE_HEIGHT : floor * BUST_HEIGHT;
        scale = target / drawn;
        // Whole multiples keep pixel art crisp. Round up only when that stays close to the target
        // (small screens would otherwise drop a whole step); otherwise round down.
        if (frame.pixelArt) {
          const up = Math.round(scale);
          scale = Math.max(1, up * drawn <= target * 1.08 ? up : Math.floor(scale));
        }
        if (!body) base = floor + drawn * scale * BUST_TUCK;
      } else if (frame.pixelArt && scale >= 1) {
        scale = Math.floor(scale);
      }
      ctx.imageSmoothingEnabled = !frame.pixelArt;
      const dx = Math.round(w / 2 - pivot.x * scale), dy = Math.round(base - pivot.y * scale);
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
