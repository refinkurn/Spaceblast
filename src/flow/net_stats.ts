// A small line of numbers during online rounds, so a real match on real phones
// shows where lag comes from: the server's distance (ping), an uneven
// connection (wobble, buffer, late presses) or the phone itself (frame rate,
// drawing time). Hide it with ?nostats in the page address.

export interface NetSample {
  /** Cloudflare data centre of the room (e.g. "SIN"), or ''. */
  where: string;
  rtt: number;
  spread: number;
  /** Ticks held back against jitter, and ticks waiting beyond that. */
  reserve: number;
  buffered: number;
  /** Own presses the server replaced because they arrived too late (this round). */
  late: number;
  /** Ticks drawn ahead for your own astronaut. */
  ahead: number;
}

/** Window (ms) over which the frame numbers are measured. */
const WINDOW_MS = 2000;

export class NetStats {
  private el: HTMLElement;
  private readonly enabled = !new URLSearchParams(location.search).has('nostats');
  private frames = 0;
  private worst = 0;
  private work = 0;
  private windowStart = 0;
  private fps = 0;
  private worstShown = 0;
  private workShown = 0;
  private text = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'net-stats';
    this.el.hidden = true;
    document.body.append(this.el);
  }

  /**
   * Once per drawn frame. `frameMs`: time since the last frame; `workMs`: time
   * spent on this frame's game ticks, prediction and drawing. `sample` is null
   * outside online rounds (the line hides).
   */
  update(now: number, frameMs: number, workMs: number, sample: NetSample | null): void {
    if (!this.enabled || !sample) {
      if (!this.el.hidden) this.el.hidden = true;
      this.windowStart = 0;
      return;
    }
    if (this.windowStart === 0) this.windowStart = now;
    this.frames++;
    this.worst = Math.max(this.worst, frameMs);
    this.work = Math.max(this.work, workMs);
    if (now - this.windowStart >= WINDOW_MS) {
      this.fps = Math.round((this.frames * 1000) / (now - this.windowStart));
      this.worstShown = Math.round(this.worst);
      this.workShown = Math.round(this.work);
      this.frames = this.worst = this.work = 0;
      this.windowStart = now;
    }
    const s = sample;
    const text =
      `${s.where || 'server ?'} · ping ${Math.round(s.rtt)}±${Math.round(s.spread)} ms · ` +
      `buffer ${s.reserve}+${Math.max(0, s.buffered - s.reserve)} · late ${s.late} · ahead ${s.ahead} · ` +
      `${this.fps} fps · slowest ${this.worstShown} ms · work ${this.workShown} ms`;
    if (text !== this.text) this.el.textContent = this.text = text;
    if (this.el.hidden) this.el.hidden = false;
  }
}
