// Player settings, saved on this device, and the Settings screen.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const KEY = 'spaceblast.settings';

export type ControlSize = 'small' | 'normal' | 'large';
/** Round-end cinematic: replay + winner, winner only, or none. */
export type CinematicLength = 'full' | 'short' | 'off';

export interface Settings {
  /** 0-100 */
  music: number;
  sfx: number;
  controls: ControlSize;
  cinematic: CinematicLength;
}

const DEFAULTS: Settings = { music: 70, sfx: 90, controls: 'normal', cinematic: 'full' };
export const CONTROL_SCALE: Record<ControlSize, number> = { small: 0.82, normal: 1, large: 1.22 };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export class SettingsScreen {
  readonly value: Settings = load();
  private el = $('settings');

  /** `onChange` runs now and after every change. */
  constructor(private onChange: (s: Settings) => void) {
    for (const key of ['music', 'sfx'] as const) {
      const input = $(`set-${key}`) as HTMLInputElement;
      input.value = String(this.value[key]);
      input.addEventListener('input', () => this.set({ [key]: Number(input.value) }));
    }
    for (const [group, key] of [['set-controls', 'controls'], ['set-cinematic', 'cinematic']] as const) {
      for (const el of $(group).children) {
        const b = el as HTMLButtonElement;
        b.addEventListener('click', () => this.set({ [key]: b.dataset.value } as Partial<Settings>));
      }
    }
    $('settings-done').addEventListener('click', () => this.close());
    $('menu-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });
    this.render();
    onChange(this.value);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.el.hidden = false;
  }

  close(): void {
    this.el.hidden = true;
  }

  private set(change: Partial<Settings>): void {
    Object.assign(this.value, change);
    try { localStorage.setItem(KEY, JSON.stringify(this.value)); } catch { /* private mode */ }
    this.render();
    this.onChange(this.value);
  }

  private render(): void {
    for (const [group, key] of [['set-controls', 'controls'], ['set-cinematic', 'cinematic']] as const) {
      for (const el of $(group).children) el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.value === this.value[key]));
    }
    $('set-music-value').textContent = `${this.value.music}%`;
    $('set-sfx-value').textContent = `${this.value.sfx}%`;
  }
}
