import type { GoalIcon } from './story';

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Inline SVG icons for the level card's goal row (no emoji). */
export const GOAL_ICONS: Record<GoalIcon, string> = {
  gate: svg('<ellipse cx="12" cy="12" rx="5" ry="9"/><ellipse cx="12" cy="12" rx="1.5" ry="4"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  duel: svg('<path d="M5 19L17 7M14 4h6v6M19 19L7 7M10 4H4v6"/>'),
};
