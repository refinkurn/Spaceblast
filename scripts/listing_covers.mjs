// Makes the three portal cover images (docs/LISTING.md) from the menu key art
// and the game's own title type: listing/cover-landscape.jpg (1920x1080),
// cover-portrait.jpg (800x1200), cover-square.jpg (800x800).
//   node scripts/listing_covers.mjs
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const b64 = (path) => readFileSync(path).toString('base64');
const art = `data:image/webp;base64,${b64('src/assets/menu/menu_bg_1920x1080.webp')}`;
const font = `data:font/woff2;base64,${b64('node_modules/@fontsource/russo-one/files/russo-one-latin-400-normal.woff2')}`;
// focus: where the heroes sit in the art (0-100%), so every crop keeps them.
const COVERS = [
  { name: 'landscape', w: 1920, h: 1080, focus: '50% 50%', size: 190, pad: 70, align: 'left' },
  { name: 'portrait', w: 800, h: 1200, focus: '74% 50%', size: 98, pad: 44, align: 'center' },
  { name: 'square', w: 800, h: 800, focus: '72% 50%', size: 98, pad: 40, align: 'center' },
];
const page = (c) => `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Russo; src: url(${font}) format('woff2'); }
html, body { margin: 0; width: ${c.w}px; height: ${c.h}px; overflow: hidden; background: #14161d; }
.art { position: absolute; inset: 0; background: url(${art}) ${c.focus} / cover no-repeat; }
.shade { position: absolute; inset: 0; background: linear-gradient(to top, #0b0d13f2 0%, #0b0d13b0 16%, #0b0d1300 42%); }
h1 { position: absolute; left: ${c.pad}px; right: ${c.pad}px; bottom: ${Math.round(c.pad * 0.9)}px; margin: 0; text-align: ${c.align};
  font: 400 ${c.size}px/0.95 Russo, sans-serif; letter-spacing: 0.02em; color: #e8ecf5;
  text-shadow: 0 ${Math.round(c.size / 22)}px 0 #06080c, 0 0 ${Math.round(c.size / 3)}px #5ad1ff80; }
h1 b { font-weight: 400; color: #5ad1ff; }
</style><div class="art"></div><div class="shade"></div><h1>SPACE<b>BLAST</b></h1>`;

mkdirSync('listing', { recursive: true });
const local = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
for (const c of COVERS) {
  const p = await browser.newPage({ viewport: { width: c.w, height: c.h } });
  await p.setContent(page(c));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `listing/cover-${c.name}.jpg`, type: 'jpeg', quality: 93 });
  console.log(`listing/cover-${c.name}.jpg ${c.w}x${c.h}`);
  await p.close();
}
await browser.close();
