// `npm run status`: where the project stands, without asking an agent.
// Reads git, docs/HANDOFF.md, docs/PHONE_TEST.md and the file-length rule.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const section = (md, name) => (md.split(/^## /m).find((s) => s.startsWith(name)) ?? '').split('\n').slice(1).join('\n');
const items = (text) => text.split('\n').filter((l) => /^- \*\*/.test(l)).map((l) => l.replace(/^- \*\*(.+?)\*\*.*/, '$1'));

const handoff = read('docs/HANDOFF.md');
const out = [];
out.push(`# Spaceblast status (${new Date().toISOString().slice(0, 10)})`, '');
out.push(`Branch ${sh('git rev-parse --abbrev-ref HEAD')} at ${sh('git log -1 --format=%h\\ %s')}`);
out.push(`Commits in the last 7 days: ${sh('git rev-list --count --since="7 days ago" HEAD')}`, '');
for (const name of ['Ready', 'In progress', 'Blocked', 'Known issues']) {
  const list = items(section(handoff, name));
  out.push(`## ${name} (${list.length})`, ...list.map((i) => `- ${i}`), '');
}
const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
const done = section(handoff, 'Done').split('\n').filter((l) => /^- \d{4}-/.test(l) && l.slice(2, 12) >= weekAgo);
out.push(`## Done, last 7 days (${done.length})`, ...done.map((l) => l.length > 150 ? `${l.slice(0, 147)}...` : l), '');
const phone = read('docs/PHONE_TEST.md').split('\n').filter((l) => l.startsWith('- [ ]'));
out.push(`## Phone checks waiting for Refindo (${phone.length})`, ...phone.map((l) => l.length > 150 ? `${l.slice(0, 147)}...` : l), '');
const long = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(n) && !/\.test\.ts$/.test(n)) { const lines = read(p).split('\n').length; if (lines > 320) long.push(`- ${p}: ${lines} lines`); } } };
walk('src'); walk('server');
out.push(`## Files over the ~300-line rule (${long.length})`, ...long, '');
console.log(out.join('\n'));
