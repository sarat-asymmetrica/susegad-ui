// Browser check for `susegad create`: start an event site in an empty folder, serve it on its own
// (nothing from the repo is reachable), and prove the site works, in every language, register and
// theme, at phone and desktop width.
//
//   node packages/cli/create.check.mjs                    (chromium)
//   SG_ENGINE=webkit node packages/cli/create.check.mjs
//
// It also runs three probes on states that must fail, so we know the checks can go red: a
// non-empty folder is refused, a page with an unlabelled image makes axe complain, and a page
// that no longer matches strings.js makes `pages.mjs --check` exit 1.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
} catch (e) {
  check('the check ran to its end without crashing', false, String(e.stack ?? e).split('\n').slice(0, 4).join(' | '));
} finally {
  const code = await finish(results, [() => browser?.close(), () => server?.close?.()]);
  rmSync(scratch, { recursive: true, force: true });
  process.exit(code);
}
