// Character sprite sheets for the menu and story scenes (2D, not Three.js).
// Metadata comes from src/assets/characters/<id>/<id>.json and is bundled (it's
// tiny); a sheet image loads only when a scene or screen first asks for that
// character, then stays cached. Without a sheet, placeholders are drawn.

export interface PoseMeta {
  /** Row of the sheet holding this pose. */
  row: number;
  frames: number;
  /** Milliseconds per frame. */
  duration: number;
}

export interface CharacterMeta {
  character: string;
  name: string;
  /** Short label for the placeholder ("KIT"). */
  label: string;
  /** Placeholder colour (CSS). */
  color: string;
  frameWidth: number;
  frameHeight: number;
  poses: Record<string, PoseMeta>;
}

const METAS = import.meta.glob<CharacterMeta>('../assets/characters/*/*.json', { eager: true, import: 'default' });
const SHEETS = import.meta.glob<string>('../assets/characters/*/*.png', { query: '?url', import: 'default' });

const byId = new Map<string, CharacterMeta>();
for (const meta of Object.values(METAS)) byId.set(meta.character, meta);
const sheetUrl = new Map<string, () => Promise<string>>();
for (const [path, load] of Object.entries(SHEETS)) sheetUrl.set(path.split('/').at(-2)!, load);

const images = new Map<string, HTMLImageElement | null>();

export function characterMeta(id: string): CharacterMeta | undefined {
  return byId.get(id);
}

export function allCharacters(): CharacterMeta[] {
  return [...byId.values()];
}

/** The pose to draw: the one asked for, else "neutral", else the first listed. */
export function resolvePose(meta: CharacterMeta, pose: string | undefined): string {
  if (pose && meta.poses[pose]) return pose;
  if (meta.poses.neutral) return 'neutral';
  return Object.keys(meta.poses)[0];
}

/** Sheet cell for a pose `ms` milliseconds after it started (frames loop). */
export function frameAt(meta: CharacterMeta, pose: string, ms: number): { row: number; col: number } {
  const p = meta.poses[resolvePose(meta, pose)];
  const col = p.frames > 1 ? Math.floor(Math.max(0, ms) / Math.max(1, p.duration)) % p.frames : 0;
  return { row: p.row, col };
}

/** Starts loading these characters' sheets (once each). */
export function preload(ids: Iterable<string>): void {
  for (const id of ids) {
    if (images.has(id)) continue;
    images.set(id, null);
    const load = sheetUrl.get(id);
    if (!load) continue;
    void load().then((url) => {
      const img = new Image();
      img.onload = () => images.set(id, img);
      img.src = url;
    });
  }
}

/** The loaded sheet, or null (not loaded yet, or no art yet: draw a placeholder). */
export function sheetOf(id: string): HTMLImageElement | null {
  if (!images.has(id)) preload([id]);
  return images.get(id) ?? null;
}
