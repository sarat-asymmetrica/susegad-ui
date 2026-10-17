// The front door's gates, run against the built site served at the root (the shape Workers serves).
//
//   node apps/docs/build.mjs --no-verify && node apps/docs/door.check.mjs
//   node apps/docs/door.check.mjs --engine=webkit      people press the View control in Safari too
//   node apps/docs/door.check.mjs --out <dir>          check another build (a control)
//
// What it holds: the View control (opens, sets the look, keeps it, closes on Escape and gives the focus back, never
// widens a phone, offers no palette), the hero (call to action, plain caption, the picture first on a phone), the
// four pictures on the home page, Newest read from the data, an item page's side list and conformance table, the
// footer rule, the Trust door one click from home, Start here's three ways in, the templates page running the
// event template and the bloom toy (it draws, and saving makes a file), and axe on each of those, the open View
// panel included. Exits non-zero on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../../tools/serve.mjs';
import { harness } from '../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';

const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = path.resolve(arg('out') ?? path.join(REPO_ROOT, 'out', 'docs'));
if (arg('engine')) process.env.SG_ENGINE = arg('engine');
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// The built site, served at the root as Workers serves it (out/docs, or --out), not the repo.
const h = await harness({
  serve: { root: OUT, notFoundHtml: '404.html' },
  axe: "this check runs axe itself, below, with every rule axe has (not h.axe()'s WCAG 2.2 AA tag set), on the open View panel, the dialog page, the Trust door, the Konkani pages, Start here and the templates page",
});
const { server, check, results, engine } = h;

async function open(urlPath, { width = 1440, height = 900, register = 'warm', theme = 'light', prefs } = {}) {
  const phone = width < 700;
  const context = await h.context({
    viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone, colorScheme: theme, acceptDownloads: true,
  });
  const saved = prefs ?? { register, theme, palette: 'susegad' };
  await context.addInitScript(p => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sg-docs-prefs', p); sessionStorage.setItem('seeded', '1'); } } catch {} }, JSON.stringify(saved));
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  const resp = await page.goto(server.url + urlPath, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { context, page, errors, status: resp?.status() };
}
/** What sticks out past the screen, so a failure names the element and not just the number. */
const offenders = (page, width) => page.evaluate(w => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > w + 1 && !e.closest('.table-wrap')).slice(0, 4).map(e => `${e.tagName.toLowerCase()}.${e.className} right ${Math.round(e.getBoundingClientRect().right)} ${getComputedStyle(e).whiteSpace}`), width);
/** Wait for every finite animation and transition to finish, so a contrast reading is never taken mid-blend. */
const settled = async page => {
  // time-based animations only (a scroll-driven one has no end), and never longer than two seconds
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter(a => a.timeline instanceof DocumentTimeline && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, 2000)),
  ]));
  await page.waitForTimeout(150);
};
const axe = async page => {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(v => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`));
};

try {
  // ── the View control ────────────────────────────────────────────────
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page, errors } = await open('/', { width, height, prefs: {} });
    const label0 = await page.getAttribute('#view-btn', 'aria-label');
    check(`${width}px: the View button's name starts with its visible word`, /^View/.test(label0) && (await page.textContent('#view-btn')).trim() === 'View', label0);
    await page.click('#view-btn');
    await page.waitForSelector('#view-panel:popover-open');
    const hasPalette = await page.evaluate(() => !!document.querySelector('#prefs [name="palette"]'));
    check(`${width}px: no Palette is offered to a visitor`, !hasPalette);
    const box = await page.evaluate(() => { const r = document.getElementById('view-panel').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    const over = await sidewaysScroll(page, width);
    check(`${width}px: the open panel sits inside the screen and the page does not scroll sideways`, box.l >= 0 && box.r <= width + 0.5 && over.overflow === 0, `panel ${Math.round(box.l)} to ${Math.round(box.r)} of ${width}, overflow ${over.overflow}px`);
    await page.check('#prefs input[name="register"][value="playful"]');
    await page.check('#prefs input[name="theme"][value="dark"]');
    const look = await page.evaluate(() => ({ ...document.documentElement.dataset, name: document.getElementById('view-btn').getAttribute('aria-label'), kept: localStorage.getItem('sg-docs-prefs') }));
    check(`${width}px: choosing sets the look, renames the button and keeps the choice`, look.register === 'playful' && look.theme === 'dark' && /playful mood, dark theme/.test(look.name) && /"playful"/.test(look.kept), JSON.stringify(look));
    await settled(page);
    const v = await axe(page);
    check(`${width}px: axe on the open View panel: 0 violations`, v.length === 0, v.join(' | '));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('view-panel').matches(':popover-open'));
    // the focus is handed back a moment after the panel closes (WebKit a little later than the others): wait for it, then read it
    await page.waitForFunction(() => document.activeElement?.id === 'view-btn', null, { timeout: 2000 }).catch(() => {});
    const focus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check(`${width}px: Escape closes it and the focus goes back to the button`, focus === 'view-btn', `focus on ${focus}`);
    await page.reload({ waitUntil: 'load' });
    const again = await page.evaluate(() => ({ ...document.documentElement.dataset, checked: [...document.querySelectorAll('#prefs input:checked')].map(i => i.value).join(',') }));
    check(`${width}px: the choice is there after a reload`, again.register === 'playful' && again.theme === 'dark' && again.checked === 'playful,dark', JSON.stringify(again));
    check(`${width}px: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }
  {
    // no storage at all: the page still renders, the choice still applies to this page, and the panel says it will not be kept
    const context = await h.context({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(server.url + '/');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    await page.click('#view-btn');
    await page.check('#prefs input[name="register"][value="quiet"]');
    const s = await page.evaluate(() => ({ reg: document.documentElement.dataset.register, note: !document.getElementById('view-store').hidden }));
    check('with storage blocked: the page renders, the choice applies, and the panel says it will not be kept', s.reg === 'quiet' && s.note && errs.length === 0, JSON.stringify({ ...s, errs }));
    await context.close();
  }
  {
    // a palette saved by an older visit is not applied: the site no longer offers it
    const { context, page } = await open('/', { prefs: { register: 'warm', theme: 'light', palette: 'casa' } });
    check('a saved Casa palette from an earlier visit is ignored', (await page.evaluate(() => document.documentElement.dataset.palette)) === 'susegad');
    await context.close();
  }

  // ── a refused copy: a second tap while the instruction shows must not leave the instruction on the button ──
  {
    const context = await h.context({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('refused')) }, configurable: true }); });
    const page = await context.newPage();
    await page.goto(server.url + '/');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    const btn = page.locator('.hero-install .copy');
    await btn.click();
    await page.waitForTimeout(250);
    const during = await btn.textContent();
    await btn.click();
    // both timers have run by 5.25 s + a margin; reading earlier would catch the first timer's restore before the second one lands
    await page.waitForTimeout(6500);
    const after = (await btn.textContent()).trim();
    check('a refused copy tapped twice: the button shows the instruction, then goes back to "Copy"', during.trim() !== 'Copy' && after === 'Copy', JSON.stringify({ during: during.trim(), after }));
    await context.close();
  }

  // ── the hero ────────────────────────────────────────────────────────
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const { context, page } = await open('/', { width, height });
    const h = await page.evaluate(() => {
      const top = s => document.querySelector(s)?.getBoundingClientRect().top;
      return {
        show: document.querySelector('.mast .cta a[href="showcase"]')?.textContent.trim(), agent: document.querySelector('.mast .cta a[href="start#path-agent"]')?.textContent.trim(),
        dev: document.querySelector('.mast .dev-line a[href="developers"]')?.textContent.trim(),
        cmd: document.getElementById('hero-cmd')?.textContent.trim(), copy: document.querySelector('.hero-install .copy')?.getAttribute('aria-label'),
        spans: document.querySelectorAll('#mast-line span:not(.mast-ul)').length, art: top('.mast-art'), h1: top('#title'), lede: top('.mast .lede'),
        cta: top('.cta'),
      };
    });
    // front door 4: the hero speaks to someone who wants a page (the showcase) and someone with an agent; the command moved to For developers
    check(`${width}px: the hero has See what it makes, Build it with your agent and the developer's door, and the page keeps the command with a copy button`, h.show === 'See what it makes' && h.agent === 'Build it with your agent' && h.dev === "The developer's door" && h.cmd === 'npx @susegad/cli create my-site' && h.copy === 'Copy the command', JSON.stringify(h));
    check(`${width}px: the caption is one line of text, not a span per word`, h.spans === 0, `${h.spans} word spans`);
    if (width < 700) check('390px: the picture comes above the heading and the paragraph', h.art < h.h1 && h.art < h.lede, `art ${Math.round(h.art)}, heading ${Math.round(h.h1)}`);
    else check('1440px: the picture stays beside the words', h.art < h.cta);
    if (width < 700) check('390px: See what it makes is on the first screen (picture, title, call to action, then the paragraph)', h.cta < 844, `cta at ${Math.round(h.cta)} of 844`);
    await context.close();
  }
  {
    const { context, page } = await open('/', { register: 'playful', theme: 'dark' });
    const u = await page.evaluate(() => { const s = document.querySelector('.mast-ul'); const c = getComputedStyle(s); return { img: c.backgroundImage.startsWith('url('), rep: c.backgroundRepeat, deco: c.textDecorationLine }; });
    check('1440 dark playful: the caption has one drawn underline, repeating along the line, and no per-word marks', u.img && /repeat-x/.test(u.rep) && u.deco === 'none', JSON.stringify(u));
    await context.close();
  }

  // ── what is inside, Newest, the footer rule ─────────────────────────
  // front door 4: the doors are a compact shelf under For developers (four across, two on a phone), not the home page's lead
  for (const [width, height, min] of [[1440, 900, 240], [390, 844, 150]]) {
    const { context, page } = await open('/', { width, height });
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.querySelectorAll('.door img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
    const doors = await page.evaluate(() => [...document.querySelectorAll('.door')].filter(d => d.querySelector('img')).map(d => ({ name: d.querySelector('.door-title a').textContent, w: Math.round(d.querySelector('img').getBoundingClientRect().width), ok: d.querySelector('img').naturalWidth > 0 })));
    check(`${width}px: four doors, each led by a picture at least ${min}px wide that loaded`, doors.length === 4 && doors.every(d => d.ok && d.w >= min), JSON.stringify(doors));
    const nw = await page.evaluate(() => ({ items: document.querySelectorAll('.new-item').length, dated: [...document.querySelectorAll('.new-meta')].filter(m => /, added \d{1,2} [A-Z][a-z]+ 20\d\d$/.test(m.textContent)).length }));
    const fam = await page.evaluate(() => [...document.querySelectorAll('.new-item a')].map(a => new URL(a.href).pathname).filter(p => p.startsWith('/recipes/') && ['agenda', 'speakers', 'venue'].includes(p.slice(9))));
    check(`${width}px: Newest lists items from the data, each with the date it joined, and the event template stands for its own pieces`, nw.items >= 6 && nw.dated === nw.items && fam.length === 0, JSON.stringify({ ...nw, fam }));
    if (width === 1440) {
      const rule = await page.evaluate(() => { const f = document.querySelector('footer.foot'); const m = document.getElementById('main'); const cs = getComputedStyle(f, '::before'); const fr = f.getBoundingClientRect(), mr = m.getBoundingClientRect(); const pl = parseFloat(getComputedStyle(f).paddingLeft), mpl = parseFloat(getComputedStyle(m).paddingLeft); return { rule: cs.borderTopWidth, left: fr.left + pl, mainLeft: mr.left + mpl, right: fr.right - parseFloat(getComputedStyle(f).paddingRight), mainRight: mr.right - parseFloat(getComputedStyle(m).paddingRight), fborder: getComputedStyle(f).borderTopWidth }; });
      check('1440px: the footer rule runs the width of the content column', rule.fborder === '0px' && parseFloat(rule.rule) > 0 && Math.abs(rule.left - rule.mainLeft) <= 1 && Math.abs(rule.right - rule.mainRight) <= 1, JSON.stringify(rule));
    }
    await context.close();
  }

  // ── an item page: the side list, the poster that rides along, the conformance table ──
  {
    const { context, page } = await open('/components/dialog', { width: 1440, height: 900 });
    const toc = await page.evaluate(() => [...document.querySelectorAll('.item-side .toc a')].map(a => ({ t: a.textContent.trim(), ok: !!document.getElementById(a.getAttribute('href').slice(1)) })));
    check('dialog: "On this page" lists Usage, Registers, Accessibility and Lineage, and each link lands', ['Usage', 'Registers', 'Accessibility', 'Lineage'].every(w => toc.some(t => t.t === w && t.ok)), JSON.stringify(toc.map(t => t.t)));
    const a11y = await page.evaluate(() => { const s = document.getElementById('a11y'); const rows = [...s.querySelectorAll('tbody tr')]; return { table: !!s.querySelector('table'), rows: rows.length, marks: s.querySelectorAll('.status').length, firstIsTable: s.querySelector('table')?.compareDocumentPosition(s.querySelector('ul:not(.a11y-counts)')) & Node.DOCUMENT_POSITION_FOLLOWING, more: s.querySelector('.a11y-more a')?.getAttribute('href') }; });
    check('dialog: its Accessibility section shows the conformance table, with a mark in every status cell, before the prose bullets', a11y.table && a11y.rows >= 15 && a11y.marks > a11y.rows && !!a11y.firstIsTable && a11y.more === '../accessibility', JSON.stringify(a11y));
    await page.evaluate(() => scrollTo(0, 2400));
    await page.waitForTimeout(300);
    const side = await page.evaluate(() => { const r = document.querySelector('.item-side-in').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), vh: innerHeight }; });
    check('dialog at 2400px down: the poster and list ride along (in view, top within 40px of the top)', side.top >= 0 && side.top <= 40 && side.top + side.h <= side.vh, JSON.stringify(side));
    const v = await axe(page);
    check('dialog page: axe 0 violations', v.length === 0, v.join(' | '));
    await context.close();
  }
  {
    const { context, page } = await open('/scenes/kantar', { width: 390, height: 844 });
    const code = await page.evaluate(() => [...document.querySelectorAll('.use-code')].map(c => ({ clipped: c.scrollWidth > c.clientWidth + 1, sw: c.scrollWidth, cw: c.clientWidth })));
    check('kantar at 390px: the install snippet wraps, nothing is cut off', code.length > 0 && code.every(c => !c.clipped), JSON.stringify(code));
    const over = await sidewaysScroll(page, 390);
    check('kantar at 390px: no sideways scroll', over.overflow === 0, `${over.overflow}px`);
    await context.close();
  }

  // ── the Trust door: one click from home ─────────────────────────────
  {
    const { context, page } = await open('/', { width: 390, height: 844 });
    const trust = await page.evaluate(() => { const r = document.querySelector('.bar-trust').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), shown: getComputedStyle(document.querySelector('.bar-trust')).display !== 'none' }; });
    check('390px: the Accessibility link is on the first line of the header, on screen with no scrolling', trust.shown && trust.l >= 0 && trust.r <= 390 && trust.t >= 0 && trust.b <= 100, JSON.stringify(trust));
    await page.tap('.bar-trust');
    await page.waitForURL(/\/accessibility$/);
    const t = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, rows: document.querySelectorAll('.summary tbody tr').length, links: [...document.querySelectorAll('.summary tbody th a')].filter(a => /^\/components\/[a-z-]+$/.test(new URL(a.href).pathname)).length, gaps: /Known gaps today/.test(document.body.textContent), browsers: !!document.querySelector('a[href="browsers"]'), without: /more components? (with|has) no conformance table/.test(document.body.textContent) && (m => !!m && Number(m[1]) === document.querySelectorAll('.summary tbody tr').length && Number(m[2]) > Number(m[1]))(document.body.textContent.match(/(\d+) of the (\d+) components have/)) }));
    check('390px: Accessibility is one tap from home, and it lists every component with a link to its table', /Accessibility and browsers/.test(t.h1) && t.rows >= 53 && t.links === t.rows && t.gaps && t.browsers && t.without, JSON.stringify(t));
    const v = await axe(page);
    check('the Trust door: axe 0 violations', v.length === 0, v.join(' | '));
    await context.close();
    for (const [p, h1, min] of [['/handoff', 'Handoff', 8], ['/browsers', 'Browsers', 8]]) {
      const c = await open(p, { width: 390, height: 844 });
      const info = await c.page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, h2: document.querySelectorAll('.side-main h2').length, priv: /docs\/(requests|reviews|briefs|LEDGER)/.test(document.body.textContent) }));
      const over = await sidewaysScroll(c.page, 390);
      check(`${p} at 390px: the page is there, with its sections and no private paths, and no sideways scroll`, info.h1 === h1 && info.h2 >= min && !info.priv && over.overflow === 0, `${JSON.stringify(info)} overflow ${over.overflow}px ${over.overflow ? JSON.stringify(await offenders(c.page, 390)) : ''} (min sections ${min})`);
      await c.context.close();
    }
  }

  // ── languages (decision 0025): one address each, alternates in the head, the switcher only where there are alternates ──
  for (const [p, tag, script] of [['/', 'en-IN', null], ['/gom-deva/', 'gom-Deva', 'Deva'], ['/gom-latn/', 'gom-Latn', 'Latn']]) {
    const { context, page, errors } = await open(p, { width: 390, height: 844 });
    await page.click('#view-btn');
    await page.waitForSelector('#view-panel:popover-open');
    const info = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(l => `${l.getAttribute('hreflang')}=${new URL(l.href).pathname}`).join(' '),
      switcher: [...document.querySelectorAll('sg-lang a')].map(a => `${a.getAttribute('hreflang')}${a.hasAttribute('aria-current') ? '*' : ''}:${a.textContent.trim()}`).join(' '),
      draft: [...(document.getElementById('draft-note')?.querySelectorAll('span') ?? [])].map(s => s.lang),
      navEnglish: [...document.querySelectorAll('.nav a')].every(a => a.getAttribute('hreflang') === 'en'),
      button: document.getElementById('view-btn').textContent.trim(),
      h1: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(),
    }));
    check(`${p}: html lang is the page's own, every language in the head with x-default, the switcher names each in its own script and marks this page`,
      info.lang === (tag === 'en-IN' ? 'en' : tag) && info.alternates === 'en-IN=/ gom-Deva=/gom-deva/ gom-Latn=/gom-latn/ x-default=/' && info.switcher === `en-IN${tag === 'en-IN' ? '*' : ''}:English gom-Deva${tag === 'gom-Deva' ? '*' : ''}:कोंकणी gom-Latn${tag === 'gom-Latn' ? '*' : ''}:Konknni`, JSON.stringify(info));
    if (script) check(`${p}: the draft note is there in Konkani and then in English, the nav says its pages are English, the View button is in Konkani`,
      info.draft.join() === `${tag},en-IN` && info.navEnglish && info.button === (script === 'Deva' ? 'रूप' : 'Rup'), JSON.stringify({ draft: info.draft, navEnglish: info.navEnglish, button: info.button }));
    await page.check(`#prefs input[name="register"][value="quiet"]`);
    const said = await page.evaluate(() => new Promise(r => setTimeout(() => r({ name: document.getElementById('view-btn').getAttribute('aria-label'), live: document.getElementById('announce').textContent }), 300)));
    if (script) check(`${p}: choosing a register renames the button and announces it in Konkani`, /^(रूप|Rup): /.test(said.name) && /(भाव|bhav)$/.test(said.live), JSON.stringify(said));
    await settled(page);
    const v = await axe(page);
    check(`${p}: axe on the open View panel: 0 violations`, v.length === 0, v.join(' | '));
    if (!script) {
      // Tabbing out of the last link of the open panel closes it
      await page.focus('sg-lang li:last-child a');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => !document.getElementById('view-panel').matches(':popover-open'), null, { timeout: 2000 }).then(() => check('/: Tabbing out of the open panel closes it', true), () => check('/: Tabbing out of the open panel closes it', false));
    }
    await page.keyboard.press('Escape');
    const over = await sidewaysScroll(page, 390);
    check(`${p} at 390px: no sideways scroll, no errors`, over.overflow === 0 && errors.length === 0, `${over.overflow}px ${errors.slice(0, 2).join(' | ')}`);
    if (script) {
      const v2 = await axe(page);
      check(`${p}: the page, closed, axe 0 violations`, v2.length === 0, v2.join(' | '));
    }
    await context.close();
  }
  for (const p of ['/start', '/components/dialog', '/accessibility']) {
    const { context, page } = await open(p, { width: 390, height: 844 });
    const has = await page.evaluate(() => ({ sw: !!document.querySelector('sg-lang'), alt: !!document.querySelector('link[rel="alternate"][hreflang]') }));
    check(`${p}: no Konkani version, so no switcher and no alternates`, !has.sw && !has.alt, JSON.stringify(has));
    await context.close();
  }
  {
    const r = await fetch(`${server.url}/words/front-door-3.md`);
    const t = await r.text();
    check('the words deck is not published (it names private paths)', r.status === 404 || !/Kathakar, 8 October/.test(t), `status ${r.status}`);
  }

  // ── Start here: three ways in ───────────────────────────────────────
  {
    const { context, page } = await open('/start', { width: 390, height: 844 });
    const s = await page.evaluate(() => ({ paths: [...document.querySelectorAll('.path-title')].map(h => h.textContent), r: !!document.querySelector('a[href="r/registry.json"]'), shadcn: document.getElementById('cmd-shadcn')?.textContent, sgBadge: /add scene-paus sg-badge/.test(document.body.textContent), walk: !!document.getElementById('walk') }));
    check('Start here: three cards (a site, pieces, an agent), the shadcn /r/ view listed, the walkthrough below, no sg-badge slip', s.paths.length === 3 && s.r && /shadcn@latest add .*\/r\/button\.json/.test(s.shadcn) && !s.sgBadge && s.walk, JSON.stringify(s));
    const first = await page.evaluate(() => document.querySelector('#path-agent').getBoundingClientRect().bottom);
    const rr = await fetch(`${server.url}/r/button.json`);
    check('the shadcn view builds: /r/button.json answers 200 as JSON', rr.status === 200 && (await rr.json()).name === 'button');
    const over = await sidewaysScroll(page, 390);
    check('Start here at 390px: no sideways scroll', over.overflow === 0, `${over.overflow}px; the three cards end ${Math.round(first)}px down`);
    const v = await axe(page);
    check('Start here: axe 0 violations', v.length === 0, v.join(' | '));
    await context.close();
  }

  // ── the templates page: the event template running, and the bloom toy ──
  {
    const { context, page, errors } = await open('/templates', { width: 1440, height: 900, register: 'quiet' });
    const f = await page.evaluate(() => ({ src: document.getElementById('live-frame')?.getAttribute('src'), checked: document.querySelector('#live-reg input:checked')?.value }));
    check('templates: the event template is in a frame, quiet first', /templates\/event\/site\/\?register=quiet$/.test(f.src) && f.checked === 'quiet', JSON.stringify(f));
    const frame = page.frameLocator('#live-frame');
    await frame.locator('h1').waitFor({ timeout: 15000 });
    const reg = await frame.locator('html').getAttribute('data-register');
    check('templates: the frame really shows the quiet register', reg === 'quiet', `data-register=${reg}`);
    await page.check('#live-reg input[value="playful"]');
    await page.waitForFunction(() => /register=playful/.test(document.getElementById('live-frame').getAttribute('src')));
    await page.locator('#bloom').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const c = document.getElementById('card'); if (!c) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 997) if (d[i] < 200) n++; return n > 20; }, null, { timeout: 20000 });
    check('templates: the marigold toy draws a card (dark pixels on the paper)', true);
    // wait on the state: the card is redrawn as the fonts and the bloom arrive, so ask until it shows gold (or say it never did)
    const gold = await page.waitForFunction(() => { const c = document.getElementById('card'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let y = 0; y < c.height; y += 12) for (let x = 0; x < c.width; x += 12) { const i = (y * c.width + x) * 4; if (d[i] > 170 && d[i + 1] > 100 && d[i + 1] < 215 && d[i + 2] < 100) n++; } return n > 60 ? n : false; }, null, { timeout: 15000 }).then(h => h.jsonValue(), () => 0);
    check('templates, quiet register: the card is still a marigold (gold pixels), not plain dots', gold > 60, `${gold} gold samples`);
    const a0 = await page.getAttribute('#card', 'aria-label');
    await page.fill('#name', 'Asha Naik');
    await page.waitForFunction(() => /Asha Naik/.test(document.getElementById('card').getAttribute('aria-label')));
    const a1 = await page.getAttribute('#card', 'aria-label');
    check('templates: typing a name renames the card for a screen reader', /Maria/.test(a0) && a1 === 'Greeting card for Asha Naik', `${a0} -> ${a1}`);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#save')]);
    const file = dl.suggestedFilename();
    await page.waitForFunction(() => /Saved as/.test(document.getElementById('status').textContent));
    const status = await page.textContent('#status');
    check('templates: Save the card makes a PNG named for the name, and says so', /^greeting-card-asha-naik\.png$/.test(file) && status.includes(file), `${file}: ${status}`);
    const over = await sidewaysScroll(page, 1440);
    check('templates: no sideways scroll', over.overflow === 0);
    check('templates: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    const v = await axe(page);
    check('templates: axe 0 violations', v.length === 0, v.join(' | '));
    await context.close();
  }
} catch (err) {
  check(`the check itself stopped: ${err.message?.split('\n')[0]}`, false);
}
const failed = results.filter(r => !r.ok).length;
await h.done({ summary: `\n${results.length - failed} passed, ${failed} failed in ${engine}` });
