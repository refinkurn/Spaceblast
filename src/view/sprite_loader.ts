// Character art for the menu and story scenes (2D, not Three.js), driven by
// data so new art never needs code changes. Each character has a folder in
// src/assets/characters/<id>/ with a character.json manifest; a manifest can
// point to texture atlases (JSON + PNG, the art team's format: named frames
// with pivots, and animations with fps and loop). Scenes ask for a pose
// ("worried"); the manifest maps poses to atlas animations. Characters without
// an atlas are drawn as labelled placeholders. See the README there.
//
// JSON is bundled (it's tiny). Images are only URLs until a scene or screen
// first asks for that character; then they load once and stay cached.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFrame extends Rect {
  /** Anchor inside the frame: feet for full-body frames, bottom centre for portraits. */
  pivot?: { x: number; y: number };
}

export interface AtlasAnimation {
  fps: number;
  loop: boolean;
  frames: string[];
}

export interface Atlas {
  meta: { image: string };
  frames: Record<string, AtlasFrame>;
  animations?: Record<string, AtlasAnimation>;
}

export interface CharacterManifest {
  id: string;
  name: string;
  /** Short label for the placeholder ("KIT"). */
  label: string;
  /** Placeholder colour (CSS). */
  color: string;
  /** Scene pose -> atlas animation. The keys are the poses this character has. */
  poses: Record<string, string>;
  /** Pixel art: nearest-neighbour scaling at whole multiples. */
  pixelArt?: boolean;
  /** Full-body atlas (file in the character's folder). */
  body?: { atlas: string };
  /** Dialogue portrait atlas; `frames` maps poses to frames (missing poses use "neutral", then the first). */
  portrait?: { atlas: string; frames: Record<string, string> };
}

/** One frame ready to draw. */
export interface SpriteFrame {
  image: string;
  rect: Rect;
  pivot: { x: number; y: number };
  pixelArt: boolean;
}

const JSON_FILES = import.meta.glob<unknown>('../assets/characters/*/*.json', { eager: true, import: 'default' });
const IMAGE_URLS = import.meta.glob<string>('../assets/characters/*/*.{png,webp}', { eager: true, query: '?url', import: 'default' });

interface Loaded {
  manifest: CharacterManifest;
  body?: Atlas;
  portrait?: Atlas;
  /** File name -> bundled URL, for this character's folder. */
  urls: Map<string, string>;
}

const characters = new Map<string, Loaded>();
{
  const byFolder = new Map<string, Map<string, unknown>>();
  const urlsByFolder = new Map<string, Map<string, string>>();
  const split = (path: string) => path.split('/').slice(-2) as [string, string];
  for (const [path, data] of Object.entries(JSON_FILES)) {
    const [folder, file] = split(path);
    if (!byFolder.has(folder)) byFolder.set(folder, new Map());
    byFolder.get(folder)!.set(file, data);
  }
  for (const [path, url] of Object.entries(IMAGE_URLS)) {
    const [folder, file] = split(path);
    if (!urlsByFolder.has(folder)) urlsByFolder.set(folder, new Map());
    urlsByFolder.get(folder)!.set(file, url);
  }
  for (const [folder, files] of byFolder) {
    const manifest = files.get('character.json') as CharacterManifest | undefined;
    if (!manifest) continue;
    characters.set(manifest.id, {
      manifest,
      body: manifest.body ? (files.get(manifest.body.atlas) as Atlas | undefined) : undefined,
      portrait: manifest.portrait ? (files.get(manifest.portrait.atlas) as Atlas | undefined) : undefined,
      urls: urlsByFolder.get(folder) ?? new Map(),
    });
  }
}

export function characterMeta(id: string): CharacterManifest | undefined {
  return characters.get(id)?.manifest;
}

export function allCharacters(): CharacterManifest[] {
  return [...characters.values()].map((c) => c.manifest);
}

/** The pose to draw: the one asked for, else "neutral", else the first listed. */
export function resolvePose(meta: CharacterManifest, pose: string | undefined): string {
  if (pose && pose in meta.poses) return pose;
  if ('neutral' in meta.poses) return 'neutral';
  return Object.keys(meta.poses)[0];
}

/**
 * The full-body frame for a pose, `ms` after the pose started: looping
 * animations cycle, the others hold their last frame. Null: no art (placeholder).
 */
export function bodyFrame(id: string, pose: string | undefined, ms: number): SpriteFrame | null {
  const c = characters.get(id);
  if (!c?.body) return null;
  const anim = c.body.animations?.[c.manifest.poses[resolvePose(c.manifest, pose)]];
  if (!anim || anim.frames.length === 0) return null;
  const n = Math.floor(Math.max(0, ms) * anim.fps / 1000);
  const i = anim.loop ? n % anim.frames.length : Math.min(n, anim.frames.length - 1);
  return frameOf(c, c.body, anim.frames[i]);
}

/** The dialogue portrait for a pose, or null (no portrait art: use the body). */
export function portraitFrame(id: string, pose: string | undefined): SpriteFrame | null {
  const c = characters.get(id);
  if (!c?.portrait || !c.manifest.portrait) return null;
  const frames = c.manifest.portrait.frames;
  const name = frames[resolvePose(c.manifest, pose)] ?? frames.neutral ?? Object.values(frames)[0];
  return name ? frameOf(c, c.portrait, name) : null;
}

function frameOf(c: Loaded, atlas: Atlas, name: string): SpriteFrame | null {
  const f = atlas.frames[name];
  const image = c.urls.get(atlas.meta.image);
  if (!f || !image) return null;
  return { image, rect: { x: f.x, y: f.y, w: f.w, h: f.h }, pivot: f.pivot ?? { x: f.w / 2, y: f.h }, pixelArt: !!c.manifest.pixelArt };
}

const images = new Map<string, HTMLImageElement>();

/** Starts loading these characters' images (once each). */
export function preload(ids: Iterable<string>): void {
  for (const id of ids) {
    const c = characters.get(id);
    if (!c) continue;
    for (const atlas of [c.body, c.portrait]) if (atlas) imageOf(c.urls.get(atlas.meta.image) ?? '');
  }
}

/** The image if it has loaded, else null (it starts loading now). */
export function imageOf(url: string): HTMLImageElement | null {
  if (!url) return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
