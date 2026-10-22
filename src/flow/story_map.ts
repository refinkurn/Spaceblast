import { LEVEL_COUNT, levelSpec, sectorOf } from '../sim/levels';
import { SpriteView } from '../view/sprite_renderer';
import { GOAL_ICONS } from './goal_icons';
import { LEVELS_PER_SECTOR, MAP_SECTORS, nodeOf, sectorsShown } from './map_layout';
import { sectorLook } from '../view/sector_look';
import { bestLine, bossLabel, coreSignal, enterLabel, nodeGoal, sectorStars, sectorTitle, starChecklist } from './map_text';
import type { StoryProgress } from './progress';
import { levelCard } from './story';
import './story_map.css';
import { t } from '../utils/i18n';

// The Story map (docs/design/story-map.md): a header with the Core signal
// gauge, a sideways-scrolling track of four themed sectors with a node per
// level, Bosco's sprite on the current node, and the node card that starts a
// level. 2D only (DOM, CSS and SVG): no second Three.js scene.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const WALK_MS = 600;
const WARP_MS = 800;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = (body: string, cls: string) =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const PADLOCK = icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 'map-lock');
const GATE = icon('<ellipse cx="12" cy="12" rx="5" ry="9"/>', 'map-gate');
const TICK = icon('<path d="M5 12l5 5 9-10"/>', 'map-tick');

/** Bosco just cleared `from`: he walks (or warps) on to the next node. */
export interface MapArrival {
  from: number;
}

export class StoryMap {
  private root = $('story-hub');
  private track = $('map-track');
  private card = $('map-card');
  private warp = $('map-warp');
  private pawnCanvas = document.createElement('canvas');
  private pawn = new SpriteView(this.pawnCanvas, 'body');
  private panels: HTMLElement[] = [];
  private dividers: HTMLElement[] = [];
  private nodes = new Map<number, HTMLButtonElement>();
  private cardLevel = 0;
  private raf = 0;
  private timers: number[] = [];

  constructor(private progress: StoryProgress, private onEnter: (level: number) => void, private onBack: () => void, onBoard: () => void) {
    this.pawnCanvas.className = 'map-pawn';
    this.pawnCanvas.setAttribute('aria-hidden', 'true');
    $('hub-back').addEventListener('click', () => onBack());
    $('hub-board').addEventListener('click', () => onBoard());
    $('map-card-back').addEventListener('click', () => this.closeCard());
    $('map-card-enter').addEventListener('click', () => this.enter());
    this.card.addEventListener('click', (e) => { if (e.target === this.card) this.closeCard(); });
    this.track.addEventListener('scroll', () => this.updateHeader(), { passive: true });
    // Desktop: the mouse wheel scrolls the track sideways.
    this.track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      this.track.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e));
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** Shows the map, centred on the current node; after a clear, Bosco walks (or warps) on from `arrival.from`. */
  show(arrival?: MapArrival): void {
    this.clearTimers();
    const p = this.progress;
    const current = p.finished ? LEVEL_COUNT : p.unlocked;
    const from = arrival && arrival.from < LEVEL_COUNT ? arrival.from : 0;
    const to = from ? from + 1 : current;
    // A node unlocked by this very clear pops open once Bosco reaches it.
    const reveal = from && to === p.unlocked && p.stars(to) === 0 ? to : 0;
    this.root.hidden = false;
    this.card.hidden = true;
    this.render(current, reveal);
    const boss = from > 0 && nodeOf(from).index === LEVELS_PER_SECTOR - 1;
    this.pawn.show('astropaw', 'neutral');
    this.loop();
    if (!from) {
      this.place(to);
      this.scrollTo(to);
    } else if (boss) {
      this.warpTo(from, to);
    } else {
      this.walk(from, to, reveal);
    }
    this.updateHeader();
  }

  hide(): void {
    this.clearTimers();
    this.warp.hidden = true;
    this.warp.classList.remove('on');
    this.root.hidden = true;
    this.card.hidden = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private render(current: number, reveal: number): void {
    const p = this.progress;
    const shown = sectorsShown(p.unlocked);
    const openSector = sectorOf(p.unlocked);
    this.track.innerHTML = '';
    this.panels = [];
    this.dividers = [];
    this.nodes.clear();
    for (let s = 1; s <= shown; s++) {
      if (s > 1) {
        const div = document.createElement('div');
        div.className = 'map-divider';
        // Lit once the boss before it is behind you.
        div.classList.toggle('lit', p.unlocked > (s - 1) * LEVELS_PER_SECTOR && !(reveal === (s - 1) * LEVELS_PER_SECTOR + 1));
        this.track.append(div);
        this.dividers.push(div);
      }
      const layout = MAP_SECTORS[s - 1];
      const panel = document.createElement('section');
      panel.className = `map-sector theme-${layout.theme}`;
      panel.classList.toggle('locked', s > openSector);
      panel.dataset.sector = String(s);
      // Colours from src/config/sectors.json; story_map.css draws each theme's shapes with them.
      const c = sectorLook(s).map;
      for (const [k, v] of Object.entries({ sky: c.sky, 'sky-low': c.skyLow, ground: c.ground, 'ground-deep': c.groundDeep, trail: c.trail, deco: c.deco })) panel.style.setProperty(`--map-${k}`, v);
      for (const d of layout.deco) {
        const deco = document.createElement('div');
        deco.className = `map-deco ${d.kind}`;
        deco.style.left = `${d.x}%`;
        deco.style.top = `${d.y}%`;
        panel.append(deco);
      }
      // The trail: edge to edge through the five nodes, so it runs on across the dividers.
      const pts = layout.nodes;
      const line = [`0,${pts[0][1]}`, ...pts.map(([x, y]) => `${x},${y}`), `100,${pts[pts.length - 1][1]}`].join(' ');
      panel.insertAdjacentHTML('beforeend', `<svg class="map-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}"/></svg>`);
      for (let i = 0; i < LEVELS_PER_SECTOR; i++) panel.append(this.nodeButton((s - 1) * LEVELS_PER_SECTOR + i + 1, current, reveal));
      this.track.append(panel);
      this.panels.push(panel);
    }
    const signal = coreSignal(p.unlocked, p.finished);
    const gauge = $('map-gauge');
    gauge.innerHTML = '<i></i>'.repeat(LEVEL_COUNT);
    [...gauge.children].forEach((seg, i) => seg.classList.toggle('on', i < signal.filled));
    $('map-signal').classList.toggle('done', signal.done);
    $('map-signal-label').textContent = signal.label;
  }

  private nodeButton(level: number, current: number, reveal: number): HTMLButtonElement {
    const p = this.progress;
    const node = nodeOf(level);
    const card = levelCard(levelSpec(level));
    const boss = bossLabel(level);
    const locked = level > p.unlocked || level === reveal;
    const stars = p.stars(level);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-node';
    b.classList.toggle('boss', boss !== null);
    b.classList.toggle('duel', levelSpec(level).rival);
    b.classList.toggle('locked', locked);
    b.classList.toggle('current', !locked && level === current && !p.finished);
    b.classList.toggle('cleared', stars > 0);
    b.style.left = `${node.x}%`;
    b.style.top = `${node.y}%`;
    const starRow = [1, 2, 3].map((n) => `<b class="${n <= stars ? 'on' : ''}">★</b>`).join('');
    b.innerHTML = `<span class="map-node-stars" aria-hidden="true">${starRow}</span>`
      + `<span class="map-node-num">${card.title.replace(' BOSS', '')}</span>`
      + (locked ? PADLOCK : boss === null ? GATE : '')
      + (boss ? `<span class="map-node-name">${boss}</span>` : '');
    b.setAttribute('aria-label', t('map.aria.level', { title: card.title }) + (boss ? `, ${boss}` : '') + (stars ? t('map.aria.stars', { n: stars }) : '') + (locked ? t('map.aria.locked') : ''));
    b.addEventListener('click', () => { if (!b.classList.contains('locked')) this.openCard(level); });
    this.nodes.set(level, b);
    return b;
  }

  /** Bosco stands on `level`'s node. */
  private place(level: number): void {
    const node = nodeOf(level);
    const panel = this.panels[node.sector - 1];
    if (!panel) return;
    if (this.pawnCanvas.parentElement !== panel) panel.append(this.pawnCanvas);
    this.pawnCanvas.classList.remove('walking');
    this.pawnCanvas.style.left = `${node.x}%`;
    this.pawnCanvas.style.top = `${node.y}%`;
  }

  private walk(from: number, to: number, reveal: number): void {
    this.place(from);
    this.scrollTo(from);
    const a = nodeOf(from), b = nodeOf(to);
    if (reducedMotion()) {
      this.place(to);
      this.unlock(reveal);
      return;
    }
    this.pawnCanvas.classList.toggle('flip', b.x < a.x);
    this.pawn.show('astropaw', 'walk');
    void this.pawnCanvas.offsetWidth; // start the transition from the old node
    this.pawnCanvas.classList.add('walking');
    this.pawnCanvas.style.left = `${b.x}%`;
    this.pawnCanvas.style.top = `${b.y}%`;
    this.later(WALK_MS, () => {
      this.pawnCanvas.classList.remove('walking', 'flip');
      this.pawn.show('astropaw', 'neutral');
      this.unlock(reveal);
    });
  }

  /** After a boss: a neon swirl, then Bosco is at the next sector's first node and the divider lights up. */
  private warpTo(from: number, to: number): void {
    this.place(from);
    this.scrollTo(from);
    const ms = reducedMotion() ? 300 : WARP_MS;
    this.warp.hidden = false;
    this.warp.classList.remove('on');
    void this.warp.offsetWidth;
    this.warp.classList.add('on');
    this.later(ms / 2, () => {
      this.place(to);
      this.scrollTo(to);
      this.dividers[nodeOf(to).sector - 2]?.classList.add('lit');
      this.unlock(to);
    });
    this.later(ms, () => { this.warp.hidden = true; this.warp.classList.remove('on'); });
  }

  /** The node Bosco just reached opens with a pop. */
  private unlock(level: number): void {
    const b = this.nodes.get(level);
    if (!b || !b.classList.contains('locked') || level > this.progress.unlocked) return;
    b.classList.remove('locked');
    b.classList.add('current', 'pop');
    b.querySelector('.map-lock')?.replaceWith(document.createRange().createContextualFragment(bossLabel(level) ? '' : GATE));
    b.setAttribute('aria-label', (b.getAttribute('aria-label') ?? '').replace(t('map.aria.locked'), ''));
  }

  private scrollTo(level: number): void {
    const panel = this.panels[nodeOf(level).sector - 1];
    if (panel) this.track.scrollLeft = panel.offsetLeft - this.track.offsetLeft;
    this.updateHeader();
  }

  /** Title and stars follow the sector centred on screen. */
  private updateHeader(): void {
    if (!this.panels.length) return;
    const mid = this.track.scrollLeft + this.track.clientWidth / 2;
    let sector = 1;
    this.panels.forEach((panel, i) => { if (panel.offsetLeft - this.track.offsetLeft <= mid) sector = i + 1; });
    $('map-title').textContent = sectorTitle(sector);
    $('map-stars').textContent = sectorStars(sector, (n) => this.progress.stars(n));
  }

  private openCard(level: number): void {
    const spec = levelSpec(level);
    const text = levelCard(spec);
    this.cardLevel = level;
    $('map-card-title').textContent = text.title;
    $('map-card-sector').textContent = text.sector;
    $('map-card-icon').innerHTML = GOAL_ICONS[text.goal.icon];
    $('map-card-goal').textContent = nodeGoal(level);
    $('map-card-brief').textContent = text.briefing;
    const list = $('map-card-stars');
    list.innerHTML = '';
    for (const line of starChecklist(level, this.progress.stars(level))) {
      const li = document.createElement('li');
      li.classList.toggle('done', line.done);
      li.innerHTML = line.done ? TICK : '<span class="map-box"></span>';
      li.append(line.text);
      list.append(li);
    }
    $('map-card-best').textContent = bestLine(this.progress.bestScore(level));
    $('map-card-enter').querySelector('.go-label')!.textContent = enterLabel(level);
    this.card.hidden = false;
    $('map-card-enter').focus();
  }

  private closeCard(): void {
    if (this.card.hidden) return;
    this.card.hidden = true;
    this.nodes.get(this.cardLevel)?.focus();
  }

  /** The map stays up under the fade to black (Story play() hides it); the card closes now, so a second press can't enter twice. */
  private enter(): void {
    if (this.card.hidden) return;
    this.card.hidden = true;
    this.onEnter(this.cardLevel);
  }

  private key(e: KeyboardEvent): void {
    if (this.root.hidden) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!this.card.hidden) this.closeCard();
      else this.onBack();
      return;
    }
    if (!this.card.hidden || (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight')) return;
    // Arrow keys step between unlocked nodes.
    const open = [...this.nodes.values()].filter((b) => !b.classList.contains('locked'));
    const at = open.indexOf(document.activeElement as HTMLButtonElement);
    const next = open[Math.max(0, Math.min(open.length - 1, at < 0 ? open.length - 1 : at + (e.code === 'ArrowRight' ? 1 : -1)))];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  private loop(): void {
    if (this.raf) return;
    const tick = (now: number) => {
      if (this.root.hidden) { this.raf = 0; return; }
      this.pawn.draw(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}
