// Small helpers for the online screens: saved name + colour, session storage, the Back button label.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const session = (): Storage | null => {
  try { return window.sessionStorage; } catch { return null; }
};

const PREFS_KEY = 'spaceblast.online';

export function loadPrefs(): { name: string; color: number } {
  try {
    return { name: '', color: -1, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { name: '', color: -1 };
  }
}

export function savePrefs(name: string, color: number): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ name, color })); } catch { /* private mode */ }
}

/** The name a room uses: the CrazyGames account name wins, else what was typed (saved prefs). */
export function chooseOnlineName(account: string | null, typed: string): string {
  return account ?? typed;
}

/** The Back icon button says what it does: "Back" on the join screen, "Leave room" in the lobby. */
export function backLabel(label: string): void {
  const back = $('online-back');
  back.setAttribute('aria-label', label);
  back.title = label;
}
