// The ‹ value › selector used for option settings (Settings card, online lobby):
// one value at a time, the arrows step through the choices and wrap around.
// Left / Right arrow keys work while either arrow has focus. It only reports
// the picked value; the owner keeps the state and calls set() to show it.

import { t } from '../utils/i18n';

export interface StepOption<T> {
  value: T;
  label: string;
}

/** The index `dir` steps (+1 / -1) from `i` in a list of `n`, wrapping around. */
export function stepIndex(i: number, dir: number, n: number): number {
  if (n <= 0) return 0;
  return (((i + dir) % n) + n) % n;
}

const ARROW = (dir: 'prev' | 'next') => `<svg class="ui-icon" aria-hidden="true"><use href="#i-${dir}"/></svg>`;

export class Stepper<T> {
  private index = 0;
  private prev = document.createElement('button');
  private next = document.createElement('button');
  private out = document.createElement('output');

  /** Fills `el` (a .stepper element); `name` is the setting's spoken name. */
  constructor(private el: HTMLElement, private options: StepOption<T>[], private onPick: (value: T) => void, name: string) {
    el.classList.add('stepper');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', name);
    for (const [b, dir] of [[this.prev, 'prev'], [this.next, 'next']] as const) {
      b.type = 'button';
      b.className = `step-${dir}`;
      b.innerHTML = ARROW(dir);
      b.setAttribute('aria-label', t(dir === 'prev' ? 'aria.stepPrev' : 'aria.stepNext', { name }));
      b.addEventListener('click', () => this.step(dir === 'prev' ? -1 : 1));
      b.addEventListener('keydown', (e) => {
        if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        this.step(e.code === 'ArrowLeft' ? -1 : 1);
      });
    }
    this.out.className = 'step-value';
    this.out.setAttribute('aria-live', 'polite');
    el.replaceChildren(this.prev, this.out, this.next);
    this.render();
  }

  /** Shows `value` (an unknown value leaves the display as it is). */
  set(value: T): void {
    const i = this.options.findIndex((o) => o.value === value);
    if (i < 0) return;
    this.index = i;
    this.render();
  }

  /** New words for the choices (same values, e.g. after a language change). */
  relabel(options: StepOption<T>[]): void {
    this.options = options;
    this.render();
  }

  set disabled(off: boolean) {
    this.prev.disabled = off;
    this.next.disabled = off;
    this.el.classList.toggle('off', off);
  }

  private step(dir: number): void {
    const i = stepIndex(this.index, dir, this.options.length);
    this.index = i;
    this.render();
    this.onPick(this.options[i].value);
  }

  private render(): void {
    this.out.textContent = this.options[this.index]?.label ?? '';
  }
}
