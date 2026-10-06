// The pictures at the top of the public README, made from the built site so
// they never drift from what the library actually draws.
//
//   npm run docs:build && node tools/readme-art.mjs
//
// Writes docs/readme/:
//   hero.light.gif / hero.dark.gif   the home page as the tiatr curtain rises
//   scenes.light.jpg / .dark.jpg     twelve scenes, named
//   registers.light.jpg / .dark.jpg  one piece in quiet, warm and playful
// and apps/docs/og.jpg, the 1200 x 630 link-preview card (commit it, then rebuild)
//
// The grids are laid out as an HTML page in the site's own fonts and
// screenshotted; the GIF is a Playwright video turned into a palette GIF by
// ffmpeg (which must be on PATH).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer, REPO_ROOT } from './serve.mjs';

const SITE = join(REPO_ROOT, 'out', 'docs');
const OUT = join(REPO_ROOT, 'docs', 'readme');
const SCENES = ['kantar', 'vad', 'tinto', 'toran', 'dar', 'saanj', 'shet', 'tollem', 'pahat', 'mithagar', 'ferry', 'themb'];
const REGISTER_PIECES = [['event-card', 'sg-event-card'], ['postcard', 'sg-postcard'], ['stamp', 'sg-stamp[seed="paid"]']];
const THEMES = ['light', 'dark'];

if (!existsSync(join(SITE, 'index.html'))) {
  console.error('Build the site first: npm run docs:build');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const sheetCss = theme => `
  :root { color-scheme: ${theme}; }
  body { margin: 0; padding: 28px; background: ${theme === 'dark' ? '#14182a' : '#f1ebe1'};
         color: ${theme === 'dark' ? '#ece4d6' : '#1d2440'}; font-family: var(--body, system-ui); }
  .grid { display: grid; gap: 18px; }
  figure { margin: 0; }
  img { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0,0,0,${theme === 'dark' ? '.45' : '.12'}); }
  figcaption { font-family: var(--r-hand, var(--display)); font-size: 19px; margin-top: 6px; opacity: .85; }
`;

function sheet(theme, body, cols) {
  return `<!doctype html><html lang="en" data-register="warm" data-palette="susegad" data-theme="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="packages/tokens/fonts.css"><link rel="stylesheet" href="packages/tokens/tokens.css">
<link rel="stylesheet" href="docs.css"><style>${sheetCss(theme)} .grid { grid-template-columns: repeat(${cols}, 1fr); }</style></head>
<body><div class="grid">${body}</div></body></html>`;
}

const scenesBody = theme => SCENES.map(s =>
  `<figure><img src="posters/scene-${s}.warm.${theme}.jpg" alt=""><figcaption>${s}</figcaption></figure>`).join('');

const registersBody = theme => REGISTER_PIECES.flatMap(([p]) => ['quiet', 'warm', 'playful'].map(r =>
  `<figure><img src="_readme-${p}-${r}-${theme}.png" alt="" style="aspect-ratio:auto;object-fit:contain"><figcaption>${p}, ${r}</figcaption></figure>`)).join('');

/** One piece, from its own demo page, in one register: the root says the register and nothing inside overrides it. */
async function shootPiece(browser, base, [piece, tag], register, theme) {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(`${base}/packages/components/${piece}/demo.html`);
  await page.evaluate(r => {
    for (const el of document.querySelectorAll('body [data-register], body [register]')) { el.removeAttribute('data-register'); el.removeAttribute('register'); }
    document.documentElement.dataset.register = r;
  }, register);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const file = join(SITE, `_readme-${piece}-${register}-${theme}.png`);
  await page.locator(tag).first().screenshot({ path: file, animations: 'disabled' });
  await page.close();
  return file;
}

const server = await startServer({ root: SITE, quiet: true, notFoundHtml: '404.html' });
const base = server.url ?? `http://127.0.0.1:${server.port}`;
const browser = await chromium.launch();
const tmpPages = [];

try {
  // ── the pieces, one register at a time ─────────────────────────────
  for (const theme of THEMES) for (const p of REGISTER_PIECES) for (const r of ['quiet', 'warm', 'playful']) tmpPages.push(await shootPiece(browser, base, p, r, theme));

  // ── the grids ──────────────────────────────────────────────────────
  for (const theme of THEMES) {
    for (const [name, body, cols] of [['scenes', scenesBody(theme), 4], ['registers', registersBody(theme), 3]]) {
      const file = `_readme-${name}-${theme}.html`;
      writeFileSync(join(SITE, file), sheet(theme, body, cols));
      tmpPages.push(join(SITE, file));
      const page = await browser.newPage({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1, colorScheme: theme });
      await page.goto(`${base}/${file}`);
      await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
      await page.evaluate(() => document.fonts.ready);
      const png = join(tmpdir(), `sg-${name}-${theme}.png`);
      await page.screenshot({ path: png, fullPage: true });
      await page.close();
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1400:-1', '-q:v', '4', join(OUT, `${name}.${theme}.jpg`)]);
    }
  }

  // ── the link-preview card: big words and the tiatr, legible as a thumbnail ──
  {
    const file = '_readme-og.html';
    writeFileSync(join(SITE, file), `<!doctype html><html lang="en" data-register="warm" data-palette="susegad" data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="packages/tokens/fonts.css"><link rel="stylesheet" href="packages/tokens/tokens.css"><link rel="stylesheet" href="docs.css">
<style>
  /* Chat apps show this either wide (1200 x 630) or cut to the centre square
     (x 285 to 915). Everything that matters sits in that square; the two side
     scenes only add to the wide view. */
  body { margin: 0; width: 1200px; height: 630px; background: #f1ebe1; color: #1d2440; position: relative; overflow: hidden; }
  .side { position: absolute; top: 50%; transform: translateY(-50%); width: 250px; height: 380px; object-fit: cover; border-radius: 8px; opacity: .9; }
  .left { left: 18px; } .right { right: 18px; }
  .mid { position: absolute; left: 315px; width: 570px; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .kick { font-family: var(--r-hand); font-size: 30px; color: #a8452c; margin: 0; }
  h1 { font-family: var(--display); font-weight: 400; font-size: 92px; line-height: 1; margin: 0 0 22px; }
  h1 span { font-family: var(--body); font-size: 24px; font-weight: 600; letter-spacing: .14em; color: #a8452c; vertical-align: .95em; margin-left: 8px; }
  .stage { width: 100%; border-radius: 8px; box-shadow: 0 6px 26px rgba(0,0,0,.18); display: block; }
</style></head><body>
  <img class="side left" src="posters/scene-vad.warm.light.jpg" alt="">
  <img class="side right" src="posters/scene-tollem.warm.light.jpg" alt="">
  <div class="mid"><p class="kick">drawn in code in Goa</p><h1>Susegad<span>UI</span></h1>
  <img class="stage" src="posters/scene-kantar.warm.light.jpg" alt=""></div>
</body></html>`);
    tmpPages.push(join(SITE, file));
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
    await page.goto(`${base}/${file}`);
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode())]));
    const png = join(tmpdir(), 'sg-og.png');
    await page.screenshot({ path: png });
    await page.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '3', join(REPO_ROOT, 'apps', 'docs', 'og.jpg')]);
  }

  // ── the hero: the home page as the curtain rises ───────────────────
  for (const theme of THEMES) {
    const vdir = join(tmpdir(), `sg-hero-${theme}`);
    rmSync(vdir, { recursive: true, force: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 }, colorScheme: theme, recordVideo: { dir: vdir, size: { width: 1280, height: 640 } } });
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    await page.waitForTimeout(9000);
    await ctx.close();
    const video = join(vdir, readdirSync(vdir).find(f => f.endsWith('.webm')));
    // skip the blank first moment of loading, crop the header bar away so the
    // masthead fills the frame, then a palette GIF at 15 fps
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', video, '-vf',
      'crop=1280:500:0:118,fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
      '-loop', '0', join(OUT, `hero.${theme}.gif`)]);
  }
} finally {
  for (const f of tmpPages) rmSync(f, { force: true });
  await browser.close();
  server.close?.();
}

for (const f of readdirSync(OUT)) console.log(`${f}  ${(statSync(join(OUT, f)).size / 1024).toFixed(0)} KB`);
process.exit(0);
