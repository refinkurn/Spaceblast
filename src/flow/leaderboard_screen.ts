import { LEVEL_COUNT } from '../sim/levels';
import { leaderboard } from '../services/leaderboardApi';
import { NAME_MAX } from '../services/name_filter';
import { loadProfile, renameProfile } from '../services/profile';
import { stageId } from '../services/score';
import type { ScoreRow } from '../services/leaderboard_types';

// The Story leaderboard, opened from the level map: one level at a time
// (arrows to change), the top 10, your own best and rank, and your name.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fmt = (n: number) => n.toLocaleString('en-US');
const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export class LeaderboardScreen {
  private el = $('leaderboard');
  private level = 1;
  /** Ignores answers that arrive after the player moved to another level. */
  private asked = 0;

  constructor(private onClose: () => void) {
    $('lb-prev').addEventListener('click', () => this.show(this.level - 1));
    $('lb-next').addEventListener('click', () => this.show(this.level + 1));
    $('lb-back').addEventListener('click', () => this.close());
    const input = $<HTMLInputElement>('lb-name');
    input.maxLength = NAME_MAX;
    $('lb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = renameProfile(input.value);
      $('lb-name-note').textContent = ok ? 'Saved. It shows with your next score.' : 'Try another name (2-12 letters or numbers, nothing rude).';
      input.value = loadProfile().name;
    });
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  show(level: number): void {
    this.level = Math.max(1, Math.min(LEVEL_COUNT, level));
    this.el.hidden = false;
    $<HTMLInputElement>('lb-name').value = loadProfile().name;
    $('lb-level').textContent = `Level ${this.level}`;
    $<HTMLButtonElement>('lb-prev').disabled = this.level <= 1;
    $<HTMLButtonElement>('lb-next').disabled = this.level >= LEVEL_COUNT;
    const list = $('lb-list');
    list.innerHTML = '';
    $('lb-status').textContent = 'Loading…';
    $('lb-you').textContent = '';
    const ask = ++this.asked;
    const me = loadProfile();
    void leaderboard.top(stageId(this.level), me.uuid).then((res) => {
      if (ask !== this.asked || !this.open) return;
      if (!res) {
        $('lb-status').textContent = 'Offline. Scores are sent when you are back online.';
        return;
      }
      $('lb-status').textContent = res.top.length ? '' : 'No scores yet. Be the first!';
      for (const row of res.top) list.append(this.row(row, row.rank === res.you?.rank && row.display_name === res.you?.display_name));
      if (res.you && !res.top.some((r) => r.rank === res.you!.rank)) $('lb-you').textContent = `You: #${res.you.rank} · ${fmt(res.you.score)}`;
    });
  }

  close(): void {
    this.hide();
    this.onClose();
  }

  /** Closes without going back to the level map (leaving Story Mode). */
  hide(): void {
    this.el.hidden = true;
    this.asked++;
  }

  private row(r: ScoreRow, mine: boolean): HTMLLIElement {
    const li = document.createElement('li');
    if (mine) li.className = 'me';
    const cells = [`#${r.rank}`, r.display_name, fmt(r.score), time(r.completion_time_seconds), '★'.repeat(r.stars)];
    for (const text of cells) {
      const span = document.createElement('span');
      span.textContent = text;
      li.append(span);
    }
    return li;
  }
}
