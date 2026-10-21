// Leaderboard names: 2-12 letters, digits, spaces, _ or -, and no rude words
// (English and Indonesian). Used by the game before sending and by the server
// before saving. A filter can't catch everything; it stops the obvious ones.

export const NAME_MIN = 2;
export const NAME_MAX = 12;

/** Rude anywhere inside a name, even glued to other letters. */
const ANYWHERE = [
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'nigg', 'niga', 'dick', 'pussy', 'whore', 'slut',
  'nazi', 'hitler', 'porn', 'penis', 'vagina', 'boob', 'tits', 'jizz', 'wank', 'twat', 'bastard',
  'kontol', 'memek', 'ngentot', 'jancok', 'jancuk', 'bangsat', 'bajingan', 'pepek', 'lonte',
  'goblok', 'tolol', 'anjing', 'anjir', 'kampret', 'ngewe', 'pantek', 'puki',
];
/** Rude only as a whole word (inside other words they are harmless: cockpit, grape, cucumber). */
const WHOLE = [
  'ass', 'arse', 'sex', 'fag', 'cock', 'rape', 'cum', 'anal', 'babi', 'asu', 'tai', 'kntl', 'mmk', 'bego', 'jembut',
  'kimak', 'coli', 'itil', 'entot', 'perek', 'wtf', 'stfu', 'kkk',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' };
const squeeze = (s: string) => s.replace(/(.)\1+/g, '$1');

export function isRude(name: string): boolean {
  // Lowercase, look-alike digits as letters; also try with repeated letters
  // squeezed ("fuuuck" -> "fuck").
  const base = [...name.toLowerCase()].map((c) => LEET[c] ?? c).join('');
  for (const form of [base, squeeze(base)]) {
    const glued = form.replace(/[^a-z]/g, '');
    if (ANYWHERE.some((w) => glued.includes(w))) return true;
    if (form.split(/[^a-z]+/).some((w) => WHOLE.includes(w))) return true;
  }
  return false;
}

/** The name tidied up, or null if it can't be used. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  if (name.length < NAME_MIN || !/^[A-Za-z0-9 _-]+$/.test(name)) return null;
  return isRude(name) ? null : name;
}

/** A friendly default like "Bosco_482". */
export function defaultName(random = Math.random): string {
  return `Bosco_${100 + Math.floor(random() * 900)}`;
}
