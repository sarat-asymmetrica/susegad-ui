// Folio build: a page in, one sealed .html out.
//
//   import { build } from './build/index.mjs';
//   const report = await build('doc.html', { out: 'doc.folio.html', budget: '1.5MB', pdf: true });
//
// Everything the page loads is inlined: one bundled module script, the styles,
// the fonts (subset to the characters used, per script) and the images (WebP or
// AVIF data URIs). Then the file is sealed: a strict Content-Security-Policy and
// an integrity hash in its footer.

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative, extname, basename, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '../../../tools/serve.mjs';
import {
  formatBytes, parseSize, parseFontFaces, assignChars, cssUrls, cssImports, splice, isRemote,
  budgetReport, escapeHtml, safeScript, safeStyle,
} from './assets.mjs';
import { subsetFace } from './fonts.mjs';
import { bundleModules } from './bundle.mjs';
import { usage, cspProbe, blockedLoad, printPdf, encodeImage, closeBrowser } from './browser.mjs';
import { ZERO, cspFor, inlineHashes, withCsp, seal } from './seal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const FONT = /\.(woff2?|ttf|otf)$/i;
const RASTER = /\.(png|jpe?g|gif)$/i;

const dataUri = (buf, mime) => (mime === 'image/svg+xml'
  ? `data:image/svg+xml,${encodeURIComponent(buf.toString('utf8')).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}`
  : `data:${mime};base64,${buf.toString('base64')}`);

/**
 * @param {string} input  an .html page (or .md, when packages/folio/md is present)
 * @param {{ out?: string, budget?: string|number, page?: 'A4'|'Letter'|'auto', pdf?: boolean|string,
 *   root?: string, date?: Date, check?: boolean, log?: (s: string) => void }} [o]
 */
export async function build(input, o = {}) {
  const log = o.log ?? (s => console.log(s));
  const root = resolve(o.root ?? REPO_ROOT);
  const src = resolve(input);
  const out = resolve(o.out ?? src.replace(/\.(html?|md)$/i, '') + '.folio.html');
  const budget = typeof o.budget === 'number' ? o.budget : parseSize(o.budget ?? '3MB');
  const page = ['Letter', 'auto'].includes(o.page) ? o.page : 'A4'; // auto: the reader's own paper, A4 or Letter
  const parts = [], warnings = [];
  const add = (kind, name, bytes) => parts.push({ kind, name, bytes });
  const rel = p => relative(root, p).split(sep).join('/');

  let html = await readFile(src, 'utf8');
  if (!src.startsWith(root + sep)) throw new Error(`The document must sit inside ${root}, so its imports can be found.`);
  // A Markdown source becomes a page first. It is written beside the source (so its
  // relative image paths still resolve) for the browser to read, and removed afterwards.
  let srcPage = src;
  if (/\.md$/i.test(src)) {
    const { toDocument, inline } = await import('../md/index.js');
    const { renderersFor } = await import('./renderers.mjs');
    const { renderers, used } = await renderersFor(root, inline);
    for (const u of used) log(`Writing ${u} at build time.`);
    const doc = toDocument(html, { file: src, exists: p => existsSync(join(root, p)), renderers });
    for (const w of doc.warnings) warnings.push(`Markdown: ${w}`);
    html = doc.html;
    srcPage = join(dirname(src), `.${basename(src, extname(src))}.folio-src.html`);
    await writeFile(srcPage, html);
  }
  try { return await assemble(); } finally { if (srcPage !== src) await rm(srcPage, { force: true }); }

  async function assemble() {
  const base = dirname(src);
  const fileFor = ref => {
    if (isRemote(ref)) throw new Error(`The document loads ${ref} from the internet. A sealed document cannot; copy it into the project and link it locally.`);
    const p = ref.startsWith('/') ? join(root, decodeURIComponent(ref.split(/[?#]/)[0])) : resolve(base, decodeURIComponent(ref.split(/[?#]/)[0]));
    if (!existsSync(p)) throw new Error(`The document refers to ${ref}, which isn't there (looked for ${p}).`);
    return p;
  };

  // 1. What the rendered document uses: characters and font faces.
  log('Reading the document in a browser for the characters and fonts it uses...');
  const server = await startServer({ root, quiet: true });
  let used;
  try { used = await usage(`${server.url}/${rel(srcPage)}`); } finally { await server.close(); }
  for (const e of used.errors) warnings.push(`The source page logged an error: ${e}`);

  // 2. Scripts: every module script becomes one bundle; classic scripts are inlined.
  const modules = [];
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>\s*/gi, (all, attrs, code) => {
    const srcRef = /\bsrc=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (srcRef?.startsWith('/tools/')) { warnings.push(`Left out ${srcRef}: it is a dev-only helper.`); return ''; }
    if (/type=["']module["']/i.test(attrs)) { modules.push(srcRef ? { file: fileFor(srcRef) } : { code, dir: base }); return ''; }
    if (srcRef) { const f = fileFor(srcRef); return `<script>${safeScript(`/* ${rel(f)} */\n${readFileSync(f, 'utf8')}\n`)}</script>\n`; }
    return all;
  });
  let bundle = '';
  if (modules.length) {
    const b = await bundleModules(modules, root);
    bundle = b.code;
    for (const w of b.warnings) warnings.push(`Bundling: ${w}`);
    add('script', 'bundled modules', Buffer.byteLength(bundle));
  }

  // 3. Styles: links become <style>, with @import inlined and url()s marked for step 4.
  const cssFiles = [];
  async function loadCss(file, seen = new Set()) {
    if (seen.has(file)) return '';
    seen.add(file);
    let css = await readFile(file, 'utf8');
    const dir = dirname(file);
    const imports = cssImports(css);
    const pieces = await Promise.all(imports.map(i => loadCss(resolve(dir, i.url), seen)));
    css = splice(css, imports.map((i, k) => ({ ...i, text: pieces[k] })));
    css = splice(css, cssUrls(css).map(u => ({ ...u, text: `url("folio-file:${resolve(dir, u.url.split(/[?#]/)[0])}")` })));
    cssFiles.push(file);
    return css;
  }
  const linkRe = /<link\b([^>]*)>\s*/gi;
  const links = [...html.matchAll(linkRe)];
  const cssFor = new Map();
  for (const m of links) {
    const href = /\bhref=["']([^"']+)["']/i.exec(m[1])?.[1];
    if (/\brel=["']stylesheet["']/i.test(m[1]) && href) cssFor.set(m[0], await loadCss(fileFor(href)));
  }
  let css = [...cssFor.values()].join('\n');

  // 4. Fonts: each face keeps only the characters it actually draws; a face that draws nothing is left out.
  const faces = parseFontFaces(css);
  const drawn = assignChars(faces, used.runs);
  const fontEdits = [];
  for (const f of faces) {
    if (!f.src.startsWith('folio-file:')) continue; // local() fallbacks: no file, no network, keep as they are
    const file = f.src.replace(/^folio-file:/, '');
    const s = await subsetFace(await readFile(file), f.ranges, [...(drawn.get(f) ?? [])].join(''));
    if (!s.buf) { fontEdits.push({ start: f.start, end: f.end, text: '' }); continue; }
    add('font', `${basename(file)} (${[...s.chars].length} chars)`, s.buf.length);
    fontEdits.push({ start: f.start, end: f.end, text: f.block.replace(/url\(\s*(['"]?)folio-file:[^'")]+\1\s*\)/, `url(${dataUri(s.buf, 'font/woff2')})`).replace(/\s*format\([^)]*\)/, " format('woff2')") });
  }
  css = splice(css, fontEdits);
  // any other url() in the styles: an image, as a data URI
  const cssEdits = [];
  for (const u of cssUrls(css)) {
    if (!u.url.startsWith('folio-file:')) continue;
    const file = u.url.slice('folio-file:'.length);
    cssEdits.push({ ...u, text: `url("${await inlineImage(file, `css ${basename(file)}`)}")` });
  }
  css = splice(css, cssEdits);
  // one <style> where the first stylesheet link was
  let placed = false;
  html = html.replace(linkRe, (all, attrs) => {
    if (cssFor.has(all)) { if (placed) return ''; placed = true; return `<style>${safeStyle(css)}</style>\n`; }
    if (/\bhref=["']data:/i.test(attrs)) return all;
    warnings.push(`Left out a <link>${/rel=["']([^"']+)/.exec(attrs)?.[1] ? ` (${/rel=["']([^"']+)/.exec(attrs)[1]})` : ''}: a sealed document loads nothing.`);
    return '';
  });
  add('style', `styles (${cssFiles.length} files, without their fonts and images)`, Buffer.byteLength(css.replace(/url\("?data:[^)]*\)/g, '')));

  // 5. Images in the markup.
  const imgs = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  for (const m of imgs) {
    if (m[1].startsWith('data:')) continue;
    const uri = await inlineImage(fileFor(m[1]), `img ${basename(m[1])}`);
    const tag = m[0].replace(m[1], () => uri).replace(/\s+srcset=["'][^"']*["']/i, '');
    html = html.replace(m[0], () => tag);
  }

  async function inlineImage(file, name) {
    const ext = extname(file).toLowerCase(), buf = await readFile(file);
    if (FONT.test(file)) { warnings.push(`A font outside @font-face was left as it is: ${rel(file)}`); return dataUri(buf, MIME[ext]); }
    if (RASTER.test(file)) {
      const e = await encodeImage(buf, MIME[ext]);
      add('image', `${name}: ${formatBytes(buf.length)} to ${e.how}`, e.buf.length);
      return dataUri(e.buf, e.mime);
    }
    add('image', name, buf.length);
    return dataUri(buf, MIME[ext] ?? 'application/octet-stream');
  }

  // 6. Print, the seal footer, and the bundle.
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || basename(src);
  const [printCss, printJs, checkJs] = await Promise.all(['folio-print.css', 'folio-print.js', 'folio-check.js'].map(f => readFile(join(HERE, '..', f), 'utf8')));
  const date = (o.date ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const pageCss = `@page { ${page === 'auto' ? '' : `size: ${page}; `}margin: 18mm 16mm 20mm;
  @top-center { content: ${JSON.stringify(title)}; font: 8pt ${'system-ui'}, sans-serif; color: #555; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt system-ui, sans-serif; color: #555; } }
.folio-seal { max-inline-size: var(--folio-measure, 42rem); box-sizing: border-box; margin: 3rem auto 2rem; padding: 1rem 1.25rem 0; border-top: 1px solid currentColor; opacity: 0.8; font-size: 0.8rem; line-height: 1.5; }
.folio-seal p { margin: 0 0 0.35rem; }
.folio-seal code { overflow-wrap: anywhere; font-size: 0.95em; }
.folio-seal__check label { margin-inline-end: 0.5rem; }
.folio-seal__print { display: none; }`;
  const footer = `
<footer class="folio-seal" data-folio-seal>
  <p>Built on ${escapeHtml(date)} and sealed. SHA-256 of this file: <code>${ZERO}</code></p>
  <p class="folio-seal__check"><label for="folio-check-file">Check that this copy has not been changed: choose this file</label><input type="file" id="folio-check-file" accept=".html,text/html"> <span id="folio-check-result" role="status"></span></p>
  <p class="folio-seal__print">To check this document, run folio verify on its file.</p>
</footer>
<script>${safeScript(checkJs)}</script>
<script>${safeScript(printJs)}</script>
${bundle ? `<script type="module">${safeScript(bundle)}</script>\n` : ''}`;
  // Replacer functions, never replacement strings: minified code is full of "$&" and "$'",
  // which a replacement string would expand into the matched text.
  html = html
    .replace(/<head([^>]*)>/i, (_, a) => `<head${a}>\n<meta name="folio-integrity" content="sha256-${ZERO}">\n<meta name="generator" content="Susegad UI Folio">`)
    .replace(/<\/head>/i, () => `<style>${safeStyle(printCss)}\n${pageCss}</style>\n</head>`)
    .replace(/<\/body>/i, () => `${footer}</body>`);
  add('script', 'seal check and print scripts', Buffer.byteLength(checkJs + printJs));

  // 7. The policy: every inline script and style by hash, plus what the page adds as it runs.
  const tmp = await mkdtemp(join(tmpdir(), 'folio-'));
  const probeFile = join(tmp, 'probe.html');
  let runtime = [];
  const staticHashes = inlineHashes(html);
  let text = withCsp(html, cspFor({ ...staticHashes, styleAttrs: runtime }));
  for (let round = 0; round < 4; round++) {
    await writeFile(probeFile, text);
    const p = await cspProbe(probeFile);
    const fresh = p.hashes.filter(h => !runtime.includes(h) && !staticHashes.styles.includes(h) && !staticHashes.scripts.includes(h));
    if (!fresh.length) break;
    runtime = [...runtime, ...fresh];
    text = withCsp(html, cspFor({ ...staticHashes, styleAttrs: runtime }));
  }

  // 8. Seal and write.
  const sealed = seal(text);
  await writeFile(out, sealed.text);
  const total = Buffer.byteLength(sealed.text);
  add('html', 'markup and text', Math.max(0, total - parts.reduce((s, p) => s + (p.kind === 'font' || p.kind === 'image' ? Math.ceil(p.bytes * 4 / 3) : p.bytes), 0)));
  const report = budgetReport(parts, total, budget);

  // 9. Prove it: open it with the network blocked.
  let load = null;
  if (o.check !== false) load = await blockedLoad(out);
  let pdf = null;
  if (o.pdf) { pdf = typeof o.pdf === 'string' ? resolve(o.pdf) : out.replace(/\.html$/i, '.pdf'); await printPdf(out, pdf, { page: page === 'auto' ? 'A4' : page }); }
  await rm(tmp, { recursive: true, force: true });
  await closeBrowser();
  return { out, bytes: total, budget, ok: report.ok, table: report.table, digest: sealed.digest, warnings, load, pdf, runtimeHashes: runtime.length };
  }
}

