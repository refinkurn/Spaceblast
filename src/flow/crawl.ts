// The opening crawl: paragraphs scroll up and away into space, Star Wars
// style, before the level 1 scene. Skip (or Enter, Space, Escape) ends it.
// The game waits while it runs.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** Scroll speed, in screen heights per second, and the pause before the scene. */
const SPEED = 0.1;
const FADE_MS = 600;

export class Crawl {
  private el = $('crawl');
  private text = $('crawl-text');
  private done: () => void = () => {};
  private anim: Animation | null = null;

  constructor() {
    $('crawl-skip').addEventListener('click', () => this.finish());
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        this.finish();
      }
    });
  }

  get active(): boolean {
    return !this.el.hidden;
  }

  play(paragraphs: readonly string[], done: () => void): void {
    this.done = done;
    this.text.replaceChildren(...paragraphs.map((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      return p;
    }));
    this.el.hidden = false;
    this.el.classList.remove('out');
    this.anim?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.el.classList.add('still');
      return;
    }
    this.el.classList.remove('still');
    // From just below the screen until the last line has gone over the horizon.
    const h = this.el.clientHeight;
    const travel = h + this.text.offsetHeight * 1.6;
    this.anim = this.text.animate(
      [{ transform: `rotateX(24deg) translateY(${h}px)` }, { transform: `rotateX(24deg) translateY(${h - travel}px)` }],
      { duration: (travel / h / SPEED) * 1000, easing: 'linear', fill: 'forwards' },
    );
    this.anim.onfinish = () => this.finish();
  }

  /** Ends the crawl (Skip, or it has scrolled away) and starts what follows. */
  finish(): void {
    if (!this.active || this.el.classList.contains('out')) return;
    this.el.classList.add('out');
    window.setTimeout(() => {
      this.anim?.cancel();
      this.anim = null;
      this.el.hidden = true;
      this.el.classList.remove('out');
      const done = this.done;
      this.done = () => {};
      done();
    }, FADE_MS);
  }

  /** Leaving to the menu: no follow-up. */
  cancel(): void {
    this.done = () => {};
    this.anim?.cancel();
    this.anim = null;
    this.el.hidden = true;
    this.el.classList.remove('out');
  }
}
