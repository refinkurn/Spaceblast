import { cleanVersion } from '../src/net/protocol';

// What a browser asks for when it joins a room, and the small per-connection
// helpers server/room.ts uses (tokens, closing, the flood guard).

export interface Peer {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** What a browser asks for in its join URL. */
export interface JoinRequest {
  create: boolean;
  name?: string | null;
  color?: number | null;
  /** Reconnecting: the seat and the token from its welcome. */
  rejoin?: number | null;
  token?: string | null;
  /** The page's build version (?v=); missing is a page from before the version check. */
  version?: string | null;
}

/** Reads ?create, ?name, ?color, ?rejoin, ?token and ?v from a join URL. */
export function requestFromUrl(url: URL): JoinRequest {
  const num = (k: string) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : null);
  return {
    create: url.searchParams.has('create'),
    name: url.searchParams.get('name'),
    color: num('color'),
    rejoin: num('rejoin'),
    token: url.searchParams.get('token'),
    version: url.searchParams.get('v'),
  };
}

/**
 * Same build as the room's? The room keeps its first player's version (''
 * for a page from before the check); on the dev server (`dev`) a page built
 * as 'dev' joins any room and anyone joins a 'dev' room.
 */
export function sameBuild(room: string, version: unknown, dev: boolean): boolean {
  const v = cleanVersion(version);
  return v === room || (dev && (v === 'dev' || room === 'dev'));
}

export function newToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Closes a connection that may already be dead (closing one can throw): the seat bookkeeping after it must still run. */
export function hangUp(peer: Peer, code: number, reason: string): void {
  try { peer.close(code, reason); } catch { /* already gone */ }
}

/**
 * Flood guard: a browser sends ~32 messages a second (inputs, ping, hash).
 * Each peer gets a bucket of BURST messages refilled at RATE per second; one
 * that empties it is disconnected, so a broken or cheating client can't run up
 * the server bill or swamp the others.
 */
const RATE = 90;
const BURST = 150;

export interface Bucket { tokens: number; at: number }

export const fullBucket = (now: number): Bucket => ({ tokens: BURST, at: now });

/** Takes one message from a peer's flood-guard bucket; false when it is empty. */
export function takeToken(b: Bucket, now: number): boolean {
  b.tokens = Math.min(BURST, b.tokens + ((now - b.at) / 1000) * RATE) - 1;
  b.at = now;
  return b.tokens >= 0;
}
