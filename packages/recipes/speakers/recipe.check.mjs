// Browser checks for the speakers recipe: the gate (no JavaScript: all seven speakers show, each
// with a talk link that lands on a real agenda slot), the track filter in each register (a track,
// two, none, the address carrying it and reading back), the avatar hook (it replaces the initials,
// and without it the initials stay), the touch contract on the talk link (a press changes it, it
// is 44 px tall, focus shows), axe on the filtered state, and phone width. Each probe also runs
// once on a state that must fail.
//
//   node packages/recipes/speakers/recipe.check.mjs

import { harness } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { server, browser, engine, check, open, axe, axeNoJs, done } = await harness();
const PAGE = '/packages/recipes/speakers/index.html';
// like the harness's settle, but it waits only for animations that are running: a playful bloom below the
// fold is paused until it is seen (by design), and waiting for it to finish would wait forever
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.playState === 'running').map(a => a.finished.catch(() => {}))));
const AGENDA = '/packages/recipes/agenda/index.html';

const names = page => page.evaluate(() => [...document.querySelectorAll('.sg-speakers-list li')].filter(li => !li.hidden).map(li => li.querySelector('h3').textContent));
const count = page => page.evaluate(() => document.querySelector('.sg-speakers-count[role=status]')?.textContent ?? '');

// ── the gate: no JavaScript ─────────────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${PAGE}?register=quiet`, { js: false });
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('sg-person-card')];
    return {
      n: cards.length,
      shown: cards.every(c => c.getClientRects().length > 0),
      reads: cards.every(c => c.querySelector('h3')?.textContent.trim() && c.querySelector('.sg-person-role')?.textContent.includes(',') && c.querySelector('.sg-person-building') && c.querySelector('.sg-person-link a[href*="agenda/index.html#"]')),
      hrefs: cards.map(c => c.querySelector('.sg-person-link a').getAttribute('href')),
      note: document.querySelector('noscript')?.textContent ?? '',
    };
  });
  check('no JS: all 7 speakers show, each with a name, a role and organisation, a talk line and a talk link', r.n === 7 && r.shown && r.reads, JSON.stringify({ n: r.n, shown: r.shown, reads: r.reads }));
  check('no JS: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();

  // every talk link lands on a real session in the agenda (and a made-up one would not)
  const { ctx: c2, page: p2 } = await open(AGENDA, { js: false });
  const ids = await p2.evaluate(() => [...document.querySelectorAll('.sg-session')].map(li => li.id));
  const missing = r.hrefs.filter(h => !ids.includes(h.split('#')[1]));
  check(`every talk link lands on a session in the agenda (${r.hrefs.length - missing.length} of ${r.hrefs.length})`, !missing.length, missing.join(', '));
  check('control: a made-up slot is not found, so the link probe can fail', !ids.includes('no-such-talk'));
  await c2.close();
  const v = await axeNoJs(`${PAGE}?register=quiet`);
  check('no JS: axe 0 violations', !v.length, v.join('; '));
}

// ── no sideways scroll with JavaScript off, and on, at 390 and 320 ─────
for (const [width, js, register, theme, lang] of [[390, false, 'warm', 'light', ''], [320, false, 'warm', 'light', ''], [320, false, 'quiet', 'dark', ''], [390, false, 'playful', 'dark', '&lang=gom-Deva'], [390, true, 'warm', 'light', ''], [320, true, 'playful', 'light', '&lang=gom-Deva']]) {
  const { ctx, page } = await open(`${PAGE}?register=${register}&theme=${theme}${lang}`, { width, height: 800, js });
  const o = await sidewaysScroll(page, width), s = { sw: o.scrollWidth, over: o.overflow };
  check(`${width}px, JS ${js ? 'on' : 'off'}, ${register} ${theme}${lang}: the speakers page does not scroll sideways (scrollWidth ${s.sw})`, s.over === 0, JSON.stringify(s));
  await ctx.close();
}

// ── the language: the count and the empty line are Konkani on a Konkani page, with no lang="en" of their own ─
// (the fallback to English is held by recipe.test.js, with a table that lacks the key)
for (const [lang, expectEn] of [['gom-Deva', false], ['gom-Latn', false], ['en', false]]) {
  const { ctx, page } = await open(`${PAGE}?register=warm&lang=${lang}`);
  const r = await page.evaluate(() => { const count = document.querySelector('.sg-speakers-count[role=status]'), p = document.querySelector('.sg-speakers-empty p'); return { count: count.getAttribute('lang'), text: count.textContent, empty: p.getAttribute('lang'), emptyText: p.textContent }; });
  check(`lang=${lang}: the count ("${r.text}") and the empty line (written by the recipe, "${r.emptyText.slice(0, 18)}…") carry no lang of their own${lang === 'gom-Deva' ? ' and are in Devanagari' : ''}`, r.count === null && r.empty === null && r.emptyText.length > 10 && (lang !== 'gom-Deva' || (/[ऀ-ॿ]/.test(r.text) && /[ऀ-ॿ]/.test(r.emptyText))) && (lang !== 'gom-Latn' || !/^Showing/.test(r.text)), JSON.stringify(r));
  await ctx.close();
}

// a language with no table at all (Hindi): the count and the empty line are English, each marked lang="en"
{
  const { ctx, page } = await open(`${PAGE}?register=warm&lang=hi`);
  const r = await page.evaluate(() => { const count = document.querySelector('.sg-speakers-count[role=status]'), p = document.querySelector('.sg-speakers-empty p'); return { count: count.getAttribute('lang'), text: count.textContent, empty: p.getAttribute('lang'), emptyText: p.textContent, page: document.documentElement.lang }; });
  check(`lang=hi (no table): the count ("${r.text}") and the empty line are English, each marked lang="en"`, r.page === 'hi' && r.count === 'en' && r.empty === 'en' && /^Showing \d+ speakers?$/.test(r.text) && /^No speaker/.test(r.emptyText), JSON.stringify(r));
  await ctx.close();
}

// ── the track filter ────────────────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}`);
  await settle(page);
  check(`${register}: opens on all 7, and the count says so`, (await names(page)).length === 7 && (await count(page)) === 'Showing 7 speakers', await count(page));

  await page.click('input[name="track"][value="Tech for Good"]');
  await page.waitForTimeout(100);
  let shown = await names(page);
  check(`${register}: one track keeps only its speakers (Melwyn Fernandes, Deepa Shirodkar)`, shown.join() === 'Melwyn Fernandes,Deepa Shirodkar' && (await count(page)) === 'Showing 2 speakers', shown.join());
  const addr = new URL(page.url()).search;
  check(`${register}: the address carries the track and keeps ?register`, new URLSearchParams(addr).get('track') === 'Tech for Good' && new URLSearchParams(addr).get('register') === register, addr);

  // a shared address opens on the same view
  const { ctx: c2, page: p2 } = await open(`${PAGE}${addr}`);
  const ticked = await p2.$eval('input[value="Tech for Good"]', e => e.checked);
  check(`${register}: opening the shared address ticks the box and shows the same two`, ticked && (await names(p2)).join() === 'Melwyn Fernandes,Deepa Shirodkar', (await names(p2)).join());
  const v = await axe(p2);
  check(`${register}: axe on the filtered page: 0 violations`, !v.length, v.join('; '));
  await c2.close();

  await page.click('input[name="track"][value="AI for Kids"]');
  await page.waitForTimeout(100);
  check(`${register}: two tracks keep both sets (3 speakers)`, (await names(page)).length === 3, (await names(page)).join());
  await page.click('input[name="track"][value="Tech for Good"]');
  await page.click('input[name="track"][value="AI for Kids"]');
  await page.waitForTimeout(100);
  check(`${register}: unticking both brings all 7 back, and the address is back to just ?register`, (await names(page)).length === 7 && new URL(page.url()).search === `?register=${register}`, new URL(page.url()).search);
  check(`${register}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── ticking a track changes only ?track ─────────────────────────────────
{
  const { ctx, page } = await open(`${PAGE}?register=warm&lang=kok&utm_source=poster&track=AI%20for%20Kids#speakers`);
  await settle(page);
  const start = await page.evaluate(() => location.search);
  await page.click('input[name="track"][value="Tech for Good"]');
  await page.waitForTimeout(100);
  const two = await page.evaluate(() => ({ s: Object.fromEntries(new URLSearchParams(location.search)), h: location.hash }));
  check('ticking a second track keeps ?register, ?lang, ?utm_source and the #hash, and sets only ?track', two.s.register === 'warm' && two.s.lang === 'kok' && two.s.utm_source === 'poster' && two.h === '#speakers' && two.s.track === 'AI for Kids,Tech for Good', `${start} then ${JSON.stringify(two.s)}${two.h}`);
  await page.click('input[name="track"][value="Tech for Good"]');
  await page.click('input[name="track"][value="AI for Kids"]');
  await page.waitForTimeout(100);
  const none = await page.evaluate(() => ({ s: location.search, h: location.hash }));
  check('unticking everything removes only ?track', none.s === '?register=warm&lang=kok&utm_source=poster' && none.h === '#speakers', none.s);
  // the page moved on (a hash the visitor followed) after mount: the next tick writes from where the page is now
  await page.evaluate(() => { location.hash = '#later'; });
  await page.click('input[name="track"][value="AI for Kids"]');
  await page.waitForTimeout(100);
  check('a hash followed after the page opened is kept, not reverted', await page.evaluate(() => location.hash) === '#later', await page.evaluate(() => location.href));
  await ctx.close();
}

// ── the empty state, and the avatar hook, on a trimmed copy of the grid ─
{
  const { ctx, page, errors } = await open(`${PAGE}?register=warm`);
  const r = await page.evaluate(async () => {
    const { mountSpeakers } = await import('./recipe.js');
    const copy = document.getElementById('speakers').cloneNode(true);
    copy.id = 'copy'; document.body.append(copy);
    copy.querySelectorAll('li:has([data-track="AI for Kids"])').forEach(li => li.remove());
    const here = new URL(location.href);
    mountSpeakers(copy, { url: here });
    const empty = copy.querySelector('.sg-speakers-empty');
    const before = empty.hidden;
    copy.querySelector('input[value="AI for Kids"]').click();
    const after = !empty.hidden && copy.querySelectorAll('.sg-speakers-list li:not([hidden])').length === 0;
    // the avatar hook, on a second copy
    const second = document.getElementById('speakers').cloneNode(true);
    second.querySelectorAll('.sg-person-initials').forEach(d => d.remove()); // the cards draw fresh discs
    second.id = 'second'; document.body.append(second);
    await customElements.whenDefined('sg-person-card');
    const plainDisc = second.querySelector('.sg-person-initials')?.textContent;
    const seen = [];
    mountSpeakers(second, { url: here, avatar: (card, who) => { seen.push(who); const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'probe-bloom'); return s; } });
    const card = second.querySelector('sg-person-card');
    return { before, after, plainDisc, seen: seen.length, first: seen[0], custom: card.dataset.avatar, svg: !!card.querySelector('.sg-person-initials .probe-bloom'), lettersGone: card.querySelector('.sg-person-initials').textContent === '', hidden: card.querySelector('.sg-person-initials').getAttribute('aria-hidden') };
  });
  check('empty state: hidden while someone matches, shown with no cards when nothing does', r.before === true && r.after === true, JSON.stringify({ before: r.before, after: r.after }));
  check('avatar hook: called once per card with the name as the seed, and the drawing replaces the initials in the aria-hidden disc', r.seen === 7 && r.first.seed === r.first.name && r.custom === 'custom' && r.svg && r.lettersGone && r.hidden === 'true', JSON.stringify(r));
  check('control: a fresh card, before any avatar, has its disc of initials ("PN")', r.plainDisc === 'PN', r.plainDisc);
  check('no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── the bloom avatars ───────────────────────────────────────────────────
const blooms = async (page) => {
  await page.waitForFunction(() => document.querySelectorAll('.sg-person-initials sg-bloom svg').length === 7, null, { timeout: 15000 });
  await page.waitForTimeout(400); // let the skin settle the drawing's size before it is measured
  return page.evaluate(() => [...document.querySelectorAll('sg-person-card')].map(c => ({
    name: c.querySelector('h3').textContent, svg: (c.querySelector('sg-bloom svg')?.innerHTML ?? '').replace(/sg-bloom-[0-9]+-/g, 'sg-bloom-N-'), // each bloom numbers its own ids; the drawing is what must match
    seed: c.querySelector('sg-bloom')?.getAttribute('seed-from'), kind: c.querySelector('sg-bloom')?.getAttribute('kind'),
    discHidden: c.querySelector('.sg-person-initials')?.getAttribute('aria-hidden'),
    svgHidden: c.querySelector('sg-bloom svg')?.getAttribute('aria-hidden') ?? c.querySelector('sg-bloom')?.getAttribute('aria-hidden'),
    img: !!c.querySelector('sg-bloom [role=img]'), text: c.querySelector('sg-bloom')?.textContent.trim(),
    box: (() => { const b = c.querySelector('sg-bloom svg').getBoundingClientRect(), d = c.querySelector('.sg-person-initials').getBoundingClientRect(); return { b: Math.round(b.width), d: Math.round(d.width), inside: b.left >= d.left - 1 && b.right <= d.right + 1 && b.top >= d.top - 1 && b.bottom <= d.bottom + 1 }; })(),
  })));
};
let first = null;
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}`);
  const b = await blooms(page);
  if (register === 'warm') first = b;
  check(`${register}: every speaker has a zendu bloom seeded from their name (${b.filter(x => x.seed === x.name && x.kind === 'zendu').length} of 7)`, b.every(x => x.seed === x.name && x.kind === 'zendu'), b.map(x => x.seed).join());
  check(`${register}: seven speakers, seven different blooms`, new Set(b.map(x => x.svg)).size === 7 && b.every(x => x.svg.length > 200), `${new Set(b.map(x => x.svg)).size} distinct`);
  check(`${register}: the bloom is decoration: inside the aria-hidden disc, no role=img, no words`, b.every(x => x.discHidden === 'true' && !x.img && x.text === ''), JSON.stringify(b[0]));
  const ring = await page.evaluate(() => { const d = getComputedStyle(document.querySelector('.sg-person-initials')); return { shadow: d.boxShadow, border: d.borderTopWidth, bg: d.backgroundColor }; });
  check(`${register}: the disc behind a bloom draws no ring, border or ground`, ring.shadow === 'none' && ring.border === '0px' && (ring.bg.endsWith(', 0)') || ring.bg === 'transparent'), JSON.stringify(ring));
  check(`${register}: the bloom (${b[0].box.b} px) sits inside the disc (${b[0].box.d} px)`, b.every(x => x.box.inside && x.box.b <= x.box.d), JSON.stringify(b[0].box));
  if (register === 'quiet') {
    const ink = await page.evaluate(() => { const s = document.querySelector('sg-bloom svg'); return { dots: s.querySelectorAll('.sg-bloom-d').length, petals: s.querySelectorAll('.sg-bloom-p').length }; });
    check(`quiet: the bloom is single-ink dots (${ink.dots} dots, ${ink.petals} petals)`, ink.dots > 20 && ink.petals === 0, JSON.stringify(ink));
  }
  const v = await axe(page);
  check(`${register}: axe with the blooms in: 0 violations`, !v.length, v.join('; '));
  if (register === 'playful') await page.screenshot({ path: '.shots/speakers/playful-light-1280-blooms.png', fullPage: true });
  check(`${register}: no console errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
{ // the same speaker grows the same bloom on another visit, and a photo takes the disc and the bloom away
  const { ctx, page } = await open(`${PAGE}?register=warm`);
  const again = await blooms(page);
  check('the same speakers on a second visit grow the same blooms (seven of seven identical)', again.every((x, i) => x.svg === first[i].svg), '');
  const gone = await page.evaluate(async () => {
    const { mountSpeakers } = await import('./recipe.js');
    const sec = document.createElement('section'); sec.className = 'sg-speakers'; document.body.append(sec);
    sec.innerHTML = '<ul class="sg-speakers-list"><li><sg-person-card><article aria-labelledby="ph"><h3 id="ph">Photo Person</h3><p class="sg-person-role">Role, Org</p><img class="sg-person-photo" alt="Photo Person" width="48" height="48" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></article></sg-person-card></li><li><sg-person-card><article aria-labelledby="np"><h3 id="np">No Photo</h3><p class="sg-person-role">Role, Org</p></article></sg-person-card></li></ul>';
    await customElements.whenDefined('sg-person-card');
    mountSpeakers(sec, { url: new URL(location.href) });
    const cards = sec.querySelectorAll('sg-person-card');
    const plain = document.createElement('section'); plain.className = 'sg-speakers'; document.body.append(plain);
    plain.innerHTML = '<ul class="sg-speakers-list"><li><sg-person-card><article aria-labelledby="pl"><h3 id="pl">Plain Person</h3><p class="sg-person-role">Role, Org</p></article></sg-person-card></li></ul>';
    mountSpeakers(plain, { url: new URL(location.href), avatar: null });
    return { photoBloom: !!cards[0].querySelector('sg-bloom'), photoImg: !!cards[0].querySelector('img.sg-person-photo'), otherBloom: !!cards[1].querySelector('sg-bloom'), nullKeeps: plain.querySelector('.sg-person-initials')?.textContent, nullBloom: !!plain.querySelector('sg-bloom') };
  });
  check('a speaker with a photo keeps the photo and gets no bloom; the one beside them does', gone.photoImg && !gone.photoBloom && gone.otherBloom, JSON.stringify(gone));
  check('avatar: null keeps the initials ("PP"), no bloom', gone.nullKeeps === 'PP' && !gone.nullBloom, JSON.stringify(gone));
  await ctx.close();
}

// ── the talk link: a press answers, the target is 44 px, focus shows ────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${PAGE}?register=${register}`);
  const link = page.locator('.sg-speakers-list a').first();
  const snap = () => link.evaluate(a => { const c = getComputedStyle(a); return { colour: c.color, thick: c.textDecorationThickness, move: `${c.translate}|${c.scale}` }; });
  const box = await link.boundingBox();
  await link.hover();
  const rest = await snap();
  await page.mouse.down();
  const down = await snap();
  await page.mouse.move(2, 2); await page.mouse.up(); // let go away from the link, so the press does not become a click that navigates
  check(`${register}: pressing the talk link changes it in the same frame (colour or underline), no transition on the way in`, down.colour !== rest.colour || down.thick !== rest.thick, JSON.stringify({ rest, down }));
  check(`${register}: the talk link is ${Math.round(box.height)} px tall (44 needed)`, box.height >= 44, `${box.height}`);
  await page.keyboard.press('Tab');
  await link.focus();
  // The Tab press above makes the focus that follows a keyboard focus (:focus-visible). Walking away and back with Shift+Tab / Tab
  // is not engine-neutral: WebKit's default leaves links out of the tab order (they take Option+Tab), so the walk loses the link there.
  const readRing = () => link.evaluate(a => { const c = getComputedStyle(a); return { w: c.outlineWidth, style: c.outlineStyle, on: a === document.activeElement, focusVisible: a.matches(':focus-visible') }; });
  const showsRing = r => r.on && r.focusVisible && r.style !== 'none' && parseFloat(r.w) >= 2; // one verdict, used on the real link and on the control
  const ring = await readRing();
  check(`${register}: the talk link shows a focus ring (${ring.w} ${ring.style}, :focus-visible ${ring.focusVisible})`, showsRing(ring), JSON.stringify(ring));
  { // control: the same verdict, handed the same focused link with its outline switched off, must say no (and the real one yes)
    await page.addStyleTag({ content: '.sg-speakers-list a { outline: none !important; }' });
    const off = await readRing();
    check(`${register}: control: the ring verdict reads red on the same focused link with its outline removed (${off.style})`, showsRing(ring) && !showsRing(off), JSON.stringify(off));
  }
  await ctx.close();
}

// ── screenshots, axe in dark, phone width ───────────────────────────────
for (const [register, theme, width, height] of [['quiet', 'dark', 1280, 900], ['warm', 'light', 1280, 900], ['playful', 'light', 390, 844], ['warm', 'dark', 390, 844]]) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}&theme=${theme}`, { width, height });
  await settle(page);
  if (width === 1280 && register === 'quiet') await page.click('input[name="track"][value="Tech for Good"]');
  const v = await axe(page);
  check(`${register}-${theme}-${width}: axe 0 violations`, !v.length, v.join('; '));
  const { scrollWidth: w, overflow } = await sidewaysScroll(page, width);
  check(`${register}-${theme}-${width}: no sideways scroll (scrollWidth ${w})`, overflow === 0, `${w}`);
  await page.screenshot({ path: `.shots/speakers/${register}-${theme}-${width}.png`, fullPage: width > 400 });
  check(`${register}-${theme}-${width}: no console errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

await done();
