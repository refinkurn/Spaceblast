import { levelSpec } from '../sim/levels';
import type { StoryProgress } from './progress';
import { GOAL_ICONS } from './goal_icons';
import { bestLine, enterLabel, nodeGoal, starChecklist } from './map_text';
import { levelCard } from './story';

// The node card of the Story map: goal, briefing, star checklist, best score
// and the button that starts the level.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const TICK = '<svg class="map-tick" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';

export class StoryMapCard {
  private el = $('map-card');
  private level = 0;

  constructor(private progress: StoryProgress, private onEnter: (level: number) => void, private onClosed: (level: number) => void) {
    $('map-card-back').addEventListener('click', () => this.close());
    $('map-card-enter').addEventListener('click', () => this.enter());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  get shown(): boolean {
    return !this.el.hidden;
  }

  /** Hides the card without giving focus back. */
  hide(): void {
    this.el.hidden = true;
  }

  open(level: number): void {
    const text = levelCard(levelSpec(level));
    this.level = level;
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
    this.el.hidden = false;
    $('map-card-enter').focus();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClosed(this.level);
  }

  /** The map stays up under the fade to black; the card closes now, so a second press can't enter twice. */
  private enter(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onEnter(this.level);
  }
}
