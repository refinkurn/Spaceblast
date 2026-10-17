// Full screen. Android, iPad and computers can go full screen from a button.
// iPhone Safari can't (Apple only allows it for videos), but a game added to
// the Home Screen opens without any browser bars, so there the button shows
// how to do that instead. Installed, the buttons hide.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const ICON_ENTER = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_EXIT = '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as FsDocument;

/** Opened from the Home Screen (no browser bars at all). */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone (and iPod): Safari there never allows a page to go full screen. */
const isIphone = () => /iPhone|iPod/.test(navigator.userAgent);

function canFullscreen(): boolean {
  return !isIphone() && !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

function isFullscreen(): boolean {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** Devices where Add to Home Screen is the way to full screen. */
const isIos = () => isIphone() || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !canFullscreen());

/** Enters full screen (and landscape where allowed). Must run from a tap. */
export function enterFullscreen(): void {
  const el = document.documentElement as FsElement;
  const done = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {});
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(done).catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

export function setupFullscreen(): void {
  const buttons = [$('full-btn'), $('menu-full')];
  const render = () => {
    const hide = isInstalled() || (!canFullscreen() && !isIos());
    for (const b of buttons) {
      b.hidden = hide;
      b.innerHTML = isFullscreen() ? ICON_EXIT : ICON_ENTER;
      b.setAttribute('aria-label', isFullscreen() ? 'Exit full screen' : 'Full screen');
      b.title = b.getAttribute('aria-label')!;
    }
  };
  for (const b of buttons) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!canFullscreen()) {
        $('install').hidden = false;
      } else if (isFullscreen()) {
        if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {});
        else doc.webkitExitFullscreen?.();
      } else {
        enterFullscreen();
      }
    });
  }
  $('install-ok').addEventListener('click', () => ($('install').hidden = true));
  document.addEventListener('fullscreenchange', render);
  document.addEventListener('webkitfullscreenchange', render);
  $('start-tip').hidden = !(isIos() && !isInstalled());
  render();
}
