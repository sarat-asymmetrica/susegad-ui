// Builds the docs site into out/docs/, ready for any static host at any base path.
//
//   node apps/docs/build.mjs              build, then check the copy loads in a browser
//   node apps/docs/build.mjs --no-verify  build only
//
// No bundler. The library is plain ES modules with relative imports, so the
// build only has to:
//   1. copy the site's own files (not this script, check.mjs or the README);
//   2. follow the import graph from those files into packages/ and copy every
//      module, stylesheet and asset it reaches, keeping the tree, so the
//      packages' own relative imports still resolve;
//   3. rewrite the site's `../../packages/` prefix to point at that copy;
//   4. write manifest.js with the scenes it found, so the built page never
//      probes the dev server.
// Every path stays relative, so out/docs works under / or /any/base/path/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PACKAGES = path.join(ROOT, 'packages');
const TOOLS_HARNESS = path.join(ROOT, 'tools', 'harness');
const OUT = path.join(ROOT, 'out', 'docs');
const SKIP = new Set(['build.mjs', 'check.mjs', 'README.md']);
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

// ── what a file refers to ────────────────────────────────────────────
// Relative references in JS (static and literal dynamic imports, export-from,
// new URL(..., import.meta.url)), CSS (@import, url()) and HTML (src, href).
// Demo and recipe pages (registry entries) also carry root-absolute references
// (`/packages/...`, `/tools/harness/...`), since they are built to work at any
// depth once served at a host's root; the harness bootstrap (tools/harness/demo.js)
// also requests one such path as a plain string, not an import, so JS gets its
// own pattern for a quoted root-absolute asset path.
const REF_PATTERNS = {
  js: [
    /\b(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
    /(['"])(\/[\w.-]+(?:\/[\w.-]+)*\.(?:css|js|mjs|json|woff2?|ttf|otf|png|jpe?g|svg|gif|webp))\1/g,
    // a runtime fetch() of the demo/recipe's own data (storybook-spread's story/spread.json)
    /\bfetch\(\s*['"]([^'"]+)['"]/g,
  ],
  css: [/@import\s+(?:url\()?\s*['"]?([^'")\s]+)['"]?\s*\)?/g, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g],
  html: [/\b(?:src|href)\s*=\s*["']([^"']+)["']/g],
};
const kindOf = file => (/\.m?js$/.test(file) ? 'js' : file.endsWith('.css') ? 'css' : /\.html?$/.test(file) ? 'html' : null);
// In JS a bare name is a package specifier; a leading `/` is root-absolute
// (resolved against `base`, not the file); anything else relative is resolved
// against the file's own directory.
const kindOfRef = (spec, kind) => {
  if (/^([a-z][a-z0-9+.-]*:|#)/i.test(spec)) return 'external'; // scheme (http:, data:, mailto:...) or a hash
  if (spec.startsWith('/')) return 'root';
  if (kind === 'js') return /^\.{1,2}\//.test(spec) ? 'relative' : 'external'; // bare specifier = package import
  return spec ? 'relative' : 'external';
};

function stripComments(src) {
  // a /** ... */ doc comment can show an import(...) as an example (core/component.js's
  // skins JSDoc does); it is prose, not code, so it refers to nothing on disk either
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

function refsOf(file, base = ROOT) {
  const kind = kindOf(file);
  if (!kind) return [];
  let src = fs.readFileSync(file, 'utf8');
  // an inline data: URI can hold url(...) of its own (an SVG filter); it refers to nothing on disk
  if (kind === 'css') src = src.replace(/url\(\s*"data:[^"]*"\s*\)|url\(\s*'data:[^']*'\s*\)/g, '');
  if (kind === 'js') src = stripComments(src);
  // Demo pages bootstrap their component with an inline `<script type="module">
  // import './x.js';</script>`, not a `<script src>`, so the module's body is
  // JS to scan too, not HTML: a classic (non-module) inline script has no
  // import syntax to speak of and is skipped.
  const blocks = kind === 'html'
    ? [{ text: src, kind: 'html' }, ...[...src.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => ({ text: stripComments(m[1]), kind: 'js' }))]
    : [{ text: src, kind }];
  const out = new Set();
  for (const b of blocks) for (const re of REF_PATTERNS[b.kind]) for (const m of b.text.matchAll(re)) {
    const spec = m[m.length - 1].split(/[?#]/)[0];
    const kr = kindOfRef(spec, b.kind);
    if (kr === 'root') out.add(path.join(base, spec.slice(1)));
    else if (kr === 'relative') out.add(path.resolve(path.dirname(file), spec));
  }
  return [...out];
}

// ── 1. start clean ───────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const siteFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (!(dir === HERE && SKIP.has(e.name))) siteFiles.push(p);
  }
})(HERE);

// ── 2. which scenes and packages exist ───────────────────────────────
const { order } = await import(pathToFileURL(path.join(HERE, 'manifest.js')).href);
const scenes = order.filter(n => fs.existsSync(path.join(PACKAGES, 'scenes', n, 'index.js')));
const hasCore = fs.existsSync(path.join(PACKAGES, 'core', 'index.js'));
const missing = order.filter(n => !scenes.includes(n));

// Entries into packages/: whatever the site references, plus core and each
// scene, which the page imports by a computed name a scan cannot see, plus
// every registry item's own demo page (a component's demo.html, a recipe's
// index.html, a scene's demo.html), which the components gallery links to at
// its repo-relative, root-absolute URL. A demo page can in turn reach
// tools/harness/ (the shared demo bootstrap), so that folder is in scope too.
const ROOTS = [PACKAGES, TOOLS_HARNESS];
const queue = [];
const seen = new Set();
const notes = [];
const enqueue = (p, from) => {
  if (!ROOTS.some(r => p === r || p.startsWith(r + path.sep)) || seen.has(p)) return;
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    notes.push(`${rel(from)} refers to ${rel(p)}, which does not exist`);
    return;
  }
  seen.add(p);
  queue.push(p);
};
for (const f of siteFiles) for (const r of refsOf(f)) enqueue(r, f);
if (hasCore) enqueue(path.join(PACKAGES, 'core', 'index.js'), HERE);
for (const n of scenes) enqueue(path.join(PACKAGES, 'scenes', n, 'index.js'), HERE);

const registryPath = path.join(ROOT, 'registry', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const demoEntries = [];
for (const item of registry.items) {
  const dir = path.dirname(path.join(ROOT, item.manifest));
  for (const name of ['demo.html', 'index.html']) {
    const f = path.join(dir, name);
    if (fs.existsSync(f)) demoEntries.push(f);
  }
}
for (const f of demoEntries) enqueue(f, registryPath);

while (queue.length) {
  const f = queue.shift();
  for (const r of refsOf(f)) enqueue(r, f);
}

// Fonts travel with their licences (the OFL asks for it): for every font file
// copied, bring the OFL.txt, LICENSE or README.md that sits beside it or in its folder's parent.
for (const p of [...seen]) {
  if (!/\.(woff2?|ttf|otf)$/.test(p)) continue;
  for (const dir of [path.dirname(p), path.dirname(path.dirname(p))]) {
    for (const name of ['OFL.txt', 'LICENSE', 'LICENSE.txt', 'README.md']) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) seen.add(f);
    }
  }
}

// ── 3. copy ──────────────────────────────────────────────────────────
let bytes = 0;
const write = (from, to, text) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (text != null) fs.writeFileSync(to, text);
  else fs.copyFileSync(from, to);
  bytes += fs.statSync(to).size;
};
// One rule for packages/ and tools/harness/: keep the file at its own
// repo-relative path, so /packages/... and /tools/harness/... resolve
// correctly once out/docs is served at a host's root.
for (const p of seen) write(p, path.join(OUT, path.relative(ROOT, p)));
write(registryPath, path.join(OUT, path.relative(ROOT, registryPath)));

for (const f of siteFiles) {
  const relToSite = path.relative(HERE, f);
  const to = path.join(OUT, relToSite);
  if (!kindOf(f)) { write(f, to); continue; }
  // apps/docs/<sub>/x reached packages at ../../(../)packages; out/docs/<sub>/x reaches them at ./ or ../
  const depth = relToSite.split(path.sep).length - 1;
  const fromPrefix = '../'.repeat(depth + 2) + 'packages/';
  const toPrefix = (depth ? '../'.repeat(depth) : './') + 'packages/';
  let text = fs.readFileSync(f, 'utf8').split(fromPrefix).join(toPrefix);
  if (relToSite === 'manifest.js') {
    const built = [...(hasCore ? ['core'] : []), ...scenes];
    text = text.replace('export const built = null;', `export const built = ${JSON.stringify(built)};`);
    if (!text.includes('export const built = [')) throw new Error('manifest.js: could not write the built list');
  }
  if (relToSite === '404.html') {
    // Workers' not_found_handling: "404-page" serves this file's body AT the
    // missing URL itself (e.g. /a/b/c), so its own relative links and
    // stylesheets would resolve against /a/b/ instead of the site root. A
    // <base> fixes every relative reference on the page in one line, without
    // touching the source file (which stays relative, so it still works when
    // served for real from apps/docs/404.html or out/docs/404.html directly,
    // one folder down from the root, in dev). Root-absolute hrefs would need
    // rewriting one by one and would still leave any relative link a future
    // edit adds broken; <base> covers those too.
    text = text.replace('<head>', '<head>\n  <base href="/">');
    if (!text.includes('<base href="/">')) throw new Error('404.html: could not inject <base>');
  }
  write(f, to, text);
}

// ── 4. every relative reference in the copy must resolve inside it ───
const broken = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    // A root-absolute reference in the built copy means "resolve from the
    // site's own root once deployed", i.e. from out/docs, not from the repo.
    for (const r of refsOf(p, OUT)) {
      const target = fs.existsSync(r) && fs.statSync(r).isDirectory() ? path.join(r, 'index.html') : r;
      if (r !== OUT && !r.startsWith(OUT + path.sep)) broken.push(`${path.relative(OUT, p)} -> ${r} (outside out/docs)`);
      else if (!fs.existsSync(target)) broken.push(`${path.relative(OUT, p)} -> ${path.relative(OUT, r)}`);
    }
  }
})(OUT);

console.log(`built ${rel(OUT)}: ${siteFiles.length} site files, ${seen.size} package files, ${(bytes / 1024).toFixed(1)} KB`);
console.log(`scenes: ${scenes.join(', ') || 'none'}${missing.length ? ` (not found, skipped: ${missing.join(', ')})` : ''}; core: ${hasCore ? 'yes' : 'no'}`);
console.log(`registry: ${registry.items.length} items, ${demoEntries.length} demo/entry pages shipped`);
notes.forEach(n => console.log(`  note: ${n}`));
if (broken.length) {
  broken.forEach(b => console.error(`  broken: ${b}`));
  console.error(`${broken.length} broken reference(s) in the built copy`);
  process.exit(1);
}

// ── 5. load the built copy under a base path and make sure it works ──
if (!process.argv.includes('--no-verify')) {
  const { chromium } = await import('playwright');
  const { startServer } = await import('../../tools/serve.mjs');
  // serve out/ so the site lives at /docs/, not at the root: the base path must not matter
  const server = await startServer({ root: path.join(ROOT, 'out'), quiet: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(server.url)) errors.push(`third-party request ${r.url()}`); });
  const url = `${server.url}/docs/`;
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready);
    const got = await page.evaluate(() => ({
      plates: [...document.querySelectorAll('.plate')].map(p => p.id),
      drawn: [...document.querySelectorAll('sg-scene')].filter(s => s.shadowRoot?.querySelector('.stage canvas, .stage svg')).length,
      tools: document.querySelectorAll('.tool').length,
      castoro: document.fonts.check('400 64px Castoro', 'Susegad'),
    }));
    console.log(`verify ${url}: plates=${got.plates.join(',') || 'none'} drawn=${got.drawn} pencil-box=${got.tools} castoro=${got.castoro} errors=${errors.length}`);
    errors.forEach(e => console.error(`  ${e}`));
    if (errors.length || got.plates.length !== scenes.length || !got.tools || !got.castoro) throw new Error('the built copy did not load cleanly');
    console.log('the built copy loads');
  } catch (err) {
    console.error(String(err.message || err));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }

  // ── 6. the deploy shape: out/docs served AT the root, every demo page, the 404 ──
  // wrangler.jsonc puts out/docs at the domain root with not_found_handling:
  // "404-page", which the /docs/ check above never exercises (it lives one
  // folder down and never hits a missing page). This is the shape the
  // components gallery's demo links, and the 404, actually run in.
  {
    const deployServer = await startServer({ root: OUT, quiet: true, notFoundHtml: '404.html' });
    const browser2 = await chromium.launch();
    const demoErrors = [];

    async function loadAndCheck(urlPath, { expectStatus = 200 } = {}) {
      const page = await browser2.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(String(e)));
      page.on('requestfailed', r => errors.push(`request failed ${r.url()}`));
      page.on('response', r => { if (r.status() >= 400 && r.url() !== `${deployServer.url}${urlPath}`) errors.push(`${r.status()} ${r.url()}`); });
      page.on('request', r => { if (!/^(data|blob):/.test(r.url()) && !r.url().startsWith(deployServer.url)) errors.push(`third-party request ${r.url()}`); });
      let status = null;
      try {
        const resp = await page.goto(`${deployServer.url}${urlPath}`, { waitUntil: 'load', timeout: 20000 });
        status = resp?.status() ?? null;
        await page.waitForTimeout(400);
      } catch (err) {
        errors.push(`navigation failed: ${err.message || err}`);
      }
      if (status !== expectStatus) errors.push(`status ${status}, expected ${expectStatus}`);
      await page.close();
      return errors;
    }

    try {
      // every shipped demo/entry page, at the root-absolute URL the gallery links to
      for (const f of demoEntries) {
        const urlPath = '/' + path.relative(ROOT, f).split(path.sep).join('/');
        const errs = await loadAndCheck(urlPath);
        if (errs.length) { demoErrors.push([urlPath, errs]); console.error(`  FAIL ${urlPath}`); errs.forEach(e => console.error(`    ${e}`)); }
        else console.log(`  ok ${urlPath}`);
      }

      // the deep 404: a missing page several folders down, the way Workers serves it
      const page = await browser2.newPage();
      const cssReqs = [];
      page.on('response', r => { if (r.url().endsWith('.css')) cssReqs.push(r.status()); });
      const resp = await page.goto(`${deployServer.url}/a/b/does-not-exist`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const styled = await page.evaluate(() => {
        const art = document.querySelector('.rafe-art');
        const cs = art && getComputedStyle(art);
        return { hasMask: !!(cs && (cs.maskImage !== 'none' || cs.webkitMaskImage !== 'none')), heading: document.querySelector('h1')?.textContent };
      });
      await page.close();
      const status404ok = resp?.status() === 404;
      const cssOk = cssReqs.length > 0 && cssReqs.every(s => s === 200);
      console.log(`  deep 404 /a/b/does-not-exist: status=${resp?.status()} css=${cssReqs.join(',')} styled=${styled.hasMask} heading="${styled.heading}"`);
      if (!status404ok || !cssOk || !styled.hasMask) demoErrors.push(['/a/b/does-not-exist (404 page)', [`status404=${status404ok} css=${cssReqs.join(',')} styled=${styled.hasMask}`]]);

      console.log(`root-shape verify: ${demoEntries.length} demo page(s), 1 deep-404 check, ${demoErrors.length} failure(s)`);
      if (demoErrors.length) throw new Error(`${demoErrors.length} demo/404 page(s) failed at the deploy root`);
    } catch (err) {
      console.error(String(err.message || err));
      process.exitCode = 1;
    } finally {
      await browser2.close();
      await deployServer.close();
    }
  }
}
