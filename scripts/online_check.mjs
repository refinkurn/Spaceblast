// `npm run online-check`: two browsers create and join a room on the dev server,
// start a round and play the same frames (same state hash). Catches a broken
// lobby, a round that does not start, and desyncs. Not part of CI by default.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5189;
const local = '/opt/pw-browsers/chromium';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch({
  ...(existsSync(local) ? { executablePath: local } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const problems = [];
const tap = (p, id) => p.evaluate((i) => document.getElementById(i).click(), id);
async function open(name) {
  const p = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
  p.on('pageerror', (e) => problems.push(`${name}: script error: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(1200);
  await p.click('#start-screen');
  await p.waitForTimeout(1000);
  await tap(p, 'mode-online');
  await p.waitForTimeout(600);
  await p.fill('#online-name', name);
  return p;
}

const a = await open('Ana');
await tap(a, 'online-create');
await a.waitForSelector('#online-lobby:not([hidden])', { timeout: 8000 });
const code = (await a.textContent('#online-room')).trim();
const b = await open('Bo');
await b.fill('#online-code', code);
await tap(b, 'online-join');
await b.waitForSelector('#online-lobby:not([hidden])', { timeout: 8000 });
await a.waitForTimeout(600);
await tap(a, 'online-start');
await a.waitForTimeout(7000);

const snap = (p) => p.evaluate(() => ({ tick: window.spaceblast.state.tick, mode: window.spaceblast.state.mode, players: window.spaceblast.state.players.length }));
const [sa, sb] = [await snap(a), await snap(b)];
if (sa.mode !== 'battle' || sb.mode !== 'battle') problems.push(`round did not start (A ${sa.mode}, B ${sb.mode})`);
if (sa.tick < 120 || sb.tick < 120) problems.push(`round is not running (ticks A ${sa.tick}, B ${sb.tick})`);
// Both pages show the server's own "desync" notice if their hashes ever differ.
for (const [n, p] of [['A', a], ['B', b]]) {
  const text = await p.evaluate(() => document.body.innerText);
  if (/desync|out of sync/i.test(text)) problems.push(`${n} reports a desync`);
}
await a.screenshot({ path: 'shots/online-a.png' }).catch(() => {});
await browser.close();
stop();
console.log(problems.length ? 'ONLINE PROBLEMS:\n- ' + problems.join('\n- ') : `Online OK: room ${code}, both browsers in the round (ticks ${sa.tick} / ${sb.tick}).`);
process.exit(problems.length ? 1 : 0);
