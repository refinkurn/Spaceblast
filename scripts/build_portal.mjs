// Portal build (CrazyGames first): `npm run build:portal`. Builds the game into
// dist-portal/ with VITE_PORTAL set (src/config/portal.ts), pointing at our room
// server, then checks the portal's limits and writes spaceblast-portal.zip to
// upload in the portal's developer page. Rules: docs/PORTAL.md.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORTAL = process.env.VITE_PORTAL || 'crazygames';
const SERVER = process.env.PORTAL_SERVER || 'spaceblast.refinkurn.workers.dev';
const OUT = 'dist-portal';
const ZIP = 'spaceblast-portal.zip';
// CrazyGames: at most 1500 files; 20 MB to be shown on the mobile homepage (50 MB otherwise).
const MAX_FILES = 1500;
const MAX_BYTES = 20 * 1024 * 1024;

const env = { ...process.env, VITE_PORTAL: PORTAL, VITE_API_BASE: `https://${SERVER}`, VITE_RELAY_URL: `wss://${SERVER}` };
execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { stdio: 'inherit', env });
// Nothing to install inside a portal's page.
for (const f of ['manifest.webmanifest', 'sw.js']) rmSync(join(OUT, f), { force: true });
const page = join(OUT, 'index.html');
writeFileSync(page, readFileSync(page, 'utf8')
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<meta name="(?:apple-mobile-web-app-[\w-]+|mobile-web-app-capable)"[^>]*>/g, ''));

const files = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(OUT);
const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
const problems = [];
if (files.length > MAX_FILES) problems.push(`${files.length} files (limit ${MAX_FILES})`);
if (bytes > MAX_BYTES) problems.push(`${(bytes / 1048576).toFixed(1)} MB (limit 20 MB for the mobile homepage)`);
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
// The portal serves the game from a sub-folder: every path must be relative.
const absolute = html.match(/(?:src|href)="\/[^/"][^"]*"/g);
if (absolute) problems.push(`absolute paths in index.html: ${absolute.join(', ')}`);
if (/rel="manifest"/.test(html)) problems.push('index.html still links the web manifest');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
if (!js.includes(`https://${SERVER}`)) problems.push('the build does not point at the room server');
if (js.includes('cloudflareinsights')) problems.push('the Cloudflare beacon is in the portal build');

rmSync(ZIP, { force: true });
execSync(`cd ${OUT} && zip -q -r ../${ZIP} .`);
console.log(`\n${OUT}/: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB; ${ZIP}: ${(statSync(ZIP).size / 1048576).toFixed(2)} MB`);
if (problems.length) { console.log('PROBLEMS:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Portal limits OK. Upload the zip in the CrazyGames developer page (Refindo submits).');
