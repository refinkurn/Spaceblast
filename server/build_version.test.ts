import { describe, expect, it } from 'vitest';
import { buildVersion, commitSha, gitHead } from './build_version';

// The page (Vercel) and its Cloudflare copy are built separately from one
// commit: both must get the same version, or their players could not share rooms.

const SHA = '0123456789abcdef0123456789abcdef01234567';
const noGit = () => null;

describe('build version', () => {
  it('Vercel and Cloudflare Workers Builds of one commit get the same version', () => {
    const vercel = buildVersion('build', { VERCEL_GIT_COMMIT_SHA: SHA }, noGit);
    const workers = buildVersion('build', { WORKERS_CI_COMMIT_SHA: SHA }, noGit);
    const local = buildVersion('build', {}, () => `${SHA}\n`);
    expect(vercel).toBe('0123456789ab');
    expect(workers).toBe(vercel);
    expect(local).toBe(vercel);
  });

  it('takes the host variable over git, skips empty or bogus values, and falls back to dev', () => {
    expect(commitSha({ VERCEL_GIT_COMMIT_SHA: '', WORKERS_CI_COMMIT_SHA: SHA }, () => 'ffffffffffff')).toBe('0123456789ab');
    expect(commitSha({ VERCEL_GIT_COMMIT_SHA: 'not a sha' }, () => 'FFFFFFFFFFFF')).toBe('ffffffffffff');
    expect(buildVersion('build', {}, noGit)).toBe('dev');
  });

  it('the dev server and tests are always dev', () => {
    expect(buildVersion('serve', { VERCEL_GIT_COMMIT_SHA: SHA }, () => SHA)).toBe('dev');
  });

  it('reads this checkout with git (or null without git)', () => {
    const head = gitHead();
    if (head !== null) expect(head).toMatch(/^[0-9a-f]{40}$/);
  });
});
