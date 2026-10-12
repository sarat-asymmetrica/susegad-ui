// Browser checks for <sg-lang> and the three alternate pages of its demo
// (decision 0025): axe on every page, light and dark, all three registers;
// the switcher by keyboard and with no JavaScript, lang on <html> after each
// switch, Devanagari drawn in a Devanagari face and downloaded only on the pages
// that show it, leading by script, no layout shift between the pages, the strings
// table agreeing with the pages' own words, the hreflang head, remember,
// forced colours and phone width.
//
//   node packages/components/lang/lang.check.mjs        (SG_ENGINE=webkit | firefox for the others)

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { hreflangLinks } from './lang.core.js';

const { server, browser, engine, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DIR = '/packages/components/lang/';
const PAGES = { 'en-IN': 'demo.html', 'gom-Deva': 'demo.gom-Deva.html', 'gom-Latn': 'demo.gom-Latn.html' };
const TAGS = Object.keys(PAGES);

// ── axe: every page, light and dark, the three registers on each ──
for (const [tag, file] of Object.entries(PAGES)) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DIR}${file}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${tag}, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  await page.evaluate(() => document.querySelector('sg-lang a[aria-current]').focus());
  const f = await axe(page);
  check(`axe, ${tag}, ${theme}, with a switcher link focused: 0 violations`, !f.length, f.join('; '));
  check(`${tag}, ${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const [tag, file] of Object.entries(PAGES)) check(`axe without JavaScript, ${tag} at 390 px: 0 violations`, !(await axeNoJs(DIR + file, { width: 390 })).length);

// ── the markup says what a screen reader needs, on all three pages ──
for (const [tag, file] of Object.entries(PAGES)) {
  const { ctx, page } = await open(DIR + file);
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-lang')].map(s => ({
    label: s.querySelector('nav').getAttribute('aria-label'),
    links: [...s.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), hreflang: a.getAttribute('hreflang'), lang: a.getAttribute('lang'), current: a.getAttribute('aria-current') })),
  })));
  const shape = r.length === 3 && r.every(s => s.links.length === 3 && s.links.every(l => l.lang === l.hreflang && l.text) && s.links.filter(l => l.current).length === 1 && s.links.find(l => l.current).hreflang === tag);
  check(`${tag}: three switchers, each link has lang = hreflang and a name, exactly one aria-current and it is this page`, shape, JSON.stringify(r[0]));
  check(`${tag}: each language is named in its own script`, r.every(s => s.links.map(l => l.text).join() === 'English,कोंकणी,Konknni'), r[0].links.map(l => l.text).join());
  await ctx.close();
}
{
  // control: a switcher with no lang on its links and nothing marked current must fail the same shape test
  const { ctx, page } = await openHtml('lang-broken', `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>t</title></head><body><nav aria-label="x"><a href="/a">English</a><a href="/b">कोंकणी</a></nav></body></html>`, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => ({ lang: a.getAttribute('lang'), hreflang: a.getAttribute('hreflang'), current: a.getAttribute('aria-current') })));
  check('control: links with no lang, hreflang or aria-current fail the shape test', !r.every(l => l.lang === l.hreflang && l.hreflang) && !r.some(l => l.current), JSON.stringify(r));
  await ctx.close();
}

// ── the element fills in what the markup leaves out ──
{
  const { ctx, page, errors } = await openHtml('lang-bare', `<!doctype html><html lang="gom-Latn"><head><meta charset="utf-8"><title>t</title>
    <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="${DIR}lang.css"><script type="module" src="${DIR}lang.js"></script></head>
    <body><sg-lang><nav><ul><li><a href="/e" hreflang="en-IN"></a></li><li><a href="/d" hreflang="gom-Deva"></a></li><li><a href="/l" hreflang="gom-Latn"></a></li></ul></nav></sg-lang></body></html>`);
  await page.waitForFunction(() => document.querySelector('sg-lang a[aria-current]'));
  const r = await page.evaluate(() => ({ label: document.querySelector('nav').getAttribute('aria-label'), text: [...document.querySelectorAll('a')].map(a => a.textContent), lang: [...document.querySelectorAll('a')].map(a => a.lang), current: [...document.querySelectorAll('a')].findIndex(a => a.hasAttribute('aria-current')) }));
  check('a bare switcher: the label is in the page language, empty links get their own-script names and lang, aria-current comes from <html lang>',
    r.label === 'Bhas' && r.text.join() === 'English,कोंकणी,Konknni' && r.lang.join() === 'en-IN,gom-Deva,gom-Latn' && r.current === 2 && !errors.length, JSON.stringify({ ...r, errors }));
  await ctx.close();
}

// ── by keyboard, with and without JavaScript: the page changes and so does <html lang> ──
/** Tab until the link with this hreflang has focus (at most 6 presses); the focus it passed through is returned.
 *  Playwright's WebKit Tab skips links (Alt+Tab did not reach them either), so there the link is focused with
 *  focus() and the press that follows is still a real Enter: Tab order in WebKit is left to a real Safari. */
async function tabTo(page, hreflang) {
  const seen = [];
  if (engine === 'webkit') {
    await page.evaluate(h => document.querySelector(`sg-lang a[hreflang="${h}"]`).focus(), hreflang);
    return [hreflang];
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => document.activeElement?.getAttribute?.('hreflang') ?? document.activeElement?.localName);
    seen.push(at);
    if (at === hreflang) break;
  }
  return seen;
}
async function enterTo(page, pattern) {
  try { await Promise.all([page.waitForURL(pattern, { timeout: 8000 }), page.keyboard.press('Enter')]); return true; } catch { return false; }
}
for (const js of [true, false]) {
  const { ctx, page } = await open(DIR + PAGES['en-IN'], { js });
  const s1 = await tabTo(page, 'gom-Deva');
  const ok1 = await enterTo(page, /gom-Deva/);
  const a = await page.evaluate(() => document.documentElement.lang);
  const s2 = await tabTo(page, 'gom-Latn');
  const ok2 = await enterTo(page, /gom-Latn/);
  const b = await page.evaluate(() => document.documentElement.lang);
  check(`${js ? 'with' : 'without'} JavaScript: Tab to कोंकणी and Enter gives <html lang="${a}">; Tab to Konknni and Enter gives <html lang="${b}"> (${s1.length} and ${s2.length} Tab presses${engine === 'webkit' ? ', focus() in WebKit' : ''})`,
    ok1 && a === 'gom-Deva' && ok2 && b === 'gom-Latn', JSON.stringify({ s1, a, s2, b }));
  await ctx.close();
}

// ── type: the Devanagari face loads where Devanagari is shown, and only there ──
const devaFaces = page => page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded' && /^u\+0?900-/i.test(f.unicodeRange.trim())).map(f => `${f.family} ${f.weight}`));
{
  const out = {};
  for (const [tag, file] of Object.entries(PAGES)) {
    const { ctx, page } = await open(DIR + file);
    await page.evaluate(() => document.fonts.ready);
    out[tag] = await devaFaces(page);
    if (engine === 'chromium') {
      const cdp0 = await ctx.newCDPSession(page);
      await cdp0.send('DOM.enable'); await cdp0.send('CSS.enable');
      const { root: r0 } = await cdp0.send('DOM.getDocument');
      const { nodeId } = await cdp0.send('DOM.querySelector', { nodeId: r0.nodeId, selector: 'sg-lang a[hreflang="gom-Deva"]' });
      (out.autonym ??= {})[tag] = (await cdp0.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(f => `${f.familyName}${f.isCustomFont ? '*' : ''}:${f.glyphCount}`);
    }
    if (tag === 'gom-Deva') {
      const ok = await page.evaluate(() => document.fonts.check('16px Mukta', 'कोंकणी') && document.fonts.check('16px "Tiro Devanagari Marathi"', 'स्वागत'));
      out.deva_check = ok;
      if (engine === 'chromium') {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument');
        const fonts = {};
        for (const sel of ['#probe', '.lede', 'sg-lang a']) {
          const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
          fonts[sel] = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.map(f => `${f.familyName}${f.isCustomFont ? '*' : ''}:${f.glyphCount}`);
        }
        out.platform = fonts;
      }
    }
    await ctx.close();
  }
  check('the Devanagari page loads a Devanagari face (Mukta and Tiro Devanagari Marathi found for the glyphs)', out['gom-Deva'].length > 0 && out.deva_check, JSON.stringify({ loaded: out['gom-Deva'], check: out.deva_check }));
  {
    // control: the same probe, on a page that does show Devanagari under an English lang, must see the face
    const { ctx, page } = await openHtml('lang-deva-control', `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"></head><body style="font-family:var(--sg-font-body)"><p>कोंकणी</p></body></html>`);
    await page.waitForFunction(() => [...document.fonts].some(f => f.status === 'loaded' && /^u\+0?900-/i.test(f.unicodeRange.trim())), null, { timeout: 15000 }).catch(() => {});
    const seen = await devaFaces(page);
    check('control: the probe sees a Devanagari face on a page that shows Devanagari', seen.length > 0, JSON.stringify(seen));
    await ctx.close();
  }
  {
    // the split itself: a page with no Devanagari downloads none (the pages here all show the Konkani name in the switcher, so they do)
    const { ctx, page } = await openHtml('lang-latin-only', `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"></head><body style="font-family:var(--sg-font-body)"><p>Hello</p></body></html>`);
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
    const none = await devaFaces(page);
    check('a page with no Devanagari downloads no Devanagari face (the unicode-range split holds)', none.length === 0, JSON.stringify(none));
    await ctx.close();
  }
  if (engine === 'chromium') {
    check('chromium: कोंकणी in the switcher is drawn in a custom Devanagari face on all three pages, English page included', TAGS.every(t => out.autonym[t].some(f => /^(Mukta|Kalam)[^*]*\*/.test(f))), JSON.stringify(out.autonym));
    const p = out.platform;
    check('chromium: the probe is drawn in Tiro Devanagari Marathi, the body words in Mukta, the switcher in Mukta (custom faces, not a system fallback)',
      p['#probe'].some(f => /^Tiro Devanagari Marathi\*/.test(f)) && p['.lede'].some(f => /^Mukta\*/.test(f)) && p['sg-lang a'].some(f => /^Mukta\*/.test(f)), JSON.stringify(p));
  } else console.log(`note  platform font per glyph is a Chromium DevTools call; ${engine} is checked through document.fonts only`);
}

// ── leading follows the script ──
{
  const lead = {};
  for (const [tag, file] of Object.entries(PAGES)) {
    const { ctx, page } = await open(DIR + file);
    lead[tag] = await page.evaluate(() => { const p = document.querySelector('.lede'), c = getComputedStyle(p); return +(parseFloat(c.lineHeight) / parseFloat(c.fontSize)).toFixed(2); });
    await ctx.close();
  }
  check('body leading: Devanagari 1.75, Romi and English 1.6', lead['gom-Deva'] === 1.75 && lead['gom-Latn'] === 1.6 && lead['en-IN'] === 1.6, JSON.stringify(lead));
}

{
  // Latin text inside a Devanagari page takes Latin leading; the control carries the old tokens' behaviour (no :lang(en) rule) and must read the Devanagari value
  const page_ = extra => `<!doctype html><html lang="gom-Deva"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css">${extra}</head><body><p id="d">कोंकणी</p><p id="e" lang="en-IN">English words</p><p id="l" lang="gom-Latn">Konknni</p></body></html>`;
  const snug = async html => { const { ctx, page } = await openHtml(`lang-leading-${Math.random().toString(36).slice(2)}`, html); const r = await page.evaluate(() => ['d', 'e', 'l'].map(i => { const e = document.getElementById(i); return +(parseFloat(getComputedStyle(e).getPropertyValue('--sg-leading-snug'))).toFixed(2); })); await ctx.close(); return r; };
  const real = await snug(page_(''));
  check('inside a gom-Deva page: Devanagari snug leading 1.45, an en-IN span 1.3, a gom-Latn span 1.3', real.join() === '1.45,1.3,1.3', real.join());
  // control: the real stylesheet with the :lang(en) selector taken out of it (the state before this fix), inlined in place of the link
  const css = await (await fetch(`${server.url}/packages/tokens/tokens.css`)).text();
  const cut = css.replace(':lang(en), :lang(kok-Latn)', ':lang(kok-Latn)');
  const broken = await snug(page_('').replace('<link rel="stylesheet" href="/packages/tokens/tokens.css">', `<style>${cut}</style>`));
  check('control: the same page with the :lang(en) selector removed from tokens.css reads 1.45 for the English span (the probe can fail)', cut !== css && broken[1] === 1.45, broken.join());
}

// ── no layout shift: none while a page loads, and the switchers sit in the same place on all three ──
for (const width of [1280, 390]) {
  const boxes = {};
  for (const [tag, file] of Object.entries(PAGES)) {
    const { ctx, page } = await open(DIR + file, { width });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    boxes[tag] = await page.evaluate(async () => {
      const cls = await new Promise(res => { let s = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) s += e.value; }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => res(+s.toFixed(4)), 50); });
      return { cls, tops: [...document.querySelectorAll('sg-lang')].map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.top + scrollY), Math.round(r.height)]; }), h: document.querySelector('h1').getBoundingClientRect().height | 0 };
    }).catch(() => ({ cls: 0, tops: [], h: 0 }));
    await ctx.close();
  }
  // The h1 is a different height in Devanagari (more leading); the switchers below it follow the h1, so compare heights, and tops only up to the h1/lede difference.
  const heights = TAGS.every(t => JSON.stringify(boxes[t].tops.map(x => x[1])) === JSON.stringify(boxes['en-IN'].tops.map(x => x[1])));
  check(`${width} px: no layout shift on any page (CLS ${TAGS.map(t => boxes[t].cls).join(', ')})`, TAGS.every(t => boxes[t].cls < 0.01 && boxes[t].tops.length === 3), JSON.stringify(boxes));
  check(`${width} px: each switcher is the same height on all three pages`, heights, JSON.stringify(TAGS.map(t => boxes[t].tops)));
}

// ── the strings table and the pages agree ──
for (const [tag, file] of Object.entries(PAGES)) {
  const { ctx, page } = await open(DIR + file);
  const r = await page.evaluate(async () => {
    const { strings, t, langOf } = await import('/packages/core/strings.js');
    const { BY_LANG } = await import('/packages/core/strings.table.js');
    return [...document.querySelectorAll('[data-t]')].map(el => [el.textContent.trim(), t(strings(BY_LANG, langOf(el)), el.dataset.t)])
      .concat([[document.querySelector('nav').getAttribute('aria-label').split(',')[0], t(strings(BY_LANG, langOf(document.body)), 'language')]]);
  });
  check(`${tag}: the page's shared words are the strings table's (${r.map(x => x[1]).join(', ')})`, r.length === 4 && r.every(([a, b]) => a === b), JSON.stringify(r));
  await ctx.close();
}

// ── the head: hreflang for each page, x-default, and every address answers ──
async function headProblems(page) {
  return page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(l => ({ rel: 'alternate', hreflang: l.getAttribute('hreflang'), href: l.getAttribute('href') }));
    const statuses = await Promise.all(links.map(l => fetch(l.href, { method: 'HEAD' }).then(r => r.status).catch(() => 0)));
    return { links, bad: statuses.filter(s => s !== 200).length };
  });
}
for (const [tag, file] of Object.entries(PAGES)) {
  const { ctx, page } = await open(DIR + file);
  const h = await headProblems(page);
  const want = hreflangLinks(TAGS.map(l => ({ lang: l, href: DIR + PAGES[l] })), { xDefault: 'en-IN' });
  check(`${tag}: the head carries the helper's hreflang links (3 languages and x-default), and every address answers`, JSON.stringify(h.links) === JSON.stringify(want) && h.bad === 0, JSON.stringify(h));
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('lang-nohead', `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>t</title><link rel="alternate" hreflang="gom-Deva" href="${DIR}demo.gom-Deva.html"></head><body></body></html>`);
  const h = await headProblems(page);
  check('control: a head with one alternate and no x-default does not match', JSON.stringify(h.links) !== JSON.stringify(hreflangLinks(TAGS.map(l => ({ lang: l, href: DIR + PAGES[l] })), { xDefault: 'en-IN' })));
  await ctx.close();
}

// ── remember: stores a click, never redirects, marks the link on another page ──
{
  const page_ = html => `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="${DIR}lang.css"><script type="module" src="${DIR}lang.js"></script></head>
    <body><sg-lang ${html}><nav><ul><li><a href="#e" hreflang="en-IN" aria-current="page">English</a></li><li><a href="#d" hreflang="gom-Deva">कोंकणी</a></li></ul></nav></sg-lang></body></html>`;
  const { ctx, page } = await openHtml('lang-remember', page_('remember'));
  await page.waitForFunction(() => customElements.get('sg-lang'));
  const before = await page.evaluate(() => ({ marked: document.querySelectorAll('[data-remembered]').length, mem: document.querySelector('sg-lang').remembered }));
  await page.click('a[hreflang="gom-Deva"]');
  const url = page.url();
  await page.reload();
  await page.waitForFunction(() => customElements.get('sg-lang'));
  const after = await page.evaluate(() => ({ marked: [...document.querySelectorAll('[data-remembered]')].map(a => a.getAttribute('hreflang')), mem: document.querySelector('sg-lang').remembered, current: document.querySelector('[aria-current]').getAttribute('hreflang'), note: document.querySelector('[data-remembered] .sg-lang-last')?.textContent.trim() ?? null, noteLang: document.querySelector('.sg-lang-last')?.lang ?? null, noteHidden: (() => { const n = document.querySelector('.sg-lang-last'); if (!n) return null; const r = n.getBoundingClientRect(); return r.width <= 1 && r.height <= 1; })() }));
  check('remember: nothing before a click; after one the other link is marked (and says "Last chosen" to a screen reader, visually hidden), the page was not redirected, the current one is still English',
    before.marked === 0 && before.mem === null && after.marked.join() === 'gom-Deva' && after.mem === 'gom-Deva' && after.current === 'en-IN' && after.note === ', Last chosen' && after.noteLang === 'en' && after.noteHidden === true && /#d$/.test(url), JSON.stringify({ before, after, url }));
  await ctx.close();
  {
    // on a Romi page "Last chosen" is in the Romi table
    const { ctx: c2, page: p2 } = await openHtml('lang-remember-latn', page_('remember').replace('<html lang="en-IN">', '<html lang="gom-Latn">').replace('aria-current="page">English', 'aria-current="page">English').replace('hreflang="en-IN" aria-current="page"', 'hreflang="gom-Latn" aria-current="page"').replace('hreflang="gom-Deva"', 'hreflang="en-IN"'));
    await p2.waitForFunction(() => customElements.get('sg-lang'));
    await p2.click('a[hreflang="en-IN"]');
    await p2.reload();
    await p2.waitForFunction(() => document.querySelector('.sg-lang-last'), null, { timeout: 15000 }).catch(() => {});
    const n = await p2.evaluate(() => { const e = document.querySelector('.sg-lang-last'); return e ? { text: e.textContent.trim(), lang: e.lang, page: document.documentElement.lang } : null; });
    check('on a gom-Latn page "Last chosen" is the Konkani and carries the page lang (it is not English any more, so not lang="en")', n && n.page === 'gom-Latn' && n.lang === 'gom-Latn' && n.text.includes('Fatlya khepek venchillem') && !/Last chosen/.test(n.text), JSON.stringify(n));
    await c2.close();
  }
  const off = await openHtml('lang-noremember', page_(''));
  await off.page.waitForFunction(() => customElements.get('sg-lang'));
  await off.page.evaluate(() => localStorage.setItem('sg-lang', 'gom-Deva'));
  await off.page.reload();
  await off.page.waitForFunction(() => customElements.get('sg-lang'));
  const n = await off.page.evaluate(() => ({ marked: document.querySelectorAll('[data-remembered]').length, mem: document.querySelector('sg-lang').remembered }));
  check('control: without the remember attribute a stored value is ignored (nothing marked)', n.marked === 0 && n.mem === null, JSON.stringify(n));
  await off.ctx.close();
}

// ── phone width and targets ──
for (const width of [390, 320]) {
  const { ctx, page } = await open(DIR + PAGES['gom-Deva'], { width });
  await settle(page);
  const r = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, small: [...document.querySelectorAll('sg-lang a')].map(a => Math.round(a.getBoundingClientRect().height)).filter(h => h < 44), clipped: [...document.querySelectorAll('sg-lang a')].filter(a => a.scrollWidth > a.clientWidth + 1).length }));
  check(`${width} px: no sideways scroll, every language link at least 44 px tall, no link text clipped`, r.w <= width && !r.small.length && r.clipped === 0, JSON.stringify(r));
  await ctx.close();
}

// ── forced colours: the current language is marked without colour, in each register's own skin ──
// Each skin is waited on by what it draws (the quiet skin draws nothing: dataset.skin is "quiet" from the start,
// which is why this once measured quiet three times). The current link must differ from its siblings by a
// property other than colour: an underline, a border of another width or style, a heavier weight, an outline, or the pencil line.
const markOf = (page, reg) => page.evaluate(r => {
  const sec = document.querySelector(`section[data-register="${r}"]`), cur = sec.querySelector('a[aria-current]');
  const props = a => { const c = getComputedStyle(a); return [c.textDecorationLine, c.borderTopWidth, c.borderTopStyle, c.fontWeight, c.outlineWidth].join(' '); };
  const others = [...sec.querySelectorAll('a:not([aria-current])')];
  return { skin: sec.querySelector('sg-lang').dataset.skin, cur: props(cur), others: others.map(props), pencil: !!cur.querySelector('.sg-lang-pencil'), tilt: others.every(a => a.style.getPropertyValue('--sg-lang-tilt')) };
}, reg);
const isMarked = m => m.pencil || m.others.every(o => o !== m.cur);
const skinReady = (page, reg) => page.waitForFunction(r => {
  const sec = document.querySelector(`section[data-register="${r}"]`), el = sec.querySelector('sg-lang');
  if (el.dataset.skin !== r) return false;
  if (r === 'warm') return !!sec.querySelector('.sg-lang-pencil');
  if (r === 'playful') return [...sec.querySelectorAll('a')].every(a => a.style.getPropertyValue('--sg-lang-tilt'));
  return true;
}, reg, { timeout: 15000 });
for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ forcedColors: 'active' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}${DIR}${PAGES['gom-Deva']}?register=${register}`, { timeout: 90000 });
  await page.waitForFunction(() => window.__ready);
  await skinReady(page, register);
  const m = await markOf(page, register);
  check(`${register}, forced colours (its own skin mounted): the current language differs from the others by more than colour`, m.skin === register && isMarked(m), JSON.stringify(m));
  if (register === 'playful') {
    // control: take the playful rule away and the same measurement must go red
    await page.addStyleTag({ content: '@media (forced-colors: active) { sg-lang[data-skin="playful"] a[aria-current] { border: 2px solid LinkText !important; text-decoration: none !important; outline: none !important; } }' });
    const c = await markOf(page, register);
    check('control: with the playful forced-colours mark removed, the measurement says the current tab is not marked', !isMarked(c), JSON.stringify(c));
  }
  await ctx.close();
}

await done();
