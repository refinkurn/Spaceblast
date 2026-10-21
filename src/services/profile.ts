import { cleanName, defaultName } from './name_filter';

// The leaderboard identity, with no sign-in: a random device id made on the
// first launch and a display name ("Bosco_482" until the player changes it).
// Both live in localStorage; private mode gets a fresh pair per visit.

const KEY = 'spaceblast.profile';

export interface Profile {
  uuid: string;
  name: string;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let cached: Profile | null = null;

export function loadProfile(): Profile {
  if (cached) return cached;
  let p: Partial<Profile> = {};
  try { p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Profile>; } catch { /* private mode */ }
  const uuid = typeof p.uuid === 'string' && /^[0-9a-f-]{36}$/.test(p.uuid) ? p.uuid : newUuid();
  cached = { uuid, name: cleanName(p.name) ?? defaultName() };
  save(cached);
  return cached;
}

/** Sets the display name; returns false (and keeps the old one) if it can't be used. */
export function renameProfile(name: string): boolean {
  const clean = cleanName(name);
  if (!clean) return false;
  const p = loadProfile();
  p.name = clean;
  save(p);
  return true;
}

function save(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
