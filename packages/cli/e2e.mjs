#!/usr/bin/env node
// End-to-end proof for the CLI: copy an item into a fresh project outside the repo,
// serve that project on its own, and check the scene draws in a real browser.
//
//   node packages/cli/e2e.mjs scene-kolam
//   node packages/cli/e2e.mjs scene-paus --scratch <folder> --shots .shots/cli
//   node packages/cli/e2e.mjs scene-dot --registry registry/fixtures/good
//
// Passes when: the add succeeds, the page logs no console errors and no failed
// requests, sg-ready fires, and a canvas (or SVG) inside the scene drew something.
// Writes <shots>/<item>.png. Uses Playwright from the repo's dev dependencies.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const bin = fileURLToPath(new URL('./bin/susegad.mjs', import.meta.url));
const MARKER = '.susegad-e2e';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function parse(argv) {
  const opts = { item: null, registry: undefined, scratch: join(tmpdir(), 'susegad-cli-e2e'), shots: join(repo, '.shots', 'cli'), timeout: 15000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--registry') opts.registry = resolve(argv[++i]);
    else if (a === '--scratch') opts.scratch = resolve(argv[++i]);
    else if (a === '--shots') opts.shots = resolve(argv[++i]);
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (!a.startsWith('-') && !opts.item) opts.item = a;
    else throw new Error(`I do not know the argument ${a}`);
  }
  if (!opts.item) throw new Error('Name the item to test, for example: node packages/cli/e2e.mjs scene-kolam');
  return opts;
}

/** A fresh project folder. Only ever clears a folder this script made (it carries a marker). */
function freshProject(scratch, item) {
  const dir = join(scratch, item);
  if (existsSync(dir)) {
    if (!existsSync(join(dir, MARKER)) && readdirSync(dir).length) {
      throw new Error(`${dir} already exists and was not made by this script, so I will not clear it. Pick another --scratch.`);
    }
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MARKER), 'Made by packages/cli/e2e.mjs; safe to delete.\n');
  return dir;
}

/** A recipe page: every copied stylesheet the pieces need, then the recipe's own mount function. */
function recipePageFor(item, lib) {
  const has = p => existsSync(join(lib, p));
  const own = `susegad/recipes/${item}`;
  const componentCss = existsSync(join(lib, 'susegad/components'))
    ? readdirSync(join(lib, 'susegad/components')).map(c => `susegad/components/${c}/${c}.css`).filter(has) : [];
  const recipeCss = readdirSync(join(lib, own)).filter(f => f.endsWith('.css')).map(f => `${own}/${f}`);
  const css = ['susegad/tokens/fonts.css', 'susegad/tokens/tokens.css', ...componentCss, ...recipeCss].filter(has)
    .map(p => `  <link rel="stylesheet" href="./src/lib/${p}">\n`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>susegad add ${item}</title>
${css}  <style>
    body { margin: 0; padding: 24px; background: var(--sg-paper, #f6efe2); color: var(--sg-ink, #2b2118); font: 16px/1.5 system-ui, sans-serif; }
    main { max-width: 720px; margin: 0 auto; }
  </style>
</head>
<body>
  <main>
    <p>Copied with <code>susegad add ${item}</code> and served from a project outside the repo.</p>
    <div id="host"></div>
  </main>
  <sg-toast-region></sg-toast-region>
  <script type="module">
    const recipe = await import('./src/lib/${own}/recipe.js');
    const [name, mount] = Object.entries(recipe).find(([k, v]) => /^mount/.test(k) && typeof v === 'function') ?? [];
    if (!mount) throw new Error('recipe.js exports no mount function');
    window.__mounted = name;
    window.__recipe = mount(document.getElementById('host'));
    window.__ready = true;
  </script>
</body>
</html>
`;
}

/** The first ```html block in a recipe's README, if any. */
function readmeSnippet(recipeDir) {
  const readme = join(recipeDir, 'README.md');
  if (!existsSync(readme)) return null;
  return readFileSync(readme, 'utf8').match(/```html\r?\n([\s\S]*?)```/)?.[1] ?? null;
}

/** The README snippet, verbatim, in a page beside the susegad/ folder; "your fields" gets one real field. */
function snippetPage(item, lib, snippet) {
  const has = p => existsSync(join(lib, p));
  const css = ['susegad/tokens/fonts.css', 'susegad/tokens/tokens.css'].filter(has)
    .map(p => `  <link rel="stylesheet" href="./${p}">\n`).join('');
  const body = snippet.replace(/<!--\s*your fields\s*-->/i,
    '<label>Notes for the house <textarea name="notes">Two adults and a small child.</textarea></label>');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>susegad add ${item}: README snippet</title>
${css}  <style>
    body { margin: 0; padding: 24px; background: var(--sg-paper, #f6efe2); color: var(--sg-ink, #2b2118); font: 16px/1.5 system-ui, sans-serif; }
    body > *:not(sg-toast-region) { max-width: 720px; margin-inline: auto; }
    label, textarea { display: block; width: 100%; }
  </style>
</head>
<body>
<p>The html snippet from <code>${item}/README.md</code>, pasted as written.</p>
${body}
</body>
</html>
`;
}

function pageFor(item, lib) {
  if (existsSync(join(lib, 'susegad/recipes', item))) return recipePageFor(item, lib);
  const name = item.replace(/^scene-/, '');
  const has = p => existsSync(join(lib, p));
  const css = ['susegad/tokens/fonts.css', 'susegad/tokens/tokens.css'].filter(has)
    .map(p => `  <link rel="stylesheet" href="./src/lib/${p}">\n`).join('');
  const imports = ['susegad/core/index.js', `susegad/scenes/${name}/index.js`].filter(has).map(p => `  import './src/lib/${p}';`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>susegad add ${item}</title>
${css}  <style>
    body { margin: 0; padding: 24px; background: var(--sg-paper, #f6efe2); color: var(--sg-ink, #2b2118); font: 16px/1.5 system-ui, sans-serif; }
    main { max-width: 960px; margin: 0 auto; }
    sg-scene { display: block; }
  </style>
</head>
<body>
  <main>
    <p>Copied with <code>susegad add ${item}</code> and served from a project outside the repo.</p>
    <sg-scene name="${name}" seed="7"></sg-scene>
  </main>
  <script type="module">
${imports.join('\n')}
    const scene = document.querySelector('sg-scene');
    scene.addEventListener('sg-ready', () => { window.__ready = true; }, { once: true });
  </script>
</body>
</html>
`;
}

function serve(root) {
  const server = createServer((req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    const file = path.endsWith(sep) ? join(path, 'index.html') : path;
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** In the page: find every canvas and svg, piercing open shadow roots, and measure what they drew. */
function probe() {
  const found = [];
  const walk = node => {
    for (const el of node.querySelectorAll('*')) {
      if (el.tagName === 'CANVAS' || el.tagName === 'svg') found.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return found.map(el => {
    if (el.tagName === 'svg') return { kind: 'svg', drawn: el.querySelectorAll('path, circle, line, polyline, polygon, rect, ellipse, use, text').length };
    const w = Math.min(el.width, 400), h = Math.min(el.height, 400);
    if (!w || !h) return { kind: 'canvas', width: el.width, height: el.height, painted: 0, colours: 0 };
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let painted = 0;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 8) painted++;
      if (i % 64 === 0) colours.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    }
    return { kind: 'canvas', width: el.width, height: el.height, painted: painted / (w * h), colours: colours.size };
  });
}

/**
 * Use a mounted recipe the way a person would.
 * A file field: choose two files, and wait for that uploader's stamp to say they arrived.
 * A form with text fields: type, and wait for the form to say it saved.
 * @returns {Promise<null | { did: string, done: boolean, detail: string }>}
 */
async function exercise(page, timeout) {
  const fileInput = await page.$('input[type=file]');
  if (fileInput) {
    await fileInput.setInputFiles([
      { name: 'room-view.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(180_000, 7) },
      { name: 'room-rates-2026.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(420_000, 1) },
    ]);
    // The uploader that owns this field; a demo page may hold frozen copies with stamps already down.
    const scope = await fileInput.evaluateHandle(i => i.closest('.upload') ?? i.form ?? document.body);
    // Wait for the stamp. A dropped file offers "Try again", so press it, as a person would.
    let done = false, retries = 0;
    const deadline = Date.now() + timeout * 3;
    while (!done && Date.now() < deadline) {
      const state = await page.waitForFunction(s => {
        const st = s.querySelector('sg-stamp');
        if (st && !st.hidden && st.getBoundingClientRect().height > 0) return 'stamped';
        const retry = [...s.querySelectorAll('button')].find(b => /try .*again/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') ?? '')) && b.offsetParent);
        return retry ? 'retry' : false;
      }, scope, { timeout: Math.max(1000, deadline - Date.now()) }).then(h => h.jsonValue(), () => 'timeout');
      if (state === 'stamped') done = true;
      else if (state === 'retry' && retries < 3) {
        retries++;
        await scope.evaluate(s => [...s.querySelectorAll('button')].find(b => /try .*again/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') ?? '')) && b.offsetParent).click());
      } else break;
    }
    await page.waitForTimeout(900);
    const detail = await scope.evaluate(s => {
      const bars = [...s.querySelectorAll('progress')].map(p => `${p.value}/${p.max}`).join(', ');
      const stamp = s.querySelector('sg-stamp')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
      return `bars ${bars}; stamp "${stamp}"`;
    });
    return { did: `uploaded 2 files${retries ? `, pressing Try again ${retries === 1 ? 'once' : `${retries} times`}` : ''}`, done, detail };
  }
  const field = (await page.$('form textarea')) ?? (await page.$('form input[type=text], form input:not([type])'));
  if (field) {
    const form = await field.evaluateHandle(f => f.form);
    const before = await form.evaluate(f => f.textContent.replace(/\s+/g, ' '));
    await field.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Late check-in is fine.', { delay: 20 });
    const done = await page.waitForFunction(f => /\bSaved\b/.test(f.textContent), form, { timeout: timeout * 2 }).then(() => true, () => false);
    await page.waitForTimeout(400);
    const after = await form.evaluate(f => (f.querySelector('.saving-footer, footer, [role=status]') ?? f).textContent.replace(/\s+/g, ' ').trim());
    return { did: 'typed into the form', done, detail: `footer "${after}"${/\bSaved\b/.test(before) ? ' (it already said Saved before typing)' : ''}` };
  }
  return null;
}

export async function e2e(opts) {
  const log = [];
  const say = s => { log.push(s); console.log(s); };
  const project = freshProject(opts.scratch, opts.item);
  const lib = join(project, 'src', 'lib');

  const args = [bin, 'add', opts.item, '--dir', 'src/lib', ...(opts.registry ? ['--registry', opts.registry] : [])];
  say(`$ susegad add ${opts.item} --dir src/lib${opts.registry ? ` --registry ${opts.registry}` : ''}   (in ${project})`);
  const add = spawnSync(process.execPath, args, { cwd: project, encoding: 'utf8' });
  say((add.stdout + add.stderr).trimEnd());
  if (add.status !== 0) return { ok: false, reason: `susegad add exited with ${add.status}`, log };

  // A recipe that ships its own demo page is tested through that copied page, exactly as the builder
  // receives it. Anything else gets a small page written here.
  // Failing that, the recipe README's first html block is pasted into a page in the target folder,
  // which is where its paths start: the proof that the documented snippet works as written.
  const recipeDir = join(lib, 'susegad', 'recipes', opts.item);
  const demo = existsSync(join(recipeDir, 'index.html'));
  const snippet = !demo && existsSync(recipeDir) ? readmeSnippet(recipeDir) : null;
  let path = '/index.html';
  if (demo) path = `/src/lib/susegad/recipes/${opts.item}/index.html`;
  else if (snippet) {
    writeFileSync(join(lib, 'snippet.html'), snippetPage(opts.item, lib, snippet));
    path = '/src/lib/snippet.html';
    say(`using the html snippet from recipes/${opts.item}/README.md`);
  } else writeFileSync(join(project, 'index.html'), pageFor(opts.item, lib));
  const server = await serve(project);
  const url = `http://127.0.0.1:${server.address().port}${path}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const problems = [];
    page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`page error: ${e.message}`));
    page.on('requestfailed', r => problems.push(`request failed: ${r.url()}`));
    page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

    await page.goto(url);
    const ready = (demo || snippet)
      ? await page.waitForLoadState('load').then(() => page.waitForTimeout(800)).then(() => true, () => false)
      : await page.waitForFunction(() => window.__ready === true, null, { timeout: opts.timeout }).then(() => true, () => false);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // Faces only download when used, so ask for every declared face: a bad woff2 path in the copy shows up here.
    const fonts = await page.evaluate(async () => {
      const faces = [...document.fonts];
      const results = await Promise.allSettled(faces.map(f => f.load()));
      return faces.map((f, i) => ({ family: f.family.replace(/"/g, ''), ok: results[i].status === 'fulfilled' }));
    });
    for (const f of fonts.filter(f => !f.ok)) problems.push(`font failed to load: ${f.family}`);
    const surfaces = await page.evaluate(probe);
    mkdirSync(opts.shots, { recursive: true });
    const shot = join(opts.shots, `${opts.item}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    // Recipes are exercised by what they offer, and pass only when they say the work is done.
    let flow = null, flowShot = null;
    const mounted = demo ? 'its own demo page' : snippet ? 'the README snippet' : await page.evaluate(() => window.__mounted ?? null);
    if (mounted) {
      flow = await exercise(page, opts.timeout);
      if (flow) {
        flowShot = join(opts.shots, `${opts.item}-done.png`);
        await page.screenshot({ path: flowShot, fullPage: true });
      }
    }
    // The live frame is early in the scene's timeline; the still is the finished drawing.
    let stillShot = null;
    if (await page.evaluate(() => typeof document.querySelector('sg-scene')?.still === 'function')) {
      await page.evaluate(() => document.querySelector('sg-scene').still());
      await page.waitForTimeout(300);
      stillShot = join(opts.shots, `${opts.item}-still.png`);
      await page.screenshot({ path: stillShot, fullPage: true });
    }

    const hostHeight = mounted ? await page.evaluate(() => (document.getElementById('host') ?? document.querySelector('main') ?? document.body).getBoundingClientRect().height) : 0;
    const drew = mounted
      ? hostHeight > 40
      : surfaces.some(s => (s.kind === 'canvas' && s.painted > 0.005 && s.colours > 1) || (s.kind === 'svg' && s.drawn > 0));
    say(`served ${url}`);
    say(mounted ? `mounted through ${demo || snippet ? mounted : mounted + '()'}: ${ready ? 'yes' : 'no'}, ${Math.round(hostHeight)}px tall` : `sg-ready: ${ready ? 'yes' : 'no'}`);
    if (flow) say(`${flow.did}: ${flow.done ? 'done' : 'never finished'}; ${flow.detail}`);
    say(`font faces loaded from the copy: ${fonts.filter(f => f.ok).length} of ${fonts.length} (${[...new Set(fonts.map(f => f.family))].join(', ') || 'none declared'})`);
    say(`surfaces: ${JSON.stringify(surfaces)}`);
    say(`console errors and failed requests: ${problems.length ? '\n  ' + problems.join('\n  ') : 'none'}`);
    say(`screenshot: ${shot}${stillShot ? `\nstill: ${stillShot}` : ''}${flowShot ? `\nafter using it: ${flowShot}` : ''}`);
    const ok = ready && drew && !problems.length && (!flow || flow.done);
    const reason = ok ? 'passed' : [!ready && (mounted ? 'the recipe did not mount' : 'sg-ready never fired'), !drew && 'nothing was drawn',
      problems.length && 'the page logged errors', flow && !flow.done && `it ${flow.did} and never finished`].filter(Boolean).join('; ');
    return { ok, reason, surfaces, problems, shot, project, log };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await e2e(parse(process.argv.slice(2)));
    console.log(result.ok ? `\nThe copied ${process.argv[2]} runs on its own. E2E passed.` : `\nE2E failed: ${result.reason}.`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
