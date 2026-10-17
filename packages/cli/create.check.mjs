// Browser check for `susegad create`: start an event site in an empty folder, serve it on its own
// (nothing from the repo is reachable), and prove the site works, in every language, register and
// theme, at phone and desktop width.
//
//   node packages/cli/create.check.mjs                    (chromium)
//   SG_ENGINE=webkit node packages/cli/create.check.mjs
//
// It also runs three probes on states that must fail, so we know the checks can go red: a
// non-empty folder is refused, a page with an unlabelled image makes axe complain, and a page
// that no longer matches strings.js makes `pages.mjs --check` exit 1. Last, it proves the conclave kit on the
// created site: the banner, the consent line, a ticket made on the device, and the pages opening with the
// network cut for real (the server is stopped).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../../tools/serve.mjs';
import { contextOptions, engineName, pickEngine } from '../../tools/lib/engine.mjs';
import { finish, locatorShapes, locatorRouteContrast } from '../../tools/lib/component-check.mjs';
import { run } from './bin/susegad.mjs';
import { sidewaysScroll } from '../../tools/lib/overflow.mjs';

// SG_QUICK=1 shrinks the page matrix to one cell per language, to iterate on the other checks. The real run never sets it.
const QUICK = !!process.env.SG_QUICK;
const TAB = 'Tab';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const cli = async (cwd, ...argv) => {
  const out = [], err = [];
  const code = await run(argv, { cwd, out: s => out.push(s ?? ''), err: s => err.push(s ?? '') });
  return { code, out: out.join('\n'), err: err.join('\n') };
};

/**
 * A static server that sends what a real host sends for static files (a type, a length, "public, max-age=0,
 * must-revalidate"), for the offline part of the kit: the dev server sends no-store on everything, which a worker
 * rightly never keeps and which stalls a worker's install in Chromium. Closing it cuts the network for real.
 */
async function staticServer(dir) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'public, max-age=0, must-revalidate' }); return r.end('404'); }
    const b = readFileSync(f);
    r.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream', 'content-length': b.length, 'cache-control': 'public, max-age=0, must-revalidate' });
    r.end(b);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => { srv.closeAllConnections?.(); srv.close(r); }) };
}

/** Close a context, but never wait on it for good: under load Playwright's close can block, and the verdict is already in. */
const shut = ctx => Promise.race([ctx.close().catch(() => {}), new Promise(r => setTimeout(r, 10000))]);

const scratch = mkdtempSync(join(tmpdir(), 'susegad-create-'));
const site = join(scratch, 'site');
const engine = engineName();
let server, browser;
try {
  // ── the command ─────────────────────────────────────────────────────
  {
    const busy = join(scratch, 'busy');
    mkdirSync(busy);
    writeFileSync(join(busy, 'mine.txt'), 'keep me');
    const r = await cli(scratch, 'create', 'busy', '--yes');
    check('a folder with something in it is refused, in plain words, and nothing is written', r.code === 1 && /already has 1 thing in it \(mine\.txt\)/.test(r.err) && !existsSync(join(busy, 'index.html')) && readFileSync(join(busy, 'mine.txt'), 'utf8') === 'keep me', r.err.split('\n')[0]);
    const r2 = await cli(scratch, 'create', 'site', '--yes');
    check('create makes the site in an empty folder', r2.code === 0 && existsSync(join(site, 'index.html')) && existsSync(join(site, 'gom-deva/index.html')) && existsSync(join(site, 'gom-latn/index.html')) && existsSync(join(site, 'susegad.json')), r2.err || `${r2.out.split('\n').length} lines`);
    const r3 = await cli(scratch, 'create', 'site', '--yes');
    check('and refuses to do it a second time in the same folder', r3.code === 1);
  }
  {
    const ok = spawnSync(process.execPath, ['pages.mjs', '--check'], { cwd: site, encoding: 'utf8' });
    check('the pages on disk are what strings.js makes (pages.mjs --check)', ok.status === 0, (ok.stdout + ok.stderr).trim());
    const hand = readFileSync(join(site, 'index.html'), 'utf8');
    writeFileSync(join(site, 'index.html'), hand.replace('<h1 id="hero-h">', '<h1 id="hero-h">edited '));
    const bad = spawnSync(process.execPath, ['pages.mjs', '--check'], { cwd: site, encoding: 'utf8' });
    check('probe: a page that was changed by hand makes pages.mjs --check exit 1', bad.status === 1 && /index\.html is not what strings\.js makes/.test(bad.stderr), bad.stderr.trim());
    writeFileSync(join(site, 'index.html'), hand);
  }

  server = await startServer({ root: site, quiet: true });
  browser = await pickEngine(engine).launch();
  const PAGES = { 'en-IN': '/index.html', 'gom-Deva': '/gom-deva/index.html', 'gom-Latn': '/gom-latn/index.html' };

  async function open(path, { width = 1280, height = 900, js = true, reduced = false, now } = {}) {
    const errors = [], failed = [], requests = [];
    const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: width < 600, isMobile: width < 600 }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    // WebKit logs an error when a page is left (a language link pressed at once) while its worker script is still loading; the page is gone, so it is not the page's
    page.on('console', m => { if (m.type() === 'error' && !(engine === 'webkit' && /sw.js due to access control checks/.test(m.text()))) errors.push(m.text()); });
    page.on('requestfailed', r => failed.push(r.url()));
    page.on('response', r => { requests.push(r.url()); if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    if (now) await page.clock.install({ time: new Date(now) });
    await page.goto(`${server.url}${path}`);
    await page.waitForLoadState('load');
    if (js) await page.evaluate(() => document.fonts.ready);
    return { ctx, page, errors, failed, requests };
  }
  const axe = async page => {
    await page.addScriptTag({ content: AXE });
    return page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations.map(v => `${v.id} (${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')})`), WCAG);
  };

  /** What is on screen that should not be: anything with the hidden attribute that still renders (a dead button), the Play button while the scene it offers is already live, and a switcher link off the left edge. */
  const showingWrongly = page => page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('[hidden]')) {
      if (getComputedStyle(e).display !== 'none' && e.getClientRects().length) out.push(`<${e.tagName.toLowerCase()} class="${e.className}"> has hidden but renders (display ${getComputedStyle(e).display})`);
    }
    const lazy = document.querySelector('sg-lazy'), play = document.querySelector('.hero-play');
    if (lazy?.dataset.state === 'live' && play && play.getBoundingClientRect().height > 0) out.push('Play the picture is showing while the scene is already live');
    const left = Math.min(...[...document.querySelectorAll('sg-lang a')].map(a => a.getBoundingClientRect().left));
    // quiet's links are bare words, so their (invisible) box may start at the edge; warm and playful draw a shape there
    if (left < 4 && document.documentElement.dataset.register !== 'quiet') out.push(`a switcher link starts at x=${Math.round(left)}, against the edge of the screen`);
    return out;
  });

  // ── axe, console and requests: every language, register, theme, width ──
  const sizes = { phone: 390, desktop: 1280 };
  let combos = 0, dirty = [];
  for (const [tag, path] of Object.entries(PAGES)) {
    for (const register of QUICK ? ['quiet'] : ['quiet', 'warm', 'playful']) {
      for (const theme of QUICK ? ['dark'] : ['light', 'dark']) {
        for (const [size, width] of QUICK ? [['phone', 390]] : Object.entries(sizes)) {
          const { ctx, page, errors, failed } = await open(`${path}?register=${register}&theme=${theme}`, { width });
          // the scene, when this register starts it, needs a moment to draw its first frame
          await page.waitForTimeout(register === 'quiet' ? 150 : 700);
          const v = await axe(page);
          // measured against the width we asked for: on a phone, innerWidth and clientWidth grow to fit wide content, so they cannot show it
          const sideways = (await sidewaysScroll(page, width)).overflow;
          const wrong = await showingWrongly(page);
          combos++;
          const problems = [...v, ...wrong, ...errors.map(e => `console: ${e}`), ...failed.map(f => `request: ${f}`), ...(sideways > 0 ? [`scrolls sideways by ${sideways}px`] : [])];
          if (problems.length) dirty.push(`${tag} ${register} ${theme} ${size}: ${problems.join('; ')}`);
          await shut(ctx);
        }
      }
    }
  }
  check(`axe 0 violations, no console errors, no failed requests, no sideways scroll and nothing hidden showing (computed display) on all ${combos} pages ${QUICK ? '(SG_QUICK: one cell per language)' : '(3 languages x 3 registers x 2 themes x 2 widths)'}`, !dirty.length, dirty.slice(0, 3).join(' | '));

  // ── the venue locator: every drawn shape has a rule (a route and a stop once fell back to black) ──
  {
    const bad = [];
    let shapes = 0;
    for (const [tag, path] of Object.entries(PAGES)) {
      for (const register of QUICK ? ['quiet'] : ['quiet', 'warm', 'playful']) {
        for (const theme of QUICK ? ['dark'] : ['light', 'dark']) {
          const { ctx, page } = await open(`${path}?register=${register}&theme=${theme}`);
          const r = await locatorShapes(page);
          shapes = r.n;
          if (r.unstyled.length) bad.push(`${tag} ${register} ${theme}: ${r.unstyled.join(',')} has the UA default`);
          if (!r.walk || r.walk.fill !== 'none' || r.walk.stroke === 'none') bad.push(`${tag} ${register} ${theme}: walk ${JSON.stringify(r.walk)}`);
          const c = await locatorRouteContrast(page);
          if (!(c.min >= 3)) bad.push(`${tag} ${register} ${theme}: route contrast ${JSON.stringify(c.ratios)}`);
          await shut(ctx);
        }
      }
    }
    check(`the locator's ${shapes} shapes all carry a rule on every page, register and theme, and the walking route is a stroked line with no fill and 3:1 against what it touches`, !bad.length && shapes > 0, bad.slice(0, 3).join(' | '));
  }

  {
    // probe: the same instrument must go red on a page that is wrong
    const { ctx, page } = await open(`${PAGES['en-IN']}?register=quiet`);
    await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', '<img src="posters/hero.jpg" width="40" height="40">'));
    const v = await axe(page);
    check('probe: an image with no alt text makes axe report image-alt', v.some(s => s.startsWith('image-alt')), v.join('; '));
    await shut(ctx);
  }

  // ── the switcher, by keyboard ───────────────────────────────────────
  {
    const { ctx, page, errors } = await open(`${PAGES['en-IN']}?register=quiet`);
    const tabTo = async hreflang => {
      // WebKit leaves links out of the Tab order unless the person turns that setting on (Option+Tab in Safari),
      // so there focus is put on the link directly and the keyboard press that follows is still real.
      if (engine === 'webkit') { await page.focus(`sg-lang a[hreflang="${hreflang}"]`); return true; }
      for (let i = 0; i < 40; i++) {
        if (await page.evaluate(h => document.activeElement?.getAttribute('hreflang') === h, hreflang)) return true;
        await page.keyboard.press(TAB);
      }
      return false;
    };
    const reached = await tabTo('gom-Deva');
    if (reached) await Promise.all([page.waitForURL(/gom-deva/), page.keyboard.press('Enter')]);
    const deva = await page.evaluate(() => ({ lang: document.documentElement.lang, current: document.querySelector('sg-lang [aria-current]')?.getAttribute('hreflang'), nav: document.querySelector('sg-lang nav').getAttribute('aria-label'), h1: document.querySelector('h1').textContent }));
    check('Tab reaches the Konkani link and Enter goes to the Devanagari page: html lang is gom-Deva and it is the current link', reached && deva.lang === 'gom-Deva' && deva.current === 'gom-Deva', JSON.stringify(deva));
    check('the switcher names itself in the page\'s own language (the shared Konkani word for Language)', deva.nav === 'भास', deva.nav);
    const back = await tabTo('en-IN');
    if (back) await Promise.all([page.waitForURL(u => !/gom-/.test(u.pathname)), page.keyboard.press('Enter')]);
    const en = await page.evaluate(() => document.documentElement.lang);
    check('and Tab, Enter on English comes back: html lang is en-IN', back && en === 'en-IN', en);
    const reachedLatn = await tabTo('gom-Latn');
    if (reachedLatn) await Promise.all([page.waitForURL(/gom-latn/), page.keyboard.press('Enter')]);
    const latn = await page.evaluate(() => document.documentElement.lang);
    check('the Romi page is reached the same way: html lang is gom-Latn', reachedLatn && latn === 'gom-Latn', latn);
    const alternates = await page.evaluate(() => [...document.querySelectorAll('link[rel=alternate]')].map(l => `${l.getAttribute('hreflang')} ${l.getAttribute('href')}`));
    check('every page lists all three alternates and x-default, with absolute addresses', alternates.length === 4 && alternates.every(a => /https?:\/\//.test(a)), alternates.join(' | '));
    check('no console errors while switching', !errors.length, errors.join(' | '));
    await shut(ctx);
  }

  // ── the poster is the first paint, and the scene waits ──────────────
  for (const register of ['quiet', 'warm']) {
    const { ctx, page, requests } = await (async () => {
      const requests = [];
      const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1280, height: 900 } }));
      await ctx.addInitScript(() => {
        window.__lcp = null;
        new PerformanceObserver(l => { const e = l.getEntries().at(-1); window.__lcp = e.element?.tagName ?? '?'; }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const page = await ctx.newPage();
      page.on('response', r => requests.push(r.url()));
      await page.goto(`${server.url}/index.html?register=${register}`);
      await page.waitForLoadState('load');
      return { ctx, page, requests };
    })();
    await page.waitForTimeout(register === 'quiet' ? 400 : 1800);
    const s = await page.evaluate(() => { const l = document.querySelector('sg-lazy'), img = l.querySelector('img'); return { state: l.dataset.state, hold: l.dataset.hold ?? '', lcp: window.__lcp, posterLoaded: img.complete && img.naturalWidth > 0, playHidden: document.querySelector('.hero-play').hidden, lazyH: Math.round(l.getBoundingClientRect().height), posterH: Math.round(l.querySelector('picture').getBoundingClientRect().height), figureH: Math.round(l.parentElement.getBoundingClientRect().height) }; });
    const sceneFetched = requests.some(u => /scenes\/pahat\/render\.js/.test(u));
    if (register === 'quiet') {
      check('quiet: the poster is the largest first paint, the scene is held ("quiet") and its code is never fetched', s.lcp === 'IMG' && s.posterLoaded && s.state === 'poster' && s.hold === 'quiet' && !sceneFetched, JSON.stringify(s));
      check('quiet: a Play button is offered, and pressing it starts the scene', await (async () => {
        if (s.playHidden) return false;
        await page.click('.hero-play');
        await page.waitForFunction(() => document.querySelector('sg-lazy').dataset.state === 'live', null, { timeout: 15000 }).catch(() => {});
        return page.evaluate(() => document.querySelector('sg-lazy').dataset.state === 'live' && document.querySelector('.hero-play').hidden);
      })());
    } else {
      check(`warm: the live scene sits over the poster, not under it (the picture block is ${s.lazyH}px tall, the poster alone ${s.posterH}px)`, Math.abs(s.lazyH - s.posterH) <= 2, JSON.stringify(s));
      check('warm: the poster is still the first paint, and then the scene starts behind it', s.lcp === 'IMG' && s.posterLoaded && (s.state === 'live' || s.state === 'loading') && sceneFetched, JSON.stringify(s));
    }
    await shut(ctx);
  }

  // ── no JavaScript ───────────────────────────────────────────────────
  for (const [tag, path] of Object.entries(PAGES)) {
    const { ctx, page, errors } = await open(`${path}?register=quiet`, { js: false });
    const r = await page.evaluate(() => ({
      sessions: [...document.querySelectorAll('.sg-session')].filter(li => li.getClientRects().length).length,
      speakers: document.querySelectorAll('.sg-speakers-list h3').length,
      venue: !!document.querySelector('.sg-venue-name')?.textContent.trim(),
      links: [...document.querySelectorAll('.sg-venue-link')].every(a => a.getAttribute('href')),
      poster: (() => { const i = document.querySelector('sg-lazy img'); return i.complete && i.naturalWidth > 0; })(),
      switcher: document.querySelectorAll('sg-lang a[href]').length,
    }));
    check(`${tag}, JS off: 10 sessions, 5 speakers, the venue, its map links, the poster and 3 language links all show`, r.sessions === 10 && r.speakers === 5 && r.venue && r.links && r.poster && r.switcher === 3 && !errors.length, JSON.stringify(r));
    await shut(ctx);
  }

  // JS off, in every register: the Play button must not render at all (it would do nothing), and nothing else hidden may show.
  {
    const bad = [];
    for (const register of ['quiet', 'warm', 'playful']) {
      const { ctx, page } = await open(`${PAGES['en-IN']}?register=${register}`, { js: false });
      const wrong = await showingWrongly(page);
      if (wrong.length) bad.push(`${register}: ${wrong.join('; ')}`);
      await shut(ctx);
    }
    check('JS off, every register: the Play button and everything else with the hidden attribute is not rendered (computed display)', !bad.length, bad.join(' | '));
  }
  // JS off at phone width, every language and register: nothing is wider than the screen (the page reads without scripts, so it must fit without them)
  {
    const bad = [];
    for (const [tag, path] of Object.entries(PAGES)) {
      for (const register of ['quiet', 'warm', 'playful']) {
        const { ctx, page } = await open(`${path}?register=${register}`, { js: false, width: 390 });
        const over = (await sidewaysScroll(page, 390)).overflow;
        const wide = over > 0 ? await page.evaluate(w => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > w + 1).slice(0, 2).map(e => e.tagName.toLowerCase() + '.' + e.className).join(','), 390) : '';
        if (over > 0) bad.push(`${tag} ${register}: ${over}px too wide (${wide})`);
        await shut(ctx);
      }
    }
    {
      // probe: the same measure goes red on a page with something too wide in it
      const { ctx, page } = await open(`${PAGES['en-IN']}?register=quiet`, { js: false, width: 390 });
      await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', '<div style="width:700px;height:4px"></div>'));
      const over = (await sidewaysScroll(page, 390)).overflow;
      check('probe: a 700 px element makes the phone-width measure report overflow', over > 0, `${over}px`);
      await shut(ctx);
    }
    check('JS off at 390 px, 3 languages x 3 registers: no page is wider than the screen (scrollWidth <= 390; innerWidth grows on a phone, so it cannot be the yardstick)', !bad.length, bad.slice(0, 3).join(' | '));
  }
  {
    // probe: the same assertion must go red on today's broken CSS, the site.css without its [hidden] rule
    const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1280, height: 900 }, javaScriptEnabled: false }));
    const css = readFileSync(join(site, 'site.css'), 'utf8');
    await ctx.route('**/site.css', r => r.fulfill({ contentType: 'text/css', body: css.replace('.button[hidden] { display: none; }', '') }));
    const page = await ctx.newPage();
    await page.goto(`${server.url}${PAGES['en-IN']}?register=quiet`);
    const wrong = await showingWrongly(page);
    check('probe: without the [hidden] rule the Play button renders with JS off, and the check says so', css.includes('.button[hidden]') && wrong.some(w => /hero-play/.test(w)), wrong.join('; '));
    await shut(ctx);
  }

  // speaker cards in a row end on one line
  {
    const { ctx, page } = await open(`${PAGES['en-IN']}?register=quiet`, { width: 1280 });
    const rows = await page.evaluate(() => {
      const byTop = new Map();
      for (const a of document.querySelectorAll('sg-person-card > article')) { const r = a.getBoundingClientRect(); const k = Math.round(r.top); byTop.set(k, [...(byTop.get(k) ?? []), Math.round(r.height)]); }
      return [...byTop.values()];
    });
    check('speaker cards in a row are the same height', rows.length >= 1 && rows.every(r => Math.max(...r) - Math.min(...r) <= 1), JSON.stringify(rows));
    await shut(ctx);
  }

  // ── now on stage, on a pretended Panjim clock ───────────────────────
  for (const [tag, path] of Object.entries(PAGES)) {
    const { ctx, page } = await open(`${path}?register=playful&theme=light`, { width: 390, now: '2026-11-21T10:40:00+05:30' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      states: [...document.querySelectorAll('.sg-session-state')].filter(s => !s.hidden).map(s => ({ id: s.closest('.sg-session').id, text: s.textContent, lang: s.getAttribute('lang') })),
      status: { text: document.querySelector('.sg-agenda-status')?.textContent, lang: document.querySelector('.sg-agenda-status')?.getAttribute('lang') },
    }));
    const forms = r.states.find(s => s.id === 'forms'), records = r.states.find(s => s.id === 'records');
    const shown = r.states.slice(0, 3).map(s => `${s.id}: ${s.text} [${s.lang}]`).join(' | ');
    if (tag === 'en-IN') {
      const ok = forms?.text === 'Now on stage, until 11:15 am' && records?.text.startsWith('Now on stage') && /2 sessions are on stage now/.test(r.status.text ?? '');
      check('en-IN: at 10:40 IST two sessions say "Now on stage, until 11:15 am" in words', ok, shown);
    } else {
      // the agenda's own words are Konkani now, in the page's own script, and carry no lang of their own: the page's lang is the right one
      const own = tag === 'gom-Deva' ? /[ऀ-ॿ]/ : /^[A-Za-z]/;
      const english = /^(Now|Next|Finished|On now|Between|That was)/;
      const ok = [forms, records].every(s => s && own.test(s.text) && !english.test(s.text) && s.lang === null) && r.status.lang === null && !/sessions are on stage/.test(r.status.text ?? '') && !english.test(r.status.text ?? '');
      check(`${tag}: at 10:40 IST the agenda's own words are Konkani, with no lang of their own (the page's lang stands)`, ok, `${shown} | status: ${r.status.text} [${r.status.lang}]`);
    }
    await shut(ctx);
  }

  // ── create's choices: a different look, fewer pages ─────────────────
  {
    const small = join(scratch, 'small');
    const r = await cli(scratch, 'create', 'small', '--register', 'warm', '--lang', 'en-IN,gom-Latn', '--site', 'https://conclave.goa.example/', '--yes');
    const html = r.code === 0 ? readFileSync(join(small, 'index.html'), 'utf8') : '';
    check('--register, --lang and --site write the pages again: warm, two pages, the given address', r.code === 0 && /data-register="warm"/.test(html) && !existsSync(join(small, 'gom-deva')) && existsSync(join(small, 'gom-latn/index.html')) && /hreflang="gom-Latn" href="https:\/\/conclave\.goa\.example\/gom-latn\/"/.test(html) && !/gom-Deva/.test(html), r.err.split('\n')[0]);
    const bad = await cli(scratch, 'create', 'x', '--lang', 'gom-Deva', '--yes');
    check('--lang that does not start with English is refused in plain words', bad.code === 1 && /List it first/.test(bad.err), bad.err.split('\n')[0]);
  }

  // ── the conclave kit: the banner, the consent line, the ticket and the offline pages, on the created site ──
  // Last, because it stops the server to cut the network for real.
  {
    const kit = await staticServer(site);
    const JSQR = readFileSync(createRequire(import.meta.url).resolve('jsqr/dist/jsQR.js'), 'utf8');
    // an independent decoder reads the matrix the page drew
    const decode = (page, rows) => page.evaluate(rows => {
      const px = 8, quiet = 4, n = rows.length, side = (n + quiet * 2) * px, data = new Uint8ClampedArray(side * side * 4).fill(255);
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '1') return; for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) { const o = (((y + quiet) * px + dy) * side + (x + quiet) * px + dx) * 4; data[o] = data[o + 1] = data[o + 2] = 0; } }));
      return window.jsQR(data, side, side)?.data ?? null;
    }, rows);

    // the banner and the consent line, in every language
    for (const [tag, path] of Object.entries(PAGES)) {
      const { ctx, page, errors } = await open(path);
      const k = await page.evaluate(() => ({
        banner: !!document.querySelector('sg-banner:not([hidden])')?.querySelector('.sg-banner-dismiss'),
        bannerFirst: !!(document.querySelector('sg-banner').compareDocumentPosition(document.querySelector('header')) & Node.DOCUMENT_POSITION_FOLLOWING),
        consent: !!document.querySelector('sg-consent input[name="consent"][required]:not(:checked)'), group: document.querySelector('sg-consent')?.getAttribute('role'),
      }));
      check(`${tag}: the banner is at the top with its cross, and the consent line is there with an unticked required box`, k.banner && k.bannerFirst && k.consent && k.group === 'group', JSON.stringify(k));
      check(`${tag}: no console errors with the kit on the page`, !errors.length, errors.join(' | '));
      await shut(ctx);
    }

    /** Record every request the context makes (pages and workers) that is not a GET to `origin`: another address, a POST, anything. */
    const watch = (ctx, origin, into) => ctx.on('request', r => {
      const u = r.url();
      if (/^(data|blob|about):/.test(u)) return;
      if (new URL(u).origin !== origin || r.method() !== 'GET') into.push(`${r.method()} ${u}`);
    });
    // the watcher can fail: a planted fetch to another address and a planted POST are both caught
    {
      const ctx = await browser.newContext(contextOptions(engine, { serviceWorkers: 'allow' }));
      const other = http.createServer((q, r) => { r.setHeader('access-control-allow-origin', '*'); r.end('x'); });
      await new Promise(r => other.listen(0, '127.0.0.1', r));
      const planted = [];
      watch(ctx, kit.url, planted);
      const page = await ctx.newPage();
      await page.goto(`${kit.url}/`);
      await page.waitForLoadState('load');
      const quiet = planted.length;
      await page.evaluate(async other => { await fetch(other, { mode: 'no-cors' }).catch(() => {}); await fetch('/planted', { method: 'POST', body: 'name=x' }).catch(() => {}); }, `http://127.0.0.1:${other.address().port}/x`);
      await page.waitForTimeout(300);
      check('the network watcher can fail: a planted fetch to another address and a planted POST are both caught, and a plain visit caught nothing', quiet === 0 && planted.length === 2 && planted.some(p => p.startsWith('POST')) && planted.some(p => p.includes(String(other.address().port))), JSON.stringify(planted));
      await ctx.close();
      await new Promise(r => other.close(r));
    }

    // registering makes the ticket on the device; the picture in the QR is the text beside it
    const made = {};
    const HEADING = { 'en-IN': 'Your ticket', 'gom-Deva': 'तुमचें तिकीट', 'gom-Latn': 'Tumchem tikit' };
    const TIME = { 'en-IN': 'Saturday 21 November, 9:30 am', 'gom-Deva': 'शेनवार 21 नोव्हेंबर, सकाळीं 9:30', 'gom-Latn': 'Sonvar 21 Novembr, sokallim 9:30' };
    for (const [tag, path] of Object.entries(PAGES)) {
      const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 900 }, serviceWorkers: 'allow', acceptDownloads: true }));
      const page = await ctx.newPage();
      const errors = [], sent = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      watch(ctx, kit.url, sent); // every request of the context, the worker's included: anything not a GET to this site's own address is a violation
      await page.goto(`${kit.url}${path}`);
      await page.waitForLoadState('load');
      await page.addScriptTag({ content: JSQR });
      await page.fill('#reg-name', 'Maria Fernandes');
      await page.fill('#reg-email', 'maria@example.in');
      await page.click('sg-consent .sg-consent-tick label');
      await page.click('.sg-register-form button[type="submit"]');
      await page.waitForFunction(() => !document.getElementById('ticket').hidden);
      const t = await page.evaluate(() => {
        const el = document.getElementById('ticket'), qr = el.querySelector('sg-qr');
        return { id: el.querySelector('.sg-ticket-id').textContent, value: qr.getAttribute('value'), rows: qr.symbol.rows, stored: localStorage.getItem('sg-ticket'), heading: el.querySelector('.sg-ticket-heading').textContent, facts: [...el.querySelectorAll('.sg-ticket-fact dd')].map(d => d.textContent.trim()), focus: document.activeElement.className };
      });
      check(`${tag}: registering makes a ticket on the device: an id, a code that decodes to it, and a heading in the page's language`, /^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(t.id) && t.value === t.id && (await decode(page, t.rows)) === t.id && t.heading === HEADING[tag], JSON.stringify([t.id, t.heading]));
      check(`${tag}: the name is on it and the time reads in the page's language`, t.facts[0] === 'Maria Fernandes' && t.facts[2] === TIME[tag], JSON.stringify(t.facts));
      check(`${tag}: it is kept on the device with no email address, and nothing was sent to any server`, !!t.stored && !/@/.test(t.stored) && sent.length === 0, `${t.stored} | ${sent.join(' ')}`);
      check(`${tag}: focus is on the ticket's heading`, t.focus === 'sg-ticket-heading', t.focus);
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('.sg-ticket-save')]);
      check(`${tag}: Save as picture downloads ticket-<id>.png`, download.suggestedFilename() === `ticket-${t.id}.png`, download.suggestedFilename());
      check(`${tag}: no console errors while registering`, !errors.length, errors.join(' | '));
      made[tag] = { ...t, ctx, page, port: new URL(page.url()).port };
    }

    // one visitor, one device: a ticket made on the English page is the same ticket on both Konkani pages
    {
      const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 900 } }));
      const page = await ctx.newPage();
      await page.goto(`${kit.url}/`);
      await page.waitForLoadState('load');
      await page.fill('#reg-name', 'Maria Fernandes');
      await page.fill('#reg-email', 'maria@example.in');
      await page.click('sg-consent .sg-consent-tick label');
      await page.click('.sg-register-form button[type="submit"]');
      await page.waitForFunction(() => !document.getElementById('ticket').hidden);
      const id = await page.evaluate(() => document.querySelector('.sg-ticket-id').textContent);
      for (const [tag, path] of [['gom-Deva', '/gom-deva/'], ['gom-Latn', '/gom-latn/']]) {
        const p = await ctx.newPage();
        await p.goto(`${kit.url}${path}`);
        await p.waitForLoadState('load');
        await p.waitForFunction(() => !document.getElementById('ticket').hidden, null, { timeout: 5000 }).catch(() => {});
        const r = await p.evaluate(() => ({ shown: !document.getElementById('ticket').hidden, id: document.querySelector('.sg-ticket-id')?.textContent, heading: document.querySelector('.sg-ticket-heading')?.textContent, event: document.querySelector('.sg-ticket-event dd')?.textContent.trim(), time: document.querySelector('.sg-ticket-time dd')?.textContent.trim() }));
        check(`a ticket made on the English page shows on the ${tag} page: the same id, with the heading, the event and the time in that language`, r.shown && r.id === id && r.heading === HEADING[tag] && r.time === TIME[tag] && r.event === { 'gom-Deva': 'मांडवी कॉन्क्लेव्ह', 'gom-Latn': 'Mandovi Conclave' }[tag], JSON.stringify(r));
        await p.close();
      }
      await ctx.close();
    }

    // no script: the form cannot send anything (the button is disabled in the HTML), and a line says why
    for (const [tag, path] of Object.entries(PAGES)) {
      const ctx = await browser.newContext(contextOptions(engine, { javaScriptEnabled: false, viewport: { width: 1000, height: 900 } }));
      const page = await ctx.newPage();
      const sent = [];
      page.on('request', r => { if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`); });
      page.on('framenavigated', f => { if (f === page.mainFrame() && /[?&]name=/.test(f.url())) sent.push(`navigated to ${f.url()}`); });
      await page.goto(`${kit.url}${path}`);
      await page.waitForLoadState('load');
      const k = await page.evaluate(() => ({ disabled: document.querySelector('.sg-register-form button[type="submit"]').disabled, line: document.querySelector('.sg-register-noscript')?.innerText ?? '', visible: !!document.querySelector('.sg-register-noscript')?.getClientRects().length }));
      await page.fill('#reg-name', 'Maria Fernandes');
      await page.fill('#reg-email', 'maria@example.in');
      await page.click('sg-consent .sg-consent-tick label').catch(() => {});
      await page.press('#reg-email', 'Enter');
      await page.waitForTimeout(600);
      check(`${tag}, JS off: Register is disabled, the line says registering needs JavaScript, and pressing Enter in a field sends nothing`, k.disabled && k.visible && /Registering needs JavaScript/.test(k.line) && sent.length === 0, JSON.stringify([k, sent]));
      await ctx.close();
    }

    // the first visit is enough: the worker, then the network cut for real
    const base = { 'en-IN': '/', 'gom-Deva': '/gom-deva/', 'gom-Latn': '/gom-latn/' };
    const first = made['en-IN'].page;
    await first.waitForFunction(async () => !!(await navigator.serviceWorker?.getRegistration('/')), null, { timeout: 10000 }).catch(() => {});
    const supported = await first.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration('/')));
    check(`the worker registered on the first visit (${engine})`, supported, supported ? '' : 'this browser build did not register a service worker');
    if (supported) {
      await first.waitForFunction(async () => { const names = await caches.keys(); if (!names.length) return false; return (await (await caches.open(names[0])).keys()).length >= 12; }, null, { timeout: 15000 }).catch(() => {});
      await made['gom-Deva'].page.waitForFunction(async () => { const names = await caches.keys(); if (!names.length) return false; return (await (await caches.open(names[0])).keys()).length >= 12; }, null, { timeout: 15000 }).catch(() => {});
      const hold = await first.evaluate(async () => { const out = []; for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) out.push(new URL(r.url).pathname); return out; });
      const need = ['/', '/offline.html', '/gom-deva/offline.html', '/gom-latn/offline.html', '/page.js', '/site.css', '/susegad/components/ticket/ticket.js'];
      check('after one visit it holds the event page, the three offline pages, the page script, the style and the ticket piece', need.every(p => hold.includes(p)), `${hold.length} files; missing: ${need.filter(p => !hold.includes(p)).join(' ')}`);
      check('and nothing from another address, no data file, and no response to a form', hold.every(p => !/\.json$|\/api\//.test(p)), hold.filter(p => /\.json$|\/api\//.test(p)).join(' '));
      // an edit reaches a returning visitor: change the style, rebuild, and the next visit online serves it (the worker's version is a hash of the
      // files, so it updates by itself; it used to wait for a constant to be bumped by hand, and the cached style was served for good)
      {
        const { page } = made['en-IN'];
        const before = readFileSync(join(site, 'sw.js'), 'utf8').match(/"version": "([0-9a-f]+)"/)?.[1];
        const colour = () => page.evaluate(() => getComputedStyle(document.querySelector('.hero h1')).color);
        const was = await colour();
        writeFileSync(join(site, 'site.css'), readFileSync(join(site, 'site.css'), 'utf8') + '\n.hero h1 { color: rgb(1, 2, 3) !important; }\n');
        const rebuilt = spawnSync(process.execPath, ['pages.mjs'], { cwd: site, encoding: 'utf8' });
        const after = readFileSync(join(site, 'sw.js'), 'utf8').match(/"version": "([0-9a-f]+)"/)?.[1];
        check('editing site.css and running pages.mjs gives the worker a new version by itself', rebuilt.status === 0 && !!before && !!after && before !== after, `${before} -> ${after}`);
        await page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration('/');
          await r.update();
          const w = r.installing || r.waiting;
          if (w && w.state !== 'activated') await new Promise(res => w.addEventListener('statechange', () => { if (w.state === 'activated') res(); }));
        });
        await page.reload();
        await page.waitForLoadState('load');
        const now = await colour();
        check(`after the worker has updated, the next visit online serves the edited style (${was} -> ${now})`, now === 'rgb(1, 2, 3)' && was !== now, `${was} -> ${now}`);
      }
      const port = made['en-IN'].port;
      await kit.close();
      for (const tag of ['en-IN', 'gom-Deva', 'gom-Latn']) {
        const { ctx } = made[tag];
        if (engine !== 'webkit') await ctx.setOffline(true); // the stopped server is the real cut; WebKit's emulation breaks a page a worker should answer
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${port}${base[tag]}`).catch(e => errors.push(`navigation: ${e.message}`));
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForTimeout(800);
        const r = await page.evaluate(() => ({ title: document.title, ticket: !document.getElementById('ticket')?.hidden, id: document.querySelector('.sg-ticket-id')?.textContent, rows: document.querySelector('#ticket sg-qr')?.symbol?.rows })).catch(() => ({}));
        check(`${tag}: with the network cut, the event page opens, and the ticket made before is on it, with the same id`, !!r.title && r.ticket === true && r.id === made[tag].id, JSON.stringify([r.title, r.ticket, r.id]));
        await page.addScriptTag({ content: JSQR }).catch(() => {});
        check(`${tag}: offline, the code is drawn again and decodes to the id beside it`, !!r.rows && (await decode(page, r.rows)) === made[tag].id, `${r.rows?.length} rows`);
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('.sg-ticket-save').catch(() => {})]);
        check(`${tag}: offline, Save as picture still works`, dl?.suggestedFilename() === `ticket-${made[tag].id}.png`, dl?.suggestedFilename() ?? 'no download');
        await page.goto(`http://127.0.0.1:${port}${base[tag]}never-visited/`).catch(() => {});
        const off = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, lang: document.documentElement.lang })).catch(() => ({}));
        check(`${tag}: a page never visited shows the offline page in the language of the folder`, off.h1 === { 'en-IN': 'No connection right now', 'gom-Deva': 'सध्या जोडणी ना', 'gom-Latn': 'Sodhya jodonni na' }[tag] && off.lang === tag, JSON.stringify(off));
        check(`${tag}: no page errors offline`, !errors.length, errors.join(' | '));
      }
    }
    for (const t of Object.values(made)) await shut(t.ctx);
    await kit.close();
  }
} catch (e) {
  check('the check ran to its end without crashing', false, String(e.stack ?? e).split('\n').slice(0, 4).join(' | '));
} finally {
  const code = await finish(results, [() => browser?.close(), () => server?.close?.()]);
  rmSync(scratch, { recursive: true, force: true });
  process.exit(code);
}
