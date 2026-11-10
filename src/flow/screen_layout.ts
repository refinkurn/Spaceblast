import { boardLeftAt, HUD_MAX_SCALE, HUD_PANEL_H, hudScale } from './hud';
import type { GameView } from '../view/game_view';

/**
 * Sizing: the camera and canvas fit, the touch gutters, the HUD bar and the stats
 * panel. Installs the resize listeners and returns layout(), which the loop calls
 * every frame (it only reads the canvas size and does nothing if nothing changed).
 */
export function installLayout(view: GameView): (remeasure?: boolean) => void {
  /** The notch / home-bar insets (env(safe-area-inset-*)), read off a hidden probe. */
  /** The HUD's top-left stats panel, sized in layout() from the room beside the board. */
  const hudPanel = document.querySelector('.hud-left') as HTMLElement;
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(safeProbe);
  let laidOut = '';
  let insets = { left: 0, right: 0, top: 0 };

  /**
   * Fits the camera to the canvas as it is really shown. The size is measured from
   * the canvas itself, every frame: iOS can report a stale window size after a
   * rotation or a toolbar change, and a renderer sized from that is drawn squashed.
   * Gutter width for the touch controls: about 16% of the width, 110-170 px, plus the notch.
   */
  function layout(remeasure = false) {
    const canvas = view.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (remeasure || !laidOut) {
      const safe = getComputedStyle(safeProbe);
      insets = { left: parseFloat(safe.paddingLeft) || 0, right: parseFloat(safe.paddingRight) || 0, top: parseFloat(safe.paddingTop) || 0 };
    }
    const key = `${w}x${h}|${insets.left}|${insets.right}|${insets.top}`;
    if (key === laidOut) return;
    laidOut = key;
    const gutter = Math.round(Math.min(170, Math.max(110, w * 0.16)));
    const hudHeight = 44;
    document.documentElement.style.setProperty('--gutter', `${gutter}px`);
    document.documentElement.style.setProperty('--hud', `${hudHeight}px`);
    view.layout(w, h, gutter + insets.left, gutter + insets.right, hudHeight + insets.top);
    // Stats panel: as big (up to 1.3x) and wide as the space between its left edge and the board allows,
    // measured where the board's slanted left edge is at the bottom of a full-size panel.
    const panelBottom = hudPanel.offsetTop + HUD_PANEL_H * HUD_MAX_SCALE;
    const room = Math.round(boardLeftAt(view.rig.leftEdge, panelBottom) - hudPanel.offsetLeft - 10);
    document.documentElement.style.setProperty('--hud-scale', String(hudScale(room)));
    document.documentElement.style.setProperty('--hud-room', `${Math.max(0, room)}px`);
  }
  const relayout = () => layout(true);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
  window.visualViewport?.addEventListener('resize', relayout);
  // Home-screen launches can settle their height late: measure again after load, on return to the app, and after short delays.
  const settle = () => { relayout(); setTimeout(relayout, 300); setTimeout(relayout, 1000); };
  window.addEventListener('load', settle);
  window.addEventListener('pageshow', settle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) settle(); });
  layout(true);
  return layout;
}
