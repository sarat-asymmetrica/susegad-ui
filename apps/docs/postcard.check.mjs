// Browser checks for the /postcard page of the built docs site: the link people open on their phones.
//
//   node apps/docs/build.mjs --no-verify          build first: this runs against out/docs (SG_DOCS_OUT names another folder)
//   node apps/docs/postcard.check.mjs             every clause, in the engine SG_ENGINE names (chromium by default)
//   SG_ENGINE=webkit node apps/docs/postcard.check.mjs
//   node apps/docs/postcard.check.mjs --break=<mode>   a deliberately broken page (modes below)
//   node apps/docs/postcard.check.mjs --shots     also write the screenshots the report describes, to .shots/postcard-page/<engine>/
//
// The browser is opened through harness() (tools/lib/component-check.mjs), so SG_ENGINE is honoured (the older checks that call
// chromium.launch() directly are listed in docs/BROWSERS.md; this is not one of them). The built site is served with the
// Content-Security-Policy the deployed _headers file carries, so the page is checked under the rules it will run in.
//
// What it proves, at 390 px, at 1440 px and on a phone profile (Playwright's iPhone in WebKit, its Pixel in Chromium):
//   privacy      typing a name, choosing scenes, making and saving the PNG and the GIF, and sharing send NO request after the
//                page loaded beyond the site's own static files, none carrying the name, no beacon, no socket, and the name is
//                kept in no storage. A planted fetch, beacon or tracking pixel turns it red (modes below).
//   the page     an EMPTY name field with the placeholder, a label, a hint linked to it; the scene row of the recipe's scenes as
//                thumbnails that really loaded; one scene picked from the name's seed (the same name, the same scene), "Another
//                scene", a click or the arrow keys; the alt text that reads the card with the name first; the counts read live
//                from the registry; the privacy line and the "make your own" line.
//   the kit      the email image (1200 x 800 JPEG, under 150 KB) and snippet (no script, every image has alt, absolute addresses) are
//                served at /postcard/; after Save picture the finished PNG shows on the page to press and hold; ?scene=<id> picks a
//                scene of the page's own set and a bogus id, or anything else in the address, changes nothing.
//   saving       the PNG is a PNG and the GIF is a 30 frame GIF89a under 5 MB, named for the card; Save and Share with no name
//                nudge to the field; a still scene offers no GIF and says why; reduced motion saves the GIF and does not play it.
//   a11y         axe, zero violations, in quiet, warm and playful and in both themes, empty, filled, and with the GIF in progress;
//                by keyboard from the first Tab to Cancel; the GIF's progress is announced in the live region.
//   phones       no sideways scroll at 390 px, every control at least 44 px, the card inside the screen at 3:2; the GIF's make
//                time and size for the ferry and the old post office (unthrottled, and at 4x CPU throttle in Chromium).
//
// Break modes (each serves one built file with one string replaced; the run fails if the text to break has moved):
//   fetch-name    the page posts the typed name to its own server on every keystroke -> "privacy: not one request ..."
//   beacon-png    saving the PNG sends the name with navigator.sendBeacon             -> "privacy: not one request ..."
//   pixel         a tracking pixel from another site                                   -> "privacy: not one request ..."
//   unlabelled    the name field loses its label                                       -> "the name field has its label ..." (axe does not mind: it takes a placeholder for a name)
//   prefilled     the name field comes pre-filled with a name                          -> "the name field is EMPTY ..."
//   sideways      the scene row's cells are 26rem wide                                 -> "no sideways scroll at 390 px"
//   small         the buttons are 30 px tall                                           -> "every control is at least 44 px"
//   email-script  the email snippet carries a <script>                                  -> "the email snippet is a table ..."
//   email-noalt   the email snippet's image has no alt                                  -> "the email snippet is a table ..."
//   email-huge    the email image is 200 KB larger                                      -> "the email image ..."
//   no-hold       the finished picture is made but never shown                          -> "press and hold ..."
//   scene-any     ?scene= takes any id, valid or not                                    -> "?scene= ... a bogus id"
//   autoplay      the GIF plays on the page under reduced motion                       -> "reduced motion: the GIF is saved and not played"
//
// Waits are for states (a ready flag, a status line, a download, a progress bar), never for time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from 'playwright';
import { engineName, contextOptions } from '../../tools/lib/engine.mjs';
import { harness } from '../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';
import { readGif } from '../../packages/recipes/picture-postcard/gif-read.mjs';
import { SCENES, sceneForSeed } from '../../packages/recipes/picture-postcard/scenes.js';
import { seedFor, layout, graphemes } from '../../packages/recipes/picture-postcard/postcard.core.js';
import { GOA_OCT_2026 } from '../../packages/recipes/picture-postcard/events/goa-oct-2026.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = process.env.SG_DOCS_OUT ? path.resolve(process.env.SG_DOCS_OUT) : path.join(ROOT, 'out', 'docs');
// The engine comes from SG_ENGINE only. A bare --engine flag is not read here (only `npm run check -- --engine=...` turns it into
// SG_ENGINE), so it would run Chromium while looking like another engine: refuse it, and say which engine is running.
if (process.argv.some(a => a === '--engine' || a.startsWith('--engine='))) { console.error('this check reads SG_ENGINE, not --engine: run it as  SG_ENGINE=webkit node <this file>  (or through npm run check -- --engine=webkit)'); process.exit(2); }
const BREAK = process.argv.find(a => a.startsWith('--break='))?.slice('--break='.length) ?? '';
const SHOTS = process.argv.includes('--shots');
const engine = engineName();
const shotDir = path.join(ROOT, '.shots', 'postcard-page', engine);
console.log(`engine: ${engine}${process.env.SG_ENGINE ? '' : ' (SG_ENGINE is not set, so the default)'}`);

if (!fs.existsSync(path.join(OUT, 'postcard.html'))) { console.error(`no built /postcard page in ${OUT}: run node apps/docs/build.mjs --no-verify first`); process.exit(2); }

// ── what each fault serves: the built file it changes, and the content type ─────────────────────
// A page's HTML is generated (postcard-page.core.js is its source), so a fault in that file's markup is served as the built page.
const BREAKS = {
  'fetch-name': ['postcard-page.js', 'show(name ? sceneForSeed(seedFor(name)) : DEFAULT_SCENE);', "show(name ? sceneForSeed(seedFor(name)) : DEFAULT_SCENE); fetch('/seen?n=' + encodeURIComponent(name));"],
  'beacon-png': ['packages/recipes/picture-postcard/recipe.js', 'export async function exportPng(canvas, name) {', "export async function exportPng(canvas, name) { navigator.sendBeacon('/b', name);"],
  pixel: ['postcard-page.js', 'const show = name => { sceneEl.value = name;', "const show = name => { new Image().src = 'https://stats.example.com/p.gif?n=' + encodeURIComponent(nameEl.value); sceneEl.value = name;"],
  unlabelled: ['postcard-page.core.js', '<label for="name">', '<label for="nom">'],
  prefilled: ['postcard-page.core.js', 'autocomplete="name"', 'autocomplete="name" value="Maria Fernandes"'],
  sideways: ['postcard.css', '.pc-thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr));', '.pc-thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));'],
  small: ['postcard.css', 'min-height: 48px; padding: 8px 12px;', 'min-height: 30px; padding: 0 12px;'],
  'large-always': ['packages/recipes/picture-postcard/recipe.js', "${out.withinBudget ? '' :", "${false ? '' :"],
  'email-script': ['postcard/email.html', '<table role="presentation"', '<script>1</script><table role="presentation"'],
  'email-noalt': ['postcard/email.html', ' alt="A postcard of Goa', ' title="A postcard of Goa'],
  'email-huge': ['postcard/email.jpg', null, buf => Buffer.concat([buf, Buffer.alloc(200 * 1024)])],
  'no-hold': ['postcard-page.js', 'img.src = holdUrl; img.hidden = false;', 'img.src = holdUrl;'],
  'scene-any': ['postcard-kit.core.js', 'scenes.some(s => s.name === ids[0])', 'ids.length === 1'],
  autoplay: ['packages/recipes/picture-postcard/recipe.js', 'if (!reduced.matches) {', 'if (true) {'],
};
if (BREAK && !BREAKS[BREAK]) { console.error(`unknown --break mode "${BREAK}"`); process.exit(2); }
const SERVED = { 'postcard-page.core.js': { built: 'postcard.html', type: 'text/html; charset=utf-8', urls: ['**/postcard', '**/postcard.html'] } };
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg' };
const faultRoutes = [];
const early = []; // a planted fault that does not apply is a red, printed as soon as the harness's printer exists
if (BREAK) {
  const [file, from, to] = BREAKS[BREAK], via = SERVED[file], built = via ? via.built : file;
  // a fault is a string swapped in a text file, or (when `from` is null) a function of a binary file's bytes
  const raw = fs.readFileSync(path.join(OUT, built)), src = raw.toString('utf8');
  if (from !== null && !src.includes(from)) early.push([`the planted fault applies (${from.slice(0, 48)})`, false, `${built} changed; update the fault`]);
  const body = from === null ? to(raw) : src.split(from).join(to), type = via ? via.type : TYPES[path.extname(file)];
  for (const pattern of via ? via.urls : [`**/${built}*`]) faultRoutes.push([pattern, r => r.fulfill({ contentType: type, body, ...(type.startsWith('text/html') && CSP ? { headers: { 'content-security-policy': CSP } } : {}) })]);
}

// ── the site, served with its own headers ──────────────────────────────────────────────────────
const h = await harness({ serve: { root: OUT }, axe: true });
const { browser, check } = h;
for (const e of early) check(...e);
const site = h.server;
const headersFile = fs.readFileSync(path.join(OUT, '_headers'), 'utf8');
const CSP = /Content-Security-Policy:\s*(.+)/.exec(headersFile)?.[1]?.trim() ?? '';
site.server.prependListener('request', (req, res) => { if (CSP && !/\.(js|css|woff2?|avif|webp|jpe?g|png|gif|json|svg|txt|xml)(\?|$)/.test(req.url)) res.setHeader('Content-Security-Policy', CSP); });
const registry = JSON.parse(fs.readFileSync(path.join(OUT, 'registry', 'registry.json'), 'utf8'));
const WORDS = { try: 'Type your name first, then save your postcard.', still: 'This scene is a still picture, so it saves as a picture only. Choose another scene to make a GIF.', reduced: 'Your device is set to reduce motion, so a GIF will be saved but not played on this page.' };

const SHARE_STUB = `(() => {
  window.__shared = [];
  const def = (k, v) => { try { Object.defineProperty(navigator, k, { value: v, configurable: true }); } catch { navigator[k] = v; } };
  def('canShare', d => !!(d && d.files && d.files.length));
  def('share', async d => { window.__shared.push(...d.files.map(f => ({ name: f.name, type: f.type, size: f.size, text: d.text }))); });
})();`;
// every way the page could send a name that is not a plain request, noted as it is attempted
const SPY = `(() => {
  window.__attempts = [];
  const note = (k, a) => { try { window.__attempts.push(k + ' ' + [...a].map(String).join(' ').slice(0, 120)); } catch {} };
  const f = window.fetch; window.fetch = function (...a) { note('fetch', a.slice(0, 1)); return f.apply(this, a); };
  const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (...a) { note('xhr', a.slice(0, 2)); return o.apply(this, a); };
  if (navigator.sendBeacon) { const s = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (...a) => { note('beacon', a.slice(0, 1)); return s(...a); }; }
  for (const k of ['WebSocket', 'EventSource']) { const C = window[k]; if (C) window[k] = function (...a) { note(k, a.slice(0, 1)); return new C(...a); }; }
})();`;

/**
 * The page in its own context, with the planted fault served, the requests recorded once it is ready, and errors collected.
 * @param {{ width?: number, height?: number, device?: string, reduced?: boolean, share?: boolean, register?: string, theme?: string, js?: boolean, path?: string, spy?: boolean }} o
 */
async function openPage({ width = 1440, height = 900, device = '', reduced = false, share = false, register = '', theme = '', js = true, path: urlPath = '/postcard', spy = false } = {}) {
  const profile = device ? { ...devices[device] } : { viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 };
  delete profile.defaultBrowserType;
  const ctx = await browser.newContext(contextOptions(engine, { ...profile, reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true, javaScriptEnabled: js }));
  for (const [pattern, handler] of faultRoutes) await ctx.route(pattern, handler);
  if (share) await ctx.addInitScript(SHARE_STUB);
  if (spy) await ctx.addInitScript(SPY);
  if (register || theme) await ctx.addInitScript(([r, t]) => { try { localStorage.setItem('sg-docs-prefs', JSON.stringify({ ...(r ? { register: r } : {}), ...(t ? { theme: t } : {}) })); } catch {} }, [register, theme]);
  const page = await ctx.newPage(), errors = [], requests = [], downloads = [];
  let watching = false;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  ctx.on('request', r => { if (watching && !/^(data|blob):/.test(r.url())) requests.push({ url: r.url(), method: r.method(), body: r.postData() }); });
  page.on('download', d => downloads.push(d));
  const response = await page.goto(`${site.url}${urlPath}`);
  if (js) await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  watching = true;
  return { ctx, page, errors, requests, downloads, response };
}

const nameShown = (page, name) => page.waitForFunction(n => document.querySelector('#card').getAttribute('aria-label').includes(n), name, { timeout: 90000 });
const typeName = async (page, name) => { await page.fill('#name', name); await nameShown(page, name); };
const statusIs = (page, re, timeout = 90000) => page.waitForFunction(s => new RegExp(s).test(document.querySelector('#status').textContent), re.source, { timeout });
const axe = page => h.axe(page);
// the look changes through transitions, and axe reads a colour half way between two: wait for them to finish (the playful bunting sways for ever, so only what ends)
const setLook = (page, register, theme) => page.evaluate(async ([r, t]) => {
  document.documentElement.dataset.register = r; document.documentElement.dataset.theme = t;
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
}, [register, theme]);
const bytesOf = file => fs.readFileSync(file);
const sizeKB = n => `${(n / 1024).toFixed(0)} KB`;
const radiosOf = page => page.$$eval('input[name="scene-pick"]', els => els.map(e => ({ value: e.value, checked: e.checked, label: e.closest('label').innerText.trim() })));
const sceneOf = page => page.inputValue('#scene');
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, name), fullPage: true }); };
const ONLY_STATIC = /\.(js|css|woff2?|avif|webp|jpe?g|png|svg|json|html?)$/;

// ═══ the page loads, under the deployed headers ═════════════════════════════════════════════════
{
  const { ctx, page, errors, response } = await openPage();
  check('the page loads at /postcard under the deployed Content-Security-Policy, with no error in the console', response.status() === 200 && !errors.length && /connect-src 'self'/.test(response.headers()['content-security-policy'] ?? ''), `${response.status()}, ${errors.length} errors, CSP ${(response.headers()['content-security-policy'] ?? 'none').slice(0, 60)}`);
  const head = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent, desc: document.querySelector('meta[name="description"]')?.content, header: !!document.querySelector('header.bar .brand'), footer: !!document.querySelector('footer.foot'), view: !!document.querySelector('#view-btn'), lang: document.documentElement.lang }));
  check("the site's own header, footer and View control are there, and the words are Kathakar's", head.header && head.footer && head.view && head.title === 'Your postcard of Goa · Susegad UI' && head.h1 === 'Your postcard of Goa' && head.desc === 'Make a free postcard of Goa with your name on it, stamped Goa. It is drawn in your browser, so your name stays on your device.' && head.lang === 'en', JSON.stringify(head).slice(0, 200));
  // the numbers come from the registry, not from the page's own typing
  const scenes = registry.items.filter(i => i.type === 'scene'), goan = scenes.filter(i => i.motif?.origin === 'goa').length;
  const about = await page.textContent('.pc-about');
  check('the scene counts are read from the registry: "N scenes drawn in code, M of them from Goa" with N and M as the registry has them', about.includes(`with ${scenes.length} scenes drawn in code, ${goan} of them from Goa.`), `registry ${scenes.length} and ${goan}; page "${about.trim().slice(0, 100)}"`);
  const lines = await page.evaluate(() => [document.querySelector('.pc-privacy')?.textContent, document.querySelector('.pc-own')?.textContent, document.querySelector('.pc-own a')?.getAttribute('href')]);
  check('the privacy line and the make-your-own line are on the page, and the address is a link', lines[0] === 'Your name stays on your device. The card is made right here in your browser, and nothing is sent or stored anywhere else.' && lines[1] === 'Know someone who would like one? They can make theirs at susegad.asymmetrica.ai/postcard' && lines[2] === 'postcard', JSON.stringify(lines).slice(0, 160));
  const map = await (await page.request.get(`${site.url}/sitemap.xml`)).text();
  check('the page is in the sitemap', map.includes('https://susegad.asymmetrica.ai/postcard<'), '');
  await ctx.close();
}

// ═══ the form and the scene picker ═════════════════════════════════════════════════════════════
{
  const { ctx, page, downloads, requests } = await openPage({ share: true });
  const f = await page.evaluate(() => {
    const n = document.querySelector('#name'), lab = document.querySelector('label[for="name"]'), hint = document.getElementById(n.getAttribute('aria-describedby'));
    return { value: n.value, placeholder: n.placeholder, label: lab?.textContent, hint: hint?.textContent, max: n.maxLength, auto: n.autocomplete, type: n.type, focusable: n.tabIndex === 0 };
  });
  check('the name field is EMPTY with the placeholder "Asha Naik", never a name filled in for the visitor', f.value === '' && f.placeholder === 'Asha Naik', JSON.stringify(f));
  check('the name field has its label "Your name" and a hint linked to it (any script, up to 60 letters), and says it is a name for the browser', f.label === 'Your name' && f.hint === 'Any name, in any script, up to 60 letters. The card changes as you type.' && f.max === 60 && f.auto === 'name', JSON.stringify(f));
  const byLabel = await page.getByLabel('Your name', { exact: true }).count();
  check('and a person finds it by its label', byLabel === 1, `${byLabel} field(s) labelled "Your name"`);
  const alt0 = await page.getAttribute('#card', 'aria-label');
  check('the card shows on arrival, with room for a name, and says so to a screen reader', /^A postcard with space for your name: the ferry crossing the Mandovi, with a jetty on each bank\. Stamped Goa, postmarked Panjim 22–23 Oct 2026\.$/.test(alt0) && !/for Your name/.test(alt0), alt0);

  // the scenes: a thumbnail each, and every one really loaded
  const radios = await radiosOf(page), group = await page.evaluate(() => { const fs = document.querySelector('fieldset[data-scene-picker]'); return { legend: fs?.querySelector('legend')?.textContent, name: new Set([...fs.querySelectorAll('input[type=radio]')].map(r => r.name)).size }; });
  check('the scenes are a labelled group of radio buttons: "Choose a scene", one for each of the recipe\'s scenes, named for what they show', group.legend === 'Choose a scene' && group.name === 1 && radios.length === SCENES.length && SCENES.every((s, i) => radios[i].value === s.name && radios[i].label === s.label), radios.map(r => r.label).join(' | '));
  const pics = await page.$$eval('.pc-thumb-pic img', els => els.map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 })));
  check('each thumbnail is a picture that loaded, not an empty box', pics.length === SCENES.length && pics.every(p => p.ok), pics.map(p => `${p.src}${p.ok ? '' : ' MISSING'}`).join(', '));
  check('the ferry is picked before there is a name, and its radio is the one checked', radios.filter(r => r.checked).map(r => r.value).join() === 'ferry' && await sceneOf(page) === 'ferry', '');

  // the seed: a name picks a scene, the same name the same scene, never one that stands still
  await typeName(page, 'Asha Naik');
  const picked = await sceneOf(page), expect = sceneForSeed(seedFor('Asha Naik'));
  const alt1 = await page.getAttribute('#card', 'aria-label'), phrase = SCENES.find(s => s.name === picked).blurb;
  check('a name picks a scene from its seed: the one the recipe\'s seed rule gives, its radio checked, the card showing it, a scene that moves', picked === expect && (await radiosOf(page)).filter(r => r.checked).map(r => r.value).join() === picked && alt1 === `A postcard for Asha Naik: ${phrase}. Stamped Goa, postmarked Panjim 22–23 Oct 2026.` && !SCENES.find(s => s.name === picked).still, `Asha Naik -> ${picked}; "${alt1.slice(0, 80)}"`);
  check('the alt text reads the card with the name first, then what is drawn, then the stamp and the postmark', /^A postcard for Asha Naik: .+\. Stamped Goa, postmarked Panjim 22–23 Oct 2026\.$/.test(alt1), alt1);
  const again = await openPage();
  await typeName(again.page, 'Asha Naik');
  check('the same name in another visit picks the same scene', await sceneOf(again.page) === picked, `${await sceneOf(again.page)} and ${picked}`);
  const names = ['Rohan Gaonkar', 'आशा नाईक', 'Joaquim Menezes', 'Zoë D’Souza', 'ಕಾರ್ತಿಕ್ ಹೆಗಡೆ'], got = new Set([picked]);
  for (const n of names) { await typeName(again.page, n); got.add(await sceneOf(again.page)); }
  check('other names reach other scenes (the picker is not stuck on one)', got.size >= 3, [...got].join(', '));
  await again.ctx.close();

  // choosing: another scene, a thumbnail, the arrow keys; a chosen scene stays when the name changes
  const order = SCENES.map(s => s.name), next = order[(order.indexOf(picked) + 1) % order.length];
  await page.click('#another-scene');
  await page.waitForFunction(n => document.querySelector('#card').getAttribute('aria-label').includes(n), SCENES.find(s => s.name === next).blurb.slice(0, 20));
  check('"Another scene" shows the next scene in the row, checks its radio, and says "Scene: ..." in the live region', await sceneOf(page) === next && (await radiosOf(page)).find(r => r.checked).value === next && (await page.textContent('#status')) === `Scene: ${SCENES.find(s => s.name === next).label}`, `${picked} -> ${next}; "${await page.textContent('#status')}"`);
  await typeName(page, 'Dev Kamat');
  check('a scene the visitor chose stays when the name changes', await sceneOf(page) === next, `${await sceneOf(page)} after typing another name`);
  await page.locator('.pc-thumb', { hasText: 'The salt pans' }).click();
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('salt pans'));
  check('a thumbnail chooses its scene', await sceneOf(page) === 'mithagar', await sceneOf(page));
  await page.locator('input[name="scene-pick"]:checked').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Goan village square'));
  check('the arrow keys move through the scenes, as radio buttons do', await sceneOf(page) === 'tinto', await sceneOf(page));
  // a scene that stands still: no GIF, and the note says why and is linked to the buttons
  await page.locator('.pc-thumb', { hasText: 'Palms at dusk' }).click();
  await page.waitForFunction(() => document.querySelector('#save-gif').disabled);
  const still = await page.evaluate(() => { const b = document.querySelector('#save-gif'), n = document.getElementById(b.getAttribute('aria-describedby')); return { gif: [b.disabled, document.querySelector('#share-gif').disabled], note: n.textContent, shown: !n.hidden, png: !document.querySelector('#save-png').disabled }; });
  check('a scene that stands still: Save GIF and Share GIF are off, the note says why in Kathakar\'s words and is linked to them, and the picture still saves', still.gif.every(Boolean) && still.note === WORDS.still && still.shown && still.png, JSON.stringify(still).slice(0, 220));
  await page.click('#another-scene');
  await page.waitForFunction(() => !document.querySelector('#save-gif').disabled);
  const moving = await page.evaluate(() => { const n = document.getElementById(document.querySelector('#save-gif').getAttribute('aria-describedby')); return { note: n.textContent, hidden: n.hidden }; });
  check('and on a scene that moves the buttons are back and the note is empty, so nothing describes them as still', moving.hidden && moving.note === '', JSON.stringify(moving));

  // no name: Save and Share nudge, and start nothing
  await page.fill('#name', ''); await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('space for your name'));
  const nudges = [];
  for (const id of ['save-png', 'save-gif', 'share-png', 'share-gif']) { await page.click(`#${id}`); nudges.push(await page.evaluate(() => [document.activeElement.id, document.querySelector('#status').textContent, document.querySelector('#progress').hidden].join('|'))); }
  check('Save and Share with no name move to the name field and say, in plain words, to type it first; nothing is made', nudges.every(n => n === `name|${WORDS.try}|true`) && !downloads.length && !(await page.evaluate(() => window.__shared.length)), nudges[0]);
  check('the form made no request on the way', requests.every(r => r.method === 'GET' && ONLY_STATIC.test(new URL(r.url).pathname)), `${requests.length} static GETs`);
  await ctx.close();
}

// ═══ privacy, proved ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, page, requests, downloads } = await openPage({ share: true, spy: true });
  const NAME = 'Asha Naik', name2 = 'ಕಾರ್ತಿಕ್ ಹೆಗಡೆ', name3 = 'आशा नाईक';
  await typeName(page, NAME);
  for (const label of ['The old post office', 'The Mandovi ferry', 'The salt pans', 'Palms at dusk']) { await page.locator('.pc-thumb', { hasText: label }).click(); await page.waitForFunction(() => document.querySelector('#progress').hidden); }
  await page.click('#another-scene'); await page.click('#another-scene');
  await page.locator('.pc-thumb', { hasText: 'The Mandovi ferry' }).click();
  await page.click('#save-png'); await statusIs(page, /^Saved postcard-asha-naik\.png/);
  await page.click('#save-gif'); await statusIs(page, /^Saved postcard-asha-naik\.gif/, 180000);
  // a ferry GIF is about 3 MB: over 2.5 MB, but inside the 4.8 MB budget, so the large-GIF note (tied to the budget) stays quiet
  {
    const gifSaved = downloads.filter(d => d.suggestedFilename().endsWith('.gif')).at(-1), bytes = fs.statSync(await gifSaved.path()).size, said = await page.textContent('#status');
    check('a GIF inside the size budget (the ferry, about 3 MB) is saved without the large-GIF note', bytes > 2_500_000 && bytes < 4_800_000 && !/large|chat apps/i.test(said), `${(bytes / 1e6).toFixed(2)} MB, status "${said.slice(0, 110)}", ${engine}`);
  }
  await page.click('#share-png'); await statusIs(page, /^Shared postcard-asha-naik\.png/);
  await page.click('#share-gif'); await statusIs(page, /^Shared postcard-asha-naik\.gif/, 180000);
  await page.click('#save-gif'); await page.waitForFunction(() => !document.querySelector('#cancel').hidden); await page.click('#cancel'); await statusIs(page, /^Cancelled\./, 60000);
  for (const n of [name2, name3]) { await typeName(page, n); await page.click('#save-png'); await statusIs(page, /^Saved postcard-/); }
  await page.press('#name', 'Enter');
  const odd = requests.filter(r => !(r.method === 'GET' && r.url.startsWith(site.url + '/') && !r.url.includes('?') && !r.body && ONLY_STATIC.test(new URL(r.url).pathname)));
  const needles = [NAME, 'Asha', 'Naik', 'Asha%20Naik', 'Asha+Naik', encodeURIComponent(name2), name2, encodeURIComponent(name3), name3, Buffer.from(NAME).toString('base64').slice(0, 8)];
  const carrying = requests.filter(r => needles.some(n => (r.url + (r.body ?? '')).includes(n)));
  const attempts = await page.evaluate(() => window.__attempts);
  check('privacy: not one request after the page loaded beyond the site\'s own static files (GET, no query, no body), none carrying a name, no fetch, no XHR, no beacon, no socket', !odd.length && !carrying.length && !attempts.length, odd.length ? `${odd.length} odd: ${odd.slice(0, 3).map(r => `${r.method} ${r.url.slice(0, 80)}`).join(', ')}` : carrying.length ? `carrying a name: ${carrying[0].url}` : attempts.length ? `attempts: ${attempts.slice(0, 3).join(', ')}` : `${requests.length} static GETs (${[...new Set(requests.map(r => r.url.split('/').pop().split('.').pop()))].join(', ')}), 0 attempts, over ${downloads.length} saves and ${await page.evaluate(() => window.__shared.length)} shares`);
  // and nothing keeps the name: no cookie, no storage, no database holds it
  const kept = await page.evaluate(async needles => {
    const hay = [document.cookie, JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage })];
    let dbs = []; try { dbs = ((await indexedDB.databases?.()) ?? []).map(d => d.name); } catch {}
    let caches_ = []; try { caches_ = await caches.keys(); } catch {}
    return { found: hay.some(h => needles.some(n => h.includes(n))), keys: Object.keys(localStorage), dbs, caches: caches_ };
  }, needles);
  check('privacy: the name is kept nowhere: no cookie, localStorage, sessionStorage, database or cache holds it (the site keeps only its look)', !kept.found && !kept.dbs.length && !kept.caches.length && kept.keys.every(k => /^sg-docs-/.test(k)), JSON.stringify(kept));
  await ctx.close();
}

// ═══ what is saved ═════════════════════════════════════════════════════════════════════════════
{
  const { ctx, page } = await openPage({ share: true });
  await typeName(page, 'Asha Naik');
  await page.locator('.pc-thumb', { hasText: 'The Mandovi ferry' }).click();
  await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Mandovi'));
  const [png] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#save-png')]);
  const pb = bytesOf(await png.path());
  check('Save picture downloads postcard-asha-naik.png, a PNG by its bytes', png.suggestedFilename() === 'postcard-asha-naik.png' && pb.subarray(1, 4).toString() === 'PNG', `${png.suggestedFilename()}, ${sizeKB(pb.length)}`);
  await statusIs(page, /^Saved postcard-asha-naik\.png\. It should be in your downloads or your Files app\.$/);
  const t0 = Date.now();
  const [gif] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#save-gif')]);
  const gb = bytesOf(await gif.path()), dec = readGif(new Uint8Array(gb));
  check('Save GIF downloads postcard-asha-naik.gif, a GIF89a of 30 frames at 900 by 600, looping, under 5 MB', gif.suggestedFilename() === 'postcard-asha-naik.gif' && gb.subarray(0, 6).toString() === 'GIF89a' && dec.frames.length === 30 && dec.w === 900 && dec.h === 600 && dec.loops && gb.length < 5_000_000, `${gif.suggestedFilename()}, ${dec.frames.length} frames, ${(gb.length / 1e6).toFixed(2)} MB, ${Date.now() - t0} ms in ${engine}`);
  await page.waitForFunction(() => { const i = document.querySelector('#gif-preview'); return !i.hidden && i.naturalWidth === 900; });
  const alt = await page.getAttribute('#gif-preview', 'alt');
  check('the finished GIF plays on the page with the card\'s words and "Moving."', /^A postcard for Asha Naik: .+ Moving\.$/.test(alt), alt.slice(-60));
  await page.click('#share-png'); await statusIs(page, /^Shared postcard-asha-naik\.png\.$/);
  const shared = await page.evaluate(() => window.__shared);
  check('Share hands the picture to the share sheet with the text and the link to make your own', shared[0]?.type === 'image/png' && shared[0]?.text === 'A postcard of Goa for Asha Naik. Make yours: https://susegad.asymmetrica.ai/postcard', JSON.stringify(shared[0]));
  await ctx.close();
}

// ═══ reduced motion ════════════════════════════════════════════════════════════════════════════
{
  const { ctx, page } = await openPage({ reduced: true, width: 390, height: 844 });
  const order = await page.evaluate(() => [...document.querySelectorAll('.pc-acts button')].map(b => b.id));
  check('reduced motion: Save picture comes first, and the page says the GIF is saved but not played, in Kathakar\'s words', order[0] === 'save-png' && order[1] === 'save-gif' && (await page.textContent('#motion-note')) === WORDS.reduced && await page.isVisible('#motion-note'), order.join());
  await typeName(page, 'Asha Naik');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#save-gif')]);
  await statusIs(page, /^Saved postcard-asha-naik\.gif/);
  const moving = await page.evaluate(() => ({ preview: !document.querySelector('#gif-preview').hidden, anims: document.getAnimations().filter(a => a.playState === 'running' && !a.effect?.target?.closest?.('header')).length }));
  check('reduced motion: the GIF is saved and not played: the preview stays the still card and nothing on the page is animating', dl.suggestedFilename().endsWith('.gif') && !moving.preview && moving.anims === 0, JSON.stringify(moving));
  await ctx.close();
}

// ═══ by keyboard, and the announcements ════════════════════════════════════════════════════════
{
  const { ctx, page, downloads } = await openPage();
  await page.evaluate(() => document.activeElement?.blur?.());
  const stops = [];
  for (let i = 0; i < 40 && !['save-gif'].includes(stops.at(-1)); i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => { const e = document.activeElement; return e.id || (e.matches('input[type=radio]') ? `radio:${e.value}` : e.tagName.toLowerCase() + (e.className ? `.${String(e.className).split(' ')[0]}` : '')); }));
  }
  const i = stops.indexOf('name'), after = stops.slice(i, i + 5);
  check('Tab reaches the name field, then ONE stop for the scene row, then Another scene, Save picture and Save GIF', after.join() === `name,radio:ferry,another-scene,save-png,save-gif`, after.join(' > '));
  const rings = [];
  for (const id of ['name', 'another-scene', 'save-png', 'save-gif', 'share-png', 'share-gif']) { await page.focus(`#${id}`); rings.push(await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })); }
  await page.locator('input[name="scene-pick"]:checked').focus();
  const ring = await page.evaluate(() => { const e = document.activeElement.nextElementSibling, s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check('every control shows a focus ring of at least 2 px (the scene row\'s on its picture)', rings.every(Boolean) && ring, rings.join());
  await page.fill('#name', 'Asha Naik'); const url0 = page.url(); await page.press('#name', 'Enter');
  check('Enter in the name field makes no request and goes nowhere', page.url() === url0 && !downloads.length, '');
  await nameShown(page, 'Asha Naik');
  // the GIF, by keyboard: progress shows, focus moves to Cancel, the live region says each stage, the file arrives, focus returns
  await page.evaluate(() => { window.__said = []; new MutationObserver(() => window.__said.push(document.querySelector('#status').textContent)).observe(document.querySelector('#status'), { childList: true, characterData: true, subtree: true }); });
  await page.focus('#save-gif');
  const dl = page.waitForEvent('download', { timeout: 180000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#progress').hidden);
  const atStart = await page.evaluate(() => ({ focus: document.activeElement.id, name: document.activeElement.getAttribute('aria-label'), bar: document.querySelector('#progress').getAttribute('aria-label'), live: document.querySelector('#status').getAttribute('role') }));
  await dl; await statusIs(page, /^Saved postcard-asha-naik\.gif/);
  const said = await page.evaluate(() => window.__said), drawing = said.filter(s => /^Drawing the frames: \d+%$/.test(s)), putting = said.filter(s => /^Putting the frames together: \d+%$/.test(s));
  check('the GIF by keyboard: focus moves to "Cancel making the GIF", the bar is named, and the live region says it is starting, drawing (by quarters), putting the frames together, then saved', atStart.focus === 'cancel' && atStart.name === 'Cancel making the GIF' && atStart.bar === 'Making the GIF' && atStart.live === 'status' && said[0] === 'Making your GIF. It can take a little while on a phone.' && drawing.length >= 2 && putting.length >= 2 && /^Saved postcard-asha-naik\.gif/.test(said.at(-1)), `${said.length} announcements: ${said.slice(0, 3).join(' / ')} ... ${said.at(-1).slice(0, 40)}`);
  check('focus comes back to Save GIF and the fields are free again', await page.evaluate(() => document.activeElement.id === 'save-gif' && !document.querySelector('#name').disabled && ![...document.querySelectorAll('input[name="scene-pick"]')].some(r => r.disabled)), await page.evaluate(() => document.activeElement.id));
  await page.focus('#save-gif'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#cancel').hidden && document.activeElement.id === 'cancel');
  await page.keyboard.press('Enter'); await statusIs(page, /^Cancelled\. Nothing was saved\.$/, 60000);
  check('Enter on Cancel stops the GIF, says "Cancelled. Nothing was saved.", and gives the page back', await page.evaluate(() => document.querySelector('#progress').hidden && document.activeElement.id === 'save-gif' && !document.querySelector('#save-gif').disabled), '');
  await ctx.close();
}

// ═══ accessibility: axe, every register, both themes, empty, filled, and with the GIF in progress ═
for (const width of [390, 1440]) {
  const { ctx, page } = await openPage({ width, height: width < 500 ? 844 : 900 });
  const bad = [], seen = [];
  for (const theme of ['light', 'dark']) for (const register of ['quiet', 'warm', 'playful']) {
    await setLook(page, register, theme);
    const v = await axe(page); seen.push(`${register}/${theme} ${v.length}`); if (v.length) bad.push(`${register}/${theme} empty: ${v.join('; ')}`);
  }
  await typeName(page, 'Asha Naik');
  for (const theme of ['light', 'dark']) for (const register of ['quiet', 'warm', 'playful']) {
    await setLook(page, register, theme);
    const v = await axe(page); if (v.length) bad.push(`${register}/${theme} filled: ${v.join('; ')}`);
  }
  await page.locator('.pc-thumb', { hasText: 'Palms at dusk' }).click(); await page.waitForFunction(() => document.querySelector('#save-gif').disabled);
  for (const [register, theme] of [['quiet', 'light'], ['playful', 'dark']]) { await setLook(page, register, theme); const v = await axe(page); if (v.length) bad.push(`${register}/${theme} still scene: ${v.join('; ')}`); }
  await page.locator('.pc-thumb', { hasText: 'The Mandovi ferry' }).click(); await page.waitForFunction(() => !document.querySelector('#save-gif').disabled);
  for (const [register, theme] of [['quiet', 'light'], ['warm', 'dark'], ['playful', 'light']]) {
    await setLook(page, register, theme);
    await page.click('#save-gif'); await page.waitForFunction(() => !document.querySelector('#progress').hidden);
    const v = await axe(page); if (v.length) bad.push(`${register}/${theme} GIF in progress: ${v.join('; ')}`);
    await page.click('#cancel'); await statusIs(page, /^Cancelled\./, 60000);
  }
  check(`axe, ${width} px: zero violations in quiet, warm and playful, light and dark, with the field empty and filled, on a still scene, and with the GIF in progress (WCAG 2.2 AA)`, !bad.length, bad.join(' | ') || `${seen.join(', ')} and 11 more states, last line: 0 violations`);
  await ctx.close();
}
{
  // no JavaScript: the page says what it needs, and what is on it is still labelled
  const { ctx, page } = await openPage({ js: false });
  const text = await page.evaluate(() => ({ nojs: document.querySelector('noscript')?.textContent, h1: document.querySelector('h1')?.textContent, label: !!document.querySelector('label[for="name"]') }));
  const html = await page.evaluate(() => { document.querySelectorAll('script').forEach(s => s.remove()); return '<!doctype html>' + document.documentElement.outerHTML; });
  await ctx.close();
  // axe on a scripted copy of what a browser without JavaScript builds (the scripts removed), as the other checks do
  const ctx2 = await browser.newContext(contextOptions(engine, { viewport: { width: 390, height: 844 } }));
  await ctx2.route('**/__check/nojs.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace('<head>', `<head><base href="${site.url}/">`) }));
  const p2 = await ctx2.newPage(); await p2.goto(`${site.url}/__check/nojs.html`); await p2.waitForLoadState('load');
  const v = await axe(p2); await ctx2.close();
  check('without JavaScript the page says cards are drawn in the browser and asks to switch it on, and axe finds 0 violations in what is left', text.nojs?.trim() === 'Postcards are drawn in your browser, so this page needs JavaScript. Please switch it on and come back.' && text.h1 === 'Your postcard of Goa' && text.label && !v.length, `${text.nojs?.trim().slice(0, 40)}; ${v.join('; ') || '0 violations'}`);
}

// ═══ the kit: the email files, press and hold, and ?scene= ═══════════════════════════════════════
{
  // the email image and snippet are fetched from the page's own origin, as a mail client fetches them from the live site
  const { ctx, page } = await openPage();
  const got = await page.evaluate(async () => {
    const one = async u => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, type: r.headers.get('content-type'), bytes: b.length, head: [...b.slice(0, 3)], text: r.headers.get('content-type')?.includes('html') ? new TextDecoder().decode(b) : '' }; };
    return { jpg: await one('/postcard/email.jpg'), html: await one('/postcard/email.html') };
  });
  const dims = await page.evaluate(async () => { const i = new Image(); i.src = '/postcard/email.jpg'; await i.decode(); return [i.naturalWidth, i.naturalHeight]; });
  check('the email image is served at /postcard/email.jpg: a JPEG of 1200 x 800 under 150 KB', got.jpg.status === 200 && got.jpg.type === 'image/jpeg' && got.jpg.head.join() === '255,216,255' && got.jpg.bytes < 150 * 1024 && dims.join('x') === '1200x800', [got.jpg.status, got.jpg.type, (got.jpg.bytes / 1024).toFixed(1) + ' KB', dims.join('x')].join(', '));
  const body = got.html.text.replace(/<!--[\s\S]*?-->/g, ''), imgs = [...body.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  const urls = [...new Set([...body.matchAll(/(?:src|href)="([^"]*)"/g)].map(m => m[1]))].sort();
  check('the email snippet is a table, served at /postcard/email.html, with no script or style block, every image with an alt, and absolute addresses to the page and the image', got.html.status === 200 && /<table[^>]*width="600"/.test(body) && !/<script|<style|<iframe|<form|\son\w+\s*=/i.test(body) && imgs.length >= 1 && imgs.every(i => /\balt="[^"]{5,}"/.test(i)) && urls.join() === 'https://susegad.asymmetrica.ai/postcard/email.jpg,https://susegad.asymmetrica.ai/postcard?scene=ferry', [got.html.status, imgs.length + ' image(s)', urls.join(' ')].join(', '));
  await ctx.close();
}
{
  // press and hold
  const { ctx, page, downloads } = await openPage({ width: 390, height: 844 });
  const before = await page.evaluate(() => ({ hidden: document.querySelector('#hold-img').hidden, line: document.querySelector('#hold-line').textContent }));
  await typeName(page, 'Asha Naik');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#save-png')]);
  await page.waitForFunction(() => !document.querySelector('#hold-img').hidden && document.querySelector('#hold-img').complete && document.querySelector('#hold-img').naturalWidth > 0, null, { timeout: 15000 }).catch(() => {});
  const hold = await page.evaluate(() => { const i = document.querySelector('#hold-img'), l = document.querySelector('#hold-line'), r = i.getBoundingClientRect(); return { shown: !i.hidden && i.complete && i.naturalWidth === 1800 && i.naturalHeight === 1200, src: i.src.slice(0, 5), alt: i.alt, card: document.querySelector('#card').getAttribute('aria-label'), line: l.textContent, live: l.getAttribute('role'), described: i.getAttribute('aria-describedby') === l.id, focusable: i.tabIndex >= 0, box: [Math.round(r.left), Math.round(r.width), Math.round(r.height), innerWidth] }; });
  check("press and hold: before any save the picture is hidden and the line empty; after Save picture the finished 1800 x 1200 PNG shows as an image with the card's own alt, and a line (a live region the image is described by) says what to do", before.hidden && before.line === '' && hold.shown && hold.src === 'blob:' && hold.alt === hold.card && /^A postcard for Asha Naik: /.test(hold.alt) && hold.line.length > 10 && hold.live === 'status' && hold.described && !hold.focusable && downloads.length === 1 && dl.suggestedFilename() === 'postcard-asha-naik.png', JSON.stringify(hold).slice(0, 230));
  check('press and hold at 390 px: the picture fits the screen at 3:2 and the page does not scroll sideways', hold.box[0] >= 0 && hold.box[0] + hold.box[1] <= hold.box[3] && Math.abs(hold.box[1] / hold.box[2] - 1.5) < 0.02 && (await sidewaysScroll(page, 390)).overflow <= 0, hold.box.join(' '));
  const v = await axe(page);
  check('axe, 390 px, with the finished picture shown: zero violations (WCAG 2.2 AA)', !v.length, v.join('; ') || '0 violations');
  await page.fill('#name', 'Dev Kamat'); await nameShown(page, 'Dev Kamat');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click('#save-png')]);
  await page.waitForFunction(() => document.querySelector('#hold-img').alt.includes('Dev Kamat'), null, { timeout: 15000 }).catch(() => {});
  check('a second save replaces the picture with the new card', dl2.suggestedFilename() === 'postcard-dev-kamat.png' && await page.evaluate(() => document.querySelectorAll('#hold-img').length === 1 && document.querySelector('#hold-img').alt.includes('Dev Kamat')), '');
  await shot(page, 'd-390-after-save.png');
  await ctx.close();
}
{
  // ?scene=
  const asked = async (q, name) => {
    const { ctx, page, errors } = await openPage({ path: '/postcard' + q });
    if (name) await typeName(page, name);
    const r = { scene: await sceneOf(page), checked: (await radiosOf(page)).filter(x => x.checked).map(x => x.value), alt: await page.getAttribute('#card', 'aria-label'), nameField: await page.inputValue('#name'), errors: errors.length };
    await ctx.close(); return r;
  };
  const ok = await asked('?scene=mithagar'), pinned = await asked('?scene=mithagar', 'Asha Naik');
  check('?scene= honours a valid id: the scene is picked, its radio checked and the card shows it; typing a name keeps the scene the link asked for', ok.scene === 'mithagar' && ok.checked.join() === 'mithagar' && /salt pans/i.test(ok.alt) && pinned.scene === 'mithagar' && /salt pans/i.test(pinned.alt), JSON.stringify([ok.scene, ok.checked, pinned.scene]));
  const ferry = await asked('?scene=ferry', 'Asha Naik'), free = await asked('', 'Asha Naik');
  check('?scene=ferry pins the default scene too: typing a name keeps the ferry the email showed (without it, this name picks another scene)', ferry.scene === 'ferry' && free.scene !== 'ferry', JSON.stringify([ferry.scene, free.scene]));
  const bogus = [await asked('?scene=nope'), await asked('?scene=__proto__'), await asked('?scene=ferry&scene=mithagar')], other = await asked('?name=Maria&scene=constructor&utm=x');
  check('?scene= with a bogus id (an unknown word, a prototype key, two ids) is ignored: the ferry stays, and nothing else in the address is read (a name in it fills nothing)', [...bogus, other].every(r => r.scene === 'ferry' && r.checked.join() === 'ferry' && r.nameField === '' && !r.errors), bogus.concat(other).map(r => r.scene).join());
}

// ═══ the phones: 390 and 1440, and a phone profile ═════════════════════════════════════════════
const PROFILE = engine === 'webkit' ? 'iPhone 15' : 'Pixel 7';
for (const cell of [{ label: '390 px', width: 390, height: 844 }, { label: '1440 px', width: 1440, height: 900 }, { label: `the ${PROFILE} profile`, device: PROFILE }]) {
  const { ctx, page } = await openPage(cell);
  const view = cell.device ? devices[PROFILE].viewport.width : cell.width;
  await typeName(page, 'Asha Naik');
  await page.locator('.pc-thumb', { hasText: 'The Mandovi ferry' }).click(); await page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Mandovi'));
  const side = await sidewaysScroll(page, view);
  check(`no sideways scroll at ${cell.label}`, side.overflow <= 0 && side.metaViewport, `${side.overflow}px over, scroll width ${side.scrollWidth} in ${side.viewWidth}`);
  const m = await page.evaluate(() => {
    const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left * 10) / 10, y: Math.round(b.top * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
    const small = [...document.querySelectorAll('#name, .pc-thumb, #another-scene, .pc-acts button')].map(e => ({ id: e.id || e.className, ...r(e) })).filter(b => b.h < 44 || b.w < 44);
    return { card: r(document.querySelector('#card')), name: r(document.querySelector('#name')), buttons: [...document.querySelectorAll('.pc-acts button')].map(b => ({ id: b.id, ...r(b) })), small, form: r(document.querySelector('.pc-name')), scenes: r(document.querySelector('.pc-thumbs')), vw: innerWidth };
  });
  check(`at ${cell.label} every control (the name field, each scene, Another scene, the four buttons) is at least 44 px each way, and the card is on the screen at 3:2`, !m.small.length && m.card.x >= 0 && m.card.x + m.card.w <= m.vw + 0.5 && Math.abs(m.card.w / m.card.h - 1.5) < 0.01, `card ${m.card.w} x ${m.card.h} from ${m.card.x}; buttons ${m.buttons.map(b => `${b.w}x${b.h}`).join(' ')}; small: ${m.small.map(s => `${s.id} ${s.w}x${s.h}`).join(', ') || 'none'}`);
  if (cell.width === 1440) {
    check('at 1440 px the card sits to the right of the form, and stays in view while the page scrolls', m.card.x > m.form.x + m.form.w && await page.evaluate(() => getComputedStyle(document.querySelector('.pc-preview')).position === 'sticky'), `form right edge ${Math.round(m.form.x + m.form.w)}, card left edge ${m.card.x}`);
  }
  const L = layout({ name: 'Asha Naik', scene: 'ferry', event: GOA_OCT_2026, measure: (t, size) => t.length * size * 0.5 }), k = m.card.w / 1800;
  console.log(`     ${cell.label}: card ${m.card.w} x ${m.card.h} at (${m.card.x}, ${m.card.y}); name field ${m.name.w} x ${m.name.h} at y ${m.name.y}; stamp on screen at (${Math.round(m.card.x + L.stamp.x * k)}, ${Math.round(m.card.y + L.stamp.y * k)}) ${Math.round(L.stamp.w * k)} x ${Math.round(L.stamp.h * k)}; name on the card from y ${Math.round(m.card.y + L.name.box.y * k)} to ${Math.round(m.card.y + (L.name.box.y + L.name.box.h) * k)}; buttons at y ${m.buttons.map(b => Math.round(b.y)).join(', ')}`);
  await ctx.close();
}

// ═══ the GIF on a phone: the time and the size, for the ferry and the old post office ═══════════
{
  const rows = [];
  for (const [label, rate] of engine === 'chromium' ? [['unthrottled', 1], ['4x CPU throttle', 4]] : [['unthrottled', 1]]) {
    const { ctx, page } = await openPage({ device: PROFILE, share: true });
    const cdp = engine === 'chromium' ? await ctx.newCDPSession(page) : null;
    await typeName(page, 'Asha Naik');
    for (const scene of ['The Mandovi ferry', 'The old post office']) {
      await page.locator('.pc-thumb', { hasText: scene }).click();
      await page.waitForFunction(s => document.querySelector('#card').getAttribute('aria-label').toLowerCase().includes(s), scene.includes('ferry') ? 'ferry' : 'post office');
      await cdp?.send('Emulation.setCPUThrottlingRate', { rate });
      const t0 = Date.now();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), page.click('#save-gif')]);
      const ms = Date.now() - t0, size = bytesOf(await dl.path()).length;
      await statusIs(page, /^Saved postcard-asha-naik\.gif/, 120000);
      await cdp?.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      rows.push({ scene, label, ms, size });
    }
    await ctx.close();
  }
  for (const r of rows) console.log(`     GIF on ${PROFILE} in ${engine}, ${r.scene}, ${r.label}: ${(r.ms / 1000).toFixed(1)} s, ${(r.size / 1e6).toFixed(2)} MB`);
  check('the GIF is made on the phone profile for both scenes, under 5 MB, and within a minute even at 4x CPU throttle', rows.every(r => r.size < 5_000_000 && r.ms < 60000), rows.map(r => `${r.scene.split(' ').pop()} ${r.label} ${(r.ms / 1000).toFixed(1)} s ${(r.size / 1e6).toFixed(1)} MB`).join('; '));
  fs.mkdirSync(shotDir, { recursive: true }); fs.writeFileSync(path.join(shotDir, 'gif-times.json'), JSON.stringify({ engine, profile: PROFILE, cpus: (await import('node:os')).cpus().length, rows }, null, 1));
}

// ═══ the pictures the report describes ═════════════════════════════════════════════════════════
if (SHOTS) {
  const a = await openPage({ device: PROFILE, register: 'warm', theme: 'light' });
  await setLook(a.page, 'warm', 'light'); await typeName(a.page, 'Asha Naik'); await a.page.locator('.pc-thumb', { hasText: 'The Mandovi ferry' }).click();
  await a.page.waitForFunction(() => document.querySelector('#card').getAttribute('aria-label').includes('Mandovi')); await shot(a.page, 'a-profile-warm-light-asha-ferry.png'); await a.ctx.close();
  const b = await openPage({ width: 390, height: 844 });
  await setLook(b.page, 'warm', 'dark'); await b.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); await shot(b.page, 'b-390-dark-empty.png'); await b.ctx.close();
  const c = await openPage({ width: 1440, height: 900 });
  await setLook(c.page, 'playful', 'light'); await typeName(c.page, 'Zoë D’Souza'); await shot(c.page, 'c-1440-playful-light-zoe.png'); console.log(`     (c) Zoë D’Souza picked ${await sceneOf(c.page)}`); await c.ctx.close();
}

await h.done();
