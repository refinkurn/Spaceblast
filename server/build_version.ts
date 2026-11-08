import { execSync } from 'node:child_process';

// The build version a page sends when it joins a room (src/net/build.ts reads
// it as __BUILD__, put in by vite.config.ts). A room seats one version only,
// so it must be the same for every copy of the page built from one commit:
// Vercel builds the page and Cloudflare Workers Builds builds its own copy
// separately, so it comes from the commit, not from the files or the clock.

/** How much of the commit SHA to keep (plenty to tell builds apart). */
const SHA_LENGTH = 12;

/** The commit being built: the host's variable, else git, else null. */
export function commitSha(env: Record<string, string | undefined>, git: () => string | null): string | null {
  for (const raw of [env.VERCEL_GIT_COMMIT_SHA, env.WORKERS_CI_COMMIT_SHA, git()]) {
    const sha = raw?.trim().toLowerCase().slice(0, SHA_LENGTH) ?? '';
    if (/^[0-9a-f]{7,}$/.test(sha)) return sha;
  }
  return null;
}

/** 'dev' for the dev server (and tests) or when no commit is known; else the commit. */
export function buildVersion(command: 'serve' | 'build', env: Record<string, string | undefined>, git: () => string | null): string {
  return command === 'serve' ? 'dev' : (commitSha(env, git) ?? 'dev');
}

/** `git rev-parse HEAD`, or null without git (or outside a checkout). */
export function gitHead(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
