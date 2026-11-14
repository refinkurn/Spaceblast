// Frame-rate check for a weak machine (CrazyGames wants the game smooth on a 4 GB Chromebook).
// Opens the dev server at 1366x768 with the CPU throttled 4x, plays 20 s of Story level 1 and
// 20 s of Battle vs Bot, and prints average fps, the 1% worst frame time and draw calls.
// `npm run perf`. It reports numbers and exits 0; fps under 50 is flagged as LOW, not a failure.
// Note: without a GPU (CI, cloud) the browser draws in software, so numbers there are lower
// than a real Chromebook's; PORTAL.md says where each number came from.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5188;
const THROTTLE = 4;
const SECONDS = 20;
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
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

const tapCards = () => p.evaluate(() => { for (const id of ['cutscene', 'intro-card', 'level-card']) { const e = document.getElementById(id); if (e && !e.hidden) e.click(); } });
const tick = () => p.evaluate(() => window.spaceblast.state.tick);

/** Wait until the round runs (cards and the 3-2-1 count are over). */
async function untilRunning() {
  await p.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) {
    await tapCards();
    const a = await tick();
    await p.waitForTimeout(400);
    if ((await tick()) > a) return true;
  }
  return false;
}

/** Frame times (rAF gaps) and draw calls over `SECONDS`. */
function measure() {
  return p.evaluate((ms) => new Promise((resolve) => {
    const gaps = [];
    let last = performance.now();
    const t0 = last;
    let calls = 0;
    let samples = 0;
    const frame = (now) => {
      gaps.push(now - last);
      last = now;
      const info = window.spaceblast.view.renderer.info.render;
      calls += info.calls; samples++;
      if (now - t0 < ms) requestAnimationFrame(frame);
      else resolve({ gaps, calls: samples ? calls / samples : 0 });
    };
    requestAnimationFrame(frame);
  }), SECONDS * 1000);
}

function summary(name, r) {
  const g = r.gaps.slice(1).sort((a, b) => a - b);
  const total = g.reduce((s, x) => s + x, 0);
  const fps = g.length / (total / 1000);
  const worst = g.slice(Math.floor(g.length * 0.99));
  const p99 = worst.reduce((s, x) => s + x, 0) / Math.max(1, worst.length);
  const low = fps < 50;
  console.log(`${name}: avg ${fps.toFixed(1)} fps, 1% worst frame ${p99.toFixed(1)} ms, draw calls ${Math.round(r.calls)}, ${g.length} frames${low ? '  LOW (< 50 fps)' : ''}`);
  return { fps, p99, calls: r.calls, low };
}

console.log(`perf: 1366x768, CPU throttled ${THROTTLE}x, ${SECONDS} s per run`);
await p.goto(`http://localhost:${PORT}/`);
await p.waitForTimeout(1500);
await p.click('#start-screen');
await p.waitForTimeout(900);

// Story level 1.
await p.evaluate(() => window.spaceblast.startLevel(1));
if (!(await untilRunning())) console.log('  warning: Story level 1 did not start running');
const story = summary('Story level 1', await measure());

// Battle vs Bot (menu: Versus, Battle vs Bot, Normal).
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
await p.evaluate(() => window.spaceblast.startLevel(1)); // known state before leaving the level
await p.reload();
await p.waitForTimeout(1500);
await p.click('#start-screen');
await p.waitForTimeout(900);
await p.evaluate(() => {
  document.getElementById('menu-versus').click();
  document.getElementById('mode-battle').click();
});
await p.waitForTimeout(600);
await p.evaluate(() => document.querySelector('#menu-bot [data-level="normal"]').click());
if (!(await untilRunning())) console.log('  warning: Battle vs Bot did not start running');
const battle = summary('Battle vs Bot', await measure());

await browser.close();
stop();
if (errors.length) console.log(`script errors on the page: ${errors.slice(0, 3).join(' | ')}`);
if (story.low || battle.low) console.log('Some run is under 50 fps: add a Known issue with these numbers (docs/HANDOFF.md).');
process.exit(0);
