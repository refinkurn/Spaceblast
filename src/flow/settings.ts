// Player settings, saved on this device, and the Settings card (menu or over a paused game).

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const KEY = 'spaceblast.settings';

import type { JoystickMode } from '../input/stick_geometry';
import { t } from '../utils/i18n';
import { Stepper } from './stepper';

export type ControlSize = 'small' | 'normal' | 'large';
/** Round-end cinematic: replay + winner, winner only, or none. */
export type CinematicLength = 'full' | 'short' | 'off';

export interface Settings {
  /** 0-100 */
  music: number;
  sfx: number;
  controls: ControlSize;
  cinematic: CinematicLength;
  joystick: JoystickMode;
  /** Haptic buzz (only used where navigator.vibrate exists). */
  vibration: boolean;
  /** Camera shake on nearby blasts. */
  screenShake: boolean;
}

/** Players who ask for reduced motion start with screen shake off. */
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS: Settings = { music: 70, sfx: 90, controls: 'normal', cinematic: 'full', joystick: 'floating', vibration: true, screenShake: true };
export const DEFAULT_SETTINGS = DEFAULTS;
export const CONTROL_SCALE: Record<ControlSize, number> = { small: 0.82, normal: 1, large: 1.22 };

/** Saved settings, checked field by field (old or edited data falls back to defaults). */
export function loadSettings(): Settings {
  let raw: Partial<Settings> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch { /* private mode or broken data */ }
  const volume = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 100 ? v : d);
  return {
    music: volume(raw.music, DEFAULTS.music),
    sfx: volume(raw.sfx, DEFAULTS.sfx),
    controls: raw.controls === 'small' || raw.controls === 'large' ? raw.controls : DEFAULTS.controls,
    cinematic: raw.cinematic === 'short' || raw.cinematic === 'off' ? raw.cinematic : 'full',
    joystick: raw.joystick === 'fixed' ? 'fixed' : 'floating',
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : DEFAULTS.vibration,
    screenShake: typeof raw.screenShake === 'boolean' ? raw.screenShake : !prefersReducedMotion(),
  };
}

/** A ‹ value › selector for one setting; the labels come from the opt.<id>.<value> keys. */
function stepper<T>(id: string, values: readonly T[], words: (v: T) => string, nameKey: string, pick: (v: T) => void): Stepper<T> {
  return new Stepper($(id), values.map((v) => ({ value: v, label: t(`opt.${id}.${words(v)}`) })), pick, t(nameKey));
}

const onOff = (v: boolean) => (v ? 'on' : 'off');

export class SettingsScreen {
  readonly value: Settings = loadSettings();
  private steppers: { show(s: Settings): void }[] = [];

  /** `onChange` runs now and after every change. */
  constructor(private onChange: (s: Settings) => void) {
    for (const key of ['music', 'sfx'] as const) {
      const input = $(`set-${key}`) as HTMLInputElement;
      input.value = String(this.value[key]);
      input.addEventListener('input', () => this.set({ [key]: Number(input.value) }));
    }
    // Option settings: one ‹ value › selector each.
    const controls = stepper<ControlSize>('set-controls', ['small', 'normal', 'large'], (v) => v, 'settings.controls', (controls) => this.set({ controls }));
    const joystick = stepper<JoystickMode>('set-joystick', ['floating', 'fixed'], (v) => v, 'settings.joystick', (joystick) => this.set({ joystick }));
    const vibration = stepper('set-vibration', [true, false], onOff, 'settings.vibration', (vibration) => this.set({ vibration }));
    const shake = stepper('set-shake', [true, false], onOff, 'settings.shake', (screenShake) => this.set({ screenShake }));
    const cinematic = stepper<CinematicLength>('set-cinematic', ['full', 'short', 'off'], (v) => v, 'settings.replays', (cinematic) => this.set({ cinematic }));
    this.steppers = [
      { show: (v) => controls.set(v.controls) },
      { show: (v) => joystick.set(v.joystick) },
      { show: (v) => vibration.set(v.vibration) },
      { show: (v) => shake.set(v.screenShake) },
      { show: (v) => cinematic.set(v.cinematic) },
    ];
    // Vibration: shown only where the browser can buzz (iOS Safari has no navigator.vibrate).
    $('set-vibration-line').hidden = !('vibrate' in navigator);
    this.render();
    onChange(this.value);
  }

  private set(change: Partial<Settings>): void {
    Object.assign(this.value, change);
    try { localStorage.setItem(KEY, JSON.stringify(this.value)); } catch { /* private mode */ }
    this.render();
    this.onChange(this.value);
  }

  private render(): void {
    for (const st of this.steppers) st.show(this.value);
    $('set-music-value').textContent = `${this.value.music}%`;
    $('set-sfx-value').textContent = `${this.value.sfx}%`;
  }
}
