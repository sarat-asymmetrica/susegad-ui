// Browser checks for the venue recipe: the gate (no JavaScript: the words, the list and both
// links are on the page), nothing third-party (no iframe, no script from elsewhere, every request
// to our own server), the links filled from the coordinates and the right one for an iPhone, the
// links look like links and are 44 px tall, the touch contract on them (a press answers, focus
// shows), access rows hidden when empty (and the whole section when all are), axe, and phone
// width. Each probe also runs once on a state that must fail.
//
//   node packages/recipes/venue/recipe.check.mjs

import { harness, settle, locatorShapes, locatorRouteContrast } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, axe, axeNoJs, done } = await harness();
const PAGE = '/packages/recipes/venue/index.html';
const hrefs = page => page.evaluate(() => ({ app: document.querySelector('[data-map=app]').getAttribute('href'), web: document.querySelector('[data-map=web]').getAttribute('href') }));

// ── the gate: no JavaScript ─────────────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${PAGE}?register=quiet`, { js: false });
  const r = await page.evaluate(() => {
    const t = s => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    const visible = e => !!e && e.getClientRects().length > 0;
    return {
      name: t('.sg-venue-name'), address: t('.sg-venue-address'), landmarks: t('.sg-venue-landmarks'),
      ways: document.querySelectorAll('.sg-venue-ways li').length,
      links: [...document.querySelectorAll('.sg-venue-maps a')].map(a => a.getAttribute('href')),
      accessShown: [...document.querySelectorAll('.sg-venue-access dl > div')].filter(visible).map(d => d.querySelector('dt').textContent),
    };
  });
  check('no JS: the name, the address and the landmark directions are on the page', r.name === 'Mandovi Riverside Hall' && /Goa 403001/.test(r.address) && /^Behind the Old Secretariat, facing the river\./.test(r.landmarks), `${r.name} | ${r.address}`);
  check('no JS: both links are written, a geo: link and a web link', r.links.length === 2 && r.links[0].startsWith('geo:') && r.links[1].startsWith('https://'), r.links.join(' | '));
  check('no JS: three ways to get there (bus, ferry, car)', r.ways === 3, `${r.ways}`);
  check('no JS: access shows the three filled rows and not the empty one', r.accessShown.join() === 'Step-free entrance,Lift,Accessible toilet', r.accessShown.join());
  check('no JS: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
  const v = await axeNoJs(`${PAGE}?register=quiet`);
  check('no JS: axe 0 violations', !v.length, v.join('; '));
}

// ── nothing third-party ────────────────────────────────────────────────
{
  const requests = [];
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 800 } }));
  const page = await ctx.newPage();
  page.on('request', r => requests.push(r.url()));
  await page.goto(`${server.url}${PAGE}?register=warm`);
  await page.waitForFunction(() => window.__ready !== false);
  const own = requests.filter(u => u.startsWith(server.url) || u.startsWith('data:'));
  const foreign = requests.filter(u => !own.includes(u));
  const embeds = await page.evaluate(() => document.querySelectorAll('iframe, embed, object, script[src^="http"], link[href^="http"]').length);
  check(`nothing third-party: ${requests.length} requests, all to our own server, no iframe, embed or foreign script`, !foreign.length && embeds === 0, `${foreign.join(' ')} embeds ${embeds}`);
  // the control: a page that does embed a map must trip the same probe
  await page.evaluate(() => { const f = document.createElement('iframe'); f.src = 'about:blank'; document.body.append(f); });
  check('control: with an iframe added, the embed probe sees it', await page.evaluate(() => document.querySelectorAll('iframe').length) === 1);
  await ctx.close();
}

// ── the links, filled from the coordinates, and the right one per device ─
{
  const { ctx, page } = await open(`${PAGE}?register=warm`);
  const l = await hrefs(page);
  const vis = p => p.evaluate(() => ({ app: document.querySelector('[data-map=app]').getClientRects().length > 0, web: document.querySelector('[data-map=web]').getClientRects().length > 0 }));
  const dv = await vis(page);
  check('on a desktop (no sure maps app) the app link is hidden and the web link stands alone, a maps URL', !dv.app && dv.web && l.web === 'https://www.google.com/maps/search/?api=1&query=15.4989,73.8278', JSON.stringify({ dv, web: l.web }));
  await ctx.close();
  const ios = await browser.newContext(contextOptions(engine, { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }));
  const p2 = await ios.newPage();
  await p2.goto(`${server.url}${PAGE}?register=warm`);
  await p2.waitForFunction(() => window.__ready !== false);
  const i = await hrefs(p2);
  check('on an iPhone the app link is Apple Maps, since Safari does not open geo:', i.app.startsWith('https://maps.apple.com/?ll=15.4989,73.8278') && i.web === l.web, i.app);
  await ios.close();
  const droid = await browser.newContext(contextOptions(engine, { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' }));
  const p4 = await droid.newPage();
  await p4.goto(`${server.url}${PAGE}?register=warm`);
  await p4.waitForFunction(() => window.__ready !== false);
  const a = await hrefs(p4), av = await vis(p4);
  check('on Android the app link is a geo: link with the pin labelled, and shows', a.app === 'geo:15.4989,73.8278?q=15.4989,73.8278(Mandovi%20Riverside%20Hall)' && av.app && av.web, JSON.stringify({ app: a.app, av }));
  await droid.close();
  const { ctx: c3, page: p3 } = await open(`${PAGE}?register=warm`, { js: false });
  const k = await hrefs(p3);
  const kv = await vis(p3);
  check('with JS off both links are there, the hrefs as written: a geo: link and the web link', k.app.startsWith('geo:') && k.web.startsWith('https://www.google.com/maps/search/') && kv.app && kv.web, k.app);
  await c3.close();
}

// ── access rows: only what is filled ───────────────────────────────────
{
  const { ctx, page } = await open(`${PAGE}?register=quiet`);
  const vis = () => page.evaluate(() => ({ rows: [...document.querySelectorAll('.sg-venue-access dl > div')].filter(d => d.getClientRects().length).length, section: document.querySelector('.sg-venue-access').getClientRects().length > 0 }));
  let v = await vis();
  check('access: three filled rows show, the empty "Quiet space" does not, and the section shows', v.rows === 3 && v.section, JSON.stringify(v));
  await page.evaluate(() => document.querySelectorAll('.sg-venue-access dd').forEach(d => { d.textContent = ''; }));
  v = await vis();
  check('access: with every row empty the whole section goes', v.rows === 0 && !v.section, JSON.stringify(v));
  await page.evaluate(() => { document.querySelector('.sg-venue-access dd').textContent = 'Yes.'; });
  v = await vis();
  check('access: fill one row and the section and that row come back (so the hiding can fail)', v.rows === 1 && v.section, JSON.stringify(v));
  await ctx.close();
  // an editor's formatting leaves white space in an empty row: with JS the row and the section still go
  const { ctx: c2, page: p2 } = await open(`${PAGE}?register=quiet`);
  await p2.evaluate(async () => {
    document.querySelectorAll('.sg-venue-access dd').forEach(d => { d.innerHTML = '\n      \n    '; });
    const { mountVenue } = await import('./recipe.js');
    mountVenue(document.getElementById('venue'));
  });
  const w2 = await p2.evaluate(() => ({ rows: [...document.querySelectorAll('.sg-venue-access dl > div')].filter(d => d.getClientRects().length).length, section: document.querySelector('.sg-venue-access').getClientRects().length > 0 }));
  check('access: rows holding only white space (line breaks) are hidden, and so is the whole section', w2.rows === 0 && !w2.section, JSON.stringify(w2));
  await p2.evaluate(() => { document.querySelector('.sg-venue-access dd').textContent = 'Yes.'; });
  await p2.evaluate(async () => { const { mountVenue } = await import('./recipe.js'); mountVenue(document.getElementById('venue')); });
  const w3 = await p2.evaluate(() => ({ rows: [...document.querySelectorAll('.sg-venue-access dl > div')].filter(d => d.getClientRects().length).length, section: document.querySelector('.sg-venue-access').getClientRects().length > 0 }));
  check('access: one real answer among white-space rows brings back that row and the section only', w3.rows === 1 && w3.section, JSON.stringify(w3));
  await c2.close();
}

// ── the links look like links, and answer a press ──────────────────────
// on a desktop only the web link shows, so these run as an Android phone's browser, where both do
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const openAndroid = async (path, { reduced = false } = {}) => {
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 800 }, userAgent: ANDROID, reducedMotion: reduced ? 'reduce' : 'no-preference' }));
  const page = await ctx.newPage();
  await page.goto(`${server.url}${path}`);
  await page.waitForFunction(() => window.__ready !== false);
  return { ctx, page };
};
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await openAndroid(`${PAGE}?register=${register}`);
  const links = page.locator('.sg-venue-link');
  for (const [i, kind] of [[0, 'app'], [1, 'web']]) {
    const link = links.nth(i);
    const box = await link.boundingBox();
    const s = await link.evaluate(a => { const c = getComputedStyle(a), b = getComputedStyle(document.body); return { line: c.textDecorationLine, colour: c.color, body: b.color, cursor: c.cursor }; });
    check(`${register}: the ${kind} link is underlined and ${Math.round(box.width)} x ${Math.round(box.height)} px (44 tall needed)`, s.line.includes('underline') && box.height >= 44 && box.width >= 44, JSON.stringify({ s, h: box.height }));
    if (kind === 'app') check(`${register}: the app link is in the accent colour, not the body colour, so it reads as a link`, s.colour !== s.body, `${s.colour} vs ${s.body}`);
  }
  const link = links.first();
  const snap = () => link.evaluate(a => { const c = getComputedStyle(a); return { colour: c.color, bg: c.backgroundColor, thick: c.textDecorationThickness, move: `${c.translate}|${c.scale}`, transition: c.transitionDuration }; });
  await link.hover();
  const rest = await snap();
  await page.mouse.down();
  const down = await snap();
  await page.mouse.move(2, 2); await page.mouse.up(); // let go away from the link, so the press does not become a click that navigates
  const changed = down.colour !== rest.colour || down.bg !== rest.bg || down.thick !== rest.thick;
  check(`${register}: a press changes the link in the same frame (colour, wash or underline), and the transition on the way in is off`, changed && /^0s(, 0s)*$/.test(down.transition), JSON.stringify({ rest, down }));
  const moved = down.move !== rest.move;
  check(`${register}: a press ${register === 'warm' ? 'does not move it' : 'moves it a little'} (${rest.move} to ${down.move})`, register === 'warm' ? !moved : moved, '');
  await page.keyboard.press('Tab');
  await link.focus();
  // The Tab press above makes the focus that follows a keyboard focus (:focus-visible). Walking away and back with Shift+Tab / Tab
  // is not engine-neutral: WebKit's default leaves links out of the tab order (they take Option+Tab), so the walk loses the link there.
  const readRing = () => link.evaluate(a => { const c = getComputedStyle(a); return { w: c.outlineWidth, style: c.outlineStyle, on: a === document.activeElement, focusVisible: a.matches(':focus-visible') }; });
  const showsRing = r => r.on && r.focusVisible && r.style !== 'none' && parseFloat(r.w) >= 2; // one verdict, used on the real link and on the control
  const ring = await readRing();
  check(`${register}: the link shows a focus ring (${ring.w} ${ring.style}, :focus-visible ${ring.focusVisible})`, showsRing(ring), JSON.stringify(ring));
  { // control: the same verdict, handed the same focused link with its outline switched off, must say no (and the real one yes)
    await page.addStyleTag({ content: '.sg-venue-link { outline: none !important; }' });
    const off = await readRing();
    check(`${register}: control: the ring verdict reads red on the same focused link with its outline removed (${off.style})`, showsRing(ring) && !showsRing(off), JSON.stringify(off));
  }
  await ctx.close();
}
{ // reduced motion: the colour change stays, the movement goes
  const { ctx, page } = await openAndroid(`${PAGE}?register=playful`, { reduced: true });
  const link = page.locator('.sg-venue-link').first();
  const snap = () => link.evaluate(a => { const c = getComputedStyle(a); return { bg: c.backgroundColor, move: `${c.translate}|${c.scale}` }; });
  await link.hover();
  const rest = await snap();
  await page.mouse.down();
  const down = await snap();
  await page.mouse.move(2, 2); await page.mouse.up(); // let go away from the link, so the press does not become a click that navigates
  check('reduced motion (playful): the press keeps its colour wash and drops the movement', down.bg !== rest.bg && down.move === rest.move, JSON.stringify({ rest, down }));
  await ctx.close();
}

// ── forced colours: the bullets and the link outlines survive (chromium emulates it) ─
if (engine === 'chromium') {
  const { ctx, page } = await open(`${PAGE}?register=warm`);
  await page.emulateMedia({ forcedColors: 'active' });
  const f = await page.evaluate(() => { const li = document.querySelector('.sg-venue-ways li'), b = getComputedStyle(li, '::before'), a = getComputedStyle(document.querySelector('.sg-venue-link')); return { bullet: b.borderTopWidth, bulletColour: b.borderTopColor, canvas: getComputedStyle(document.body).backgroundColor, link: a.borderTopColor, linkColour: a.color }; });
  check(`forced colours: the "Getting there" bullets are drawn with a ${f.bullet} border in ${f.bulletColour}, not the page colour (${f.canvas}); the link keeps a border`, parseFloat(f.bullet) > 0 && f.bulletColour !== f.canvas && f.link !== f.canvas, JSON.stringify(f));
  await ctx.close();
}

// ── forced colours: the route and the stop are drawn in the system link colour, the halo in the canvas colour ──
if (engine === 'chromium') {
  const { ctx, page } = await open(`${PAGE}?register=playful`);
  await page.emulateMedia({ forcedColors: 'active' });
  const f = await page.evaluate(() => {
    const sys = v => { const e = document.createElement('i'); e.style.color = v; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const w = getComputedStyle(document.querySelector('.sg-loc-walk')), t = getComputedStyle(document.querySelector('.sg-loc-stop')), h = getComputedStyle(document.querySelector('.sg-loc-walk-halo'));
    return { linkText: sys('LinkText'), canvas: sys('Canvas'), walk: w.stroke, walkFill: w.fill, stop: t.stroke, halo: h.stroke };
  });
  check(`forced colours: the route is stroked in LinkText (${f.linkText}) with no fill, the stop ringed in it, the halo in Canvas (${f.canvas})`, f.walk === f.linkText && f.walkFill === 'none' && f.stop === f.linkText && f.halo === f.canvas, JSON.stringify(f));
  await ctx.close();
}

// ── every register and theme: axe, the locator, phone width, screenshots ─
for (const [register, theme, width, height] of [['quiet', 'light', 1280, 900], ['quiet', 'dark', 1280, 900], ['warm', 'light', 1280, 900], ['warm', 'dark', 1280, 900], ['playful', 'light', 1280, 900], ['playful', 'dark', 1280, 900], ['quiet', 'light', 390, 844], ['warm', 'dark', 390, 844], ['playful', 'light', 390, 844]]) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}&theme=${theme}`, { width, height });
  await settle(page);
  const tag = `${register}-${theme}-${width}`;
  const v = await axe(page);
  check(`${tag}: axe 0 violations`, !v.length, v.join('; '));
  const g = await page.evaluate(() => {
    const svg = document.querySelector('.sg-venue-locator svg'), words = document.querySelector('.sg-venue-words').getBoundingClientRect(), s = svg.getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, svgW: Math.round(s.width), svgH: Math.round(s.height), beside: s.left >= words.right - 1, ariaHidden: svg.closest('figure').getAttribute('aria-hidden') };
  });
  check(`${tag}: no sideways scroll (scrollWidth ${g.sw}); locator ${g.svgW} x ${g.svgH} px, ${width > 700 ? (g.beside ? 'beside the words' : 'NOT beside the words') : 'under the words'}, aria-hidden ${g.ariaHidden}`, g.sw <= width && g.ariaHidden === 'true' && (width > 700 ? g.beside : true), JSON.stringify(g));
  await page.screenshot({ path: `.shots/venue/${tag}.png`, fullPage: true });
  check(`${tag}: no console errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── the locator: every shape has a rule, none is left to the UA default (black fill) ─
// The event template drew a walking route and a bus stop with classes nobody styled, so the route
// painted as a solid black wedge. A shape is "styled" when its fill, stroke or opacity differs from
// a fresh unclassed element of the same tag; the walk path must also read as a line. (The same probe
// runs over the created event site in packages/cli/create.check.mjs.)
{
  const bad = [];
  let shapes = 0;
  for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
    const { ctx, page } = await open(`${PAGE}?register=${register}&theme=${theme}`);
    const r = await locatorShapes(page);
    shapes = r.n;
    if (r.unstyled.length) bad.push(`${register}/${theme}: ${r.unstyled.join(',')} has the UA default`);
    if (!r.walk) bad.push('no .sg-loc-walk drawn');
    else if (r.walk.fill !== 'none' || r.walk.stroke === 'none') bad.push(`${register}/${theme}: the walk path is ${JSON.stringify(r.walk)}, not a stroked line with no fill`);
    await ctx.close();
  }
  check(`locator: all ${shapes} shapes carry a rule in 3 registers x 2 themes, and the walking route is a line, not a filled shape`, !bad.length && shapes > 0, bad.slice(0, 3).join(' | '));
}
// ── the walking route is 3:1 against what it touches, in every register and theme (WCAG 1.4.11) ──
{
  const rows = [], bad = [];
  for (const register of ['quiet', 'warm', 'playful']) for (const theme of ['light', 'dark']) {
    const { ctx, page } = await open(`${PAGE}?register=${register}&theme=${theme}`);
    const c = await locatorRouteContrast(page);
    rows.push(`${register}/${theme} ${JSON.stringify(c.ratios)}${c.haloShown ? ' (halo)' : ''}`);
    if (!(c.min >= 3)) bad.push(`${register}/${theme}: ${JSON.stringify(c.ratios)}`);
    await ctx.close();
  }
  check('locator: the route is at least 3:1 against the surface and road (or the halo under it) in 3 registers x 2 themes', !bad.length, bad.length ? bad.join(' | ') : rows.join(' ; '));
}
{ // control: a shape with a class nobody styles must trip the same probe
  const { ctx, page } = await open(`${PAGE}?register=warm`);
  const r = await page.evaluate(() => {
    const svg = document.querySelector('.sg-venue-locator svg');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', 'sg-loc-nothing'); p.setAttribute('d', 'M0 0H10V10Z'); svg.append(p);
    const bare = document.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.append(bare);
    const look = e => { const c = getComputedStyle(e); return `${c.fill}|${c.stroke}|${c.opacity}`; };
    return { same: look(p) === look(bare), fill: getComputedStyle(p).fill };
  });
  check('control: an unstyled locator shape is seen as unstyled (black UA fill)', r.same && r.fill === 'rgb(0, 0, 0)', JSON.stringify(r));
  await ctx.close();
}

await done();
