// `npm run metrics`: the weekly numbers (docs/ANALYTICS.md, "Weekly report").
// Live from D1 through wrangler (needs `wrangler login` or CLOUDFLARE_API_TOKEN),
// or offline with --file rows.json. Options: --weeks N (default 8).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { METRICS_SQL, report, weeksUpTo } from '../src/services/metrics_report.ts';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const weeks = Math.max(1, Math.min(52, Math.trunc(Number(arg('--weeks') ?? 8)) || 8));
const today = new Date().toISOString().slice(0, 10);
const file = arg('--file');

let rows;
if (file) {
  rows = JSON.parse(readFileSync(file, 'utf8'));
} else {
  const since = weeksUpTo(today, weeks)[0];
  try {
    const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'spaceblast-analytics', '--remote', '--json', '--command', METRICS_SQL(since)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, shell: process.platform === 'win32' });
    rows = JSON.parse(out)[0].results;
  } catch (e) {
    // wrangler prints its JSON error on stdout: show what it said rather than guessing.
    const said = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim() || String(e.message ?? e);
    const login = /auth|login|token|not logged in|10000/i.test(said);
    console.log(login
      ? 'Not logged in to Cloudflare: run `npx wrangler login` once (or set CLOUDFLARE_API_TOKEN), or pass --file rows.json. See docs/ANALYTICS.md, "Weekly report".'
      : `Could not read the live analytics:\n${said.slice(0, 1200)}`);
    process.exit(1);
  }
}
console.log(report(rows, today, weeks));
