// Browser checks for the agenda recipe: the gate (no JavaScript: every session and its IST time
// is on the page), then "now on stage" in each register against a pretended Panjim clock
// (?now=), the moments around it (before the day, between sessions, after the last one, a
// session across midnight, a machine in New York), the calm timer (a fake clock, one wake a
// minute, no animation frames, no live region, focus and nodes left alone), axe on the open
// states, and phone width. Each probe also runs once on a state that must fail.
//
//   node packages/recipes/agenda/recipe.check.mjs            (chromium)
//   SG_ENGINE=webkit node packages/recipes/agenda/recipe.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { server, browser, engine, check, open, axe, axeNoJs, done } = await harness();
const PAGE = '/packages/recipes/agenda/index.html';
const ON = '2026-11-14T10:40'; // two parallel sessions are on, the 11:45 talk is next (tea in between is a break, never "Next")

const read = page => page.evaluate(() => {
  const root = document.getElementById('agenda');
  const row = id => {
    const li = document.getElementById(id), st = li.querySelector('.sg-session-state');
    return { phase: li.dataset.phase ?? '', state: st && !st.hidden ? st.textContent : '', stateVisible: !!st && !st.hidden && getComputedStyle(st).clipPath === 'none', current: li.getAttribute('aria-current') };
  };
  return {
    overall: root.dataset.state ?? '', status: root.querySelector('.sg-agenda-status')?.textContent ?? '',
    statusHidden: root.querySelector('.sg-agenda-status')?.hidden ?? true,
    ids: Object.fromEntries([...root.querySelectorAll('.sg-session')].map(li => [li.id, row(li.id)])),
  };
});

// ── the gate: no JavaScript ─────────────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${PAGE}?register=quiet`, { js: false });
  const r = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('.sg-session')];
    return {
      n: lis.length,
      allRead: lis.every(li => li.querySelector('.sg-session-title')?.textContent.trim() && li.querySelector('.sg-session-time time') && /IST/.test(li.querySelector('.sg-session-time').textContent) && li.querySelector('.sg-session-room')),
      noneHidden: lis.every(li => li.getClientRects().length > 0),
      noMarks: !document.querySelector('.sg-session-state, .sg-agenda-status, [data-phase]'),
      days: [...document.querySelectorAll('.sg-agenda-day > h3')].map(h => h.textContent),
      late: document.getElementById('evening-demos').querySelector('.sg-session-time').textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check('no JS: all 12 sessions show, each with title, room and a time labelled IST', r.n === 12 && r.allRead && r.noneHidden, JSON.stringify({ n: r.n, allRead: r.allRead }));
  check('no JS: two day headings, and no now/next marks (they need the clock)', r.days.length === 2 && r.noMarks, r.days.join(' | '));
  check('no JS: the session across midnight says so in words', r.late === '9 pm to 12:30 am IST, after midnight', r.late);
  check('no JS: no console or page errors', !errors.length, errors.join(' | '));
  // drift: the words people read must agree with the datetime the clock reads (one written, one for the eye)
  const { ctx: dctx, page: dpage } = await open(`${PAGE}?register=quiet`);
  const drift = await dpage.evaluate(async () => {
    const { parseWhen, clock } = await import('/packages/core/intl.core.js');
    return [...document.querySelectorAll('.sg-session-time time')].filter(t => clock(parseWhen(t.getAttribute('datetime'))) !== t.textContent.trim()).map(t => `${t.getAttribute('datetime')} says ${t.textContent.trim()}`);
  });
  check('every visible time agrees with its datetime (the clock reads the datetime, people read the words)', drift.length === 0, drift.join(' | '));
  const bent = await dpage.evaluate(async () => {
    const { parseWhen, clock } = await import('/packages/core/intl.core.js');
    const t = document.querySelector('.sg-session-time time'); t.textContent = '9:45 am'; // a team edits only the words
    return clock(parseWhen(t.getAttribute('datetime'))) !== t.textContent.trim();
  });
  check('control: edit only the words of one time and the drift probe sees it', bent);
  await dctx.close();
  await ctx.close();
  const v = await axeNoJs(`${PAGE}?register=quiet`);
  check('no JS: axe 0 violations', !v.length, v.join('; '));
}

// ── now on stage, in every register and both themes ────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await open(`${PAGE}?register=${register}&theme=${theme}&now=${ON}`);
    await settle(page);
    const r = await read(page);
    const tag = `${register}-${theme}`;
    check(`${tag}: both parallel sessions say "Now on stage, until 11:15 am" in words, and aria-current is time`,
      r.ids['storybook-reader'].state === 'Now on stage, until 11:15 am' && r.ids['voice-calendar'].state === 'Now on stage, until 11:15 am' && r.ids['storybook-reader'].current === 'time', JSON.stringify([r.ids['storybook-reader'], r.ids['voice-calendar'].state]));
    check(`${tag}: the 11:45 talk is "Next, at 11:45 am", and nothing else is marked next (not even the tea break)`, r.ids['village-hall'].state === 'Next, at 11:45 am' && r.ids.tea.state === '' && Object.entries(r.ids).filter(([, v]) => v.state.startsWith('Next')).length === 1, r.ids['village-hall'].state + ' / tea "' + r.ids.tea.state + '"');
    check(`${tag}: the morning is finished (read, not shown) and the afternoon says nothing yet`, r.ids.welcome.state === 'Finished' && !r.ids.welcome.stateVisible && r.ids['medicine-cards'].state === '' && r.ids.welcome.phase === 'past', JSON.stringify(r.ids.welcome));
    check(`${tag}: the status line says it once, as plain text`, r.status === '2 sessions are on stage now. Next, at 11:45 am.' && !r.statusHidden, r.status);

    if (theme === 'light') {
      // where the marker is: the state words sit above the title, inside the session that is on, and the bar is on its edge
      const g = await page.evaluate(() => {
        const li = document.getElementById('storybook-reader'), st = li.querySelector('.sg-session-state'), title = li.querySelector('.sg-session-title');
        const b = li.getBoundingClientRect(), s = st.getBoundingClientRect(), t = title.getBoundingClientRect();
        const cs = getComputedStyle(li);
        return { stateAboveTitle: Math.round(t.top - s.bottom), stateInside: s.top >= b.top && s.bottom <= b.bottom, bar: cs.borderInlineStartWidth, barColour: cs.borderInlineStartColor, stateH: Math.round(s.height) };
      });
      check(`${tag}: the state words are inside the session, above its title (${g.stateAboveTitle}px), and a ${g.bar} bar marks its edge`, g.stateInside && g.stateAboveTitle >= 0 && g.bar === '4px', JSON.stringify(g));
      // past sessions are quieter by colour, not by fading: still full opacity
      const q = await page.evaluate(() => { const p = getComputedStyle(document.getElementById('welcome').querySelector('.sg-session-title')), n = getComputedStyle(document.getElementById('storybook-reader').querySelector('.sg-session-title')); return { pastColour: p.color, nowColour: n.color, opacity: getComputedStyle(document.getElementById('welcome')).opacity }; });
      check(`${tag}: a finished session is quieter (softer colour) but not faded (opacity ${q.opacity})`, q.pastColour !== q.nowColour && q.opacity === '1', JSON.stringify(q));
    }
    if (register === 'quiet' && theme === 'light') {
      const f = await page.evaluate(() => { const s = document.querySelector('#storybook-reader .sg-session-state'), w = document.querySelector('#storybook-reader .sg-session-where'); return { state: parseFloat(getComputedStyle(s).fontSize), where: parseFloat(getComputedStyle(w).fontSize), body: parseFloat(getComputedStyle(document.body).fontSize), caps: getComputedStyle(s).fontVariantCaps }; });
      check(`quiet: the state words are ${f.state}px, plain (${f.caps}): the body size (${f.body}px) and larger than the room line (${f.where}px)`, f.state >= f.body && f.state > f.where && f.caps === 'normal', JSON.stringify(f));
    }
    const live = await page.evaluate(() => document.querySelectorAll('#agenda [aria-live], #agenda [role=status], #agenda [role=alert]').length);
    check(`${tag}: nothing in the agenda is a live region`, live === 0, `${live}`);
    const v = await axe(page);
    check(`${tag}: axe on the on-stage state: 0 violations`, !v.length, v.join('; '));
    if (register !== 'quiet' || theme === 'light') await page.screenshot({ path: `.shots/agenda/${tag}-desktop.png`, fullPage: true });
    check(`${tag}: no console or page errors`, !errors.length, errors.join(' | '));
    await ctx.close();
  }
}

// ── the language: a page in Konkani speaks Konkani, and carries no lang="en" on its own words ─
// (the fallback itself is held by recipe.test.js with a table that lacks the key)
for (const [lang, expectEn] of [['gom-Deva', false], ['gom-Latn', false], ['en', false]]) {
  const { ctx, page } = await open(`${PAGE}?register=warm&lang=${lang}&now=${ON}`);
  const attrs = await page.evaluate(() => ['.sg-agenda-status', '#storybook-reader .sg-session-state', '#welcome .sg-session-state', '#village-hall .sg-session-state'].map(s => ({ lang: document.querySelector(s).getAttribute('lang'), text: document.querySelector(s).textContent })));
  check(`lang=${lang}: the status, "now", "next" and "finished" texts carry no lang of their own (${lang === 'en' ? 'the page is English' : 'Konkani, the page language'})`, attrs.every(a => (expectEn ? a.lang === 'en' : a.lang === null) && a.text.length > 0 && (lang === 'gom-Deva' ? /[ऀ-ॿ]/.test(a.text) : lang === 'gom-Latn' ? !/^(Now|On now|Next|Finished)/.test(a.text) : true)), JSON.stringify(attrs.map(a => a.lang)));
  await ctx.close();
}

// a language with no table at all (Hindi): the agenda falls back to English, and says so with lang="en" on each of its own words
{
  const { ctx, page } = await open(`${PAGE}?register=warm&lang=hi&now=${ON}`);
  const got = await page.evaluate(() => ['.sg-agenda-status', '#storybook-reader .sg-session-state', '#welcome .sg-session-state', '#village-hall .sg-session-state'].map(s => ({ lang: document.querySelector(s).getAttribute('lang'), text: document.querySelector(s).textContent, page: document.documentElement.lang })));
  check('lang=hi (no table): the status, "now", "finished" and "next" texts are the English words, each marked lang="en"', got.every(a => a.page === 'hi' && a.lang === 'en') && /^Now on stage, until/.test(got[1].text) && got[2].text === 'Finished' && /^Next, /.test(got[3].text) && /sessions are on stage now/.test(got[0].text), JSON.stringify(got.map(a => [a.lang, a.text.slice(0, 24)])));
  await ctx.close();
}

// ── forced colours: the filled dot for "now" stays filled (chromium emulates it) ─
for (const register of engine === 'chromium' ? ['quiet', 'warm', 'playful'] : []) {
  const { ctx, page } = await open(`${PAGE}?register=${register}&now=${ON}`);
  await page.emulateMedia({ forcedColors: 'active' });
  const d = await page.evaluate(() => { const g = id => { const c = getComputedStyle(document.querySelector(`#${id} .sg-session-state`), '::before'); return { bg: c.backgroundColor, border: c.borderTopColor }; }; return { now: g('storybook-reader'), next: g('village-hall'), canvas: getComputedStyle(document.body).backgroundColor }; });
  const clear = s => s.startsWith('rgba(') && s.endsWith(', 0)'); // a fully transparent colour
  check(`forced colours (${register}): the "now" dot is filled solid in its own ink (fill = border, not the page colour) and the "next" dot stays a ring (no fill)`, d.now.bg === d.now.border && d.now.bg !== d.canvas && clear(d.next.bg), JSON.stringify(d));
  await ctx.close();
}

// ── landing from a speaker's link ──────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${PAGE}?register=${register}&now=${ON}#voice-calendar`);
  await settle(page);
  const t = await page.evaluate(() => { const li = document.getElementById('voice-calendar'), c = getComputedStyle(li); return { top: Math.round(li.getBoundingClientRect().top), margin: c.scrollMarginTop, outline: c.outlineStyle, width: c.outlineWidth, match: li.matches(':target') }; });
  check(`${register}: the session a link lands on is marked with a ${t.width} ${t.outline} outline (not colour alone) and keeps ${t.margin} above it`, t.match && t.outline !== 'none' && parseFloat(t.width) >= 2 && parseFloat(t.margin) > 0, JSON.stringify(t));
  const other = await page.evaluate(() => getComputedStyle(document.getElementById('storybook-reader')).outlineStyle);
  check(`${register}: and only that session (control: its neighbour has no outline, ${other})`, other === 'none', other);
  await ctx.close();
}

// ── the other moments ──────────────────────────────────────────────────
const moments = [
  ['before the day', '2026-11-01T12:00', r => r.overall === 'before' && r.status === 'The agenda starts Sat 14 Nov, at 9:30 am IST.' && Object.values(r.ids).every(x => x.state === '')],
  ['the evening before', '2026-11-13T20:00', r => r.ids.welcome.state === 'Next, tomorrow at 9:30 am'],
  ['between sessions, at lunch', '2026-11-14T13:00', r => r.overall === 'between' && r.status === 'Between sessions. Next, at 2 pm.' && r.ids.lunch.state === 'On now, until 2 pm' && r.ids['medicine-cards'].state === 'Next, at 2 pm' && r.ids['bakery-pricing'].state === 'Next, at 2 pm'],
  ['after the last session', '2026-11-16T09:00', r => r.overall === 'after' && r.status === 'That was the last session.' && Object.values(r.ids).every(x => x.phase === 'past')],
  ['across midnight', '2026-11-15T00:10', r => r.ids['evening-demos'].state === 'Now on stage, until 12:30 am' && r.ids['moving-to-goa'].state === 'Next, at 10 am' && r.ids.closing.state === ''],
];
for (const [name, now, ok] of moments) {
  const { ctx, page } = await open(`${PAGE}?register=warm&now=${now}`);
  const r = await read(page);
  check(`${name} (${now} IST): the marks and the status line are right`, ok(r), `${r.overall}: ${r.status}`);
  const v = await axe(page);
  check(`${name}: axe 0 violations`, !v.length, v.join('; '));
  await ctx.close();
}
{ // the control: before the day nothing may say it is on stage, so the "on stage" probes above can fail
  const { ctx, page } = await open(`${PAGE}?register=warm&now=2026-11-01T12:00`);
  const n = await page.evaluate(() => document.querySelectorAll('[data-phase="now"], [aria-current]').length);
  check('control: before the day nothing is on stage and nothing is aria-current', n === 0, `${n}`);
  await ctx.close();
}

// ── a machine in New York sees Panjim's clock ──────────────────────────
{
  // 2026-11-14 01:10 UTC: 8:10 pm on the 13th in New York, 6:40 am on the 14th in Panjim. Real clock, faked.
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 800 }, timezoneId: 'America/New_York' }));
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T01:10:00Z') });
  await page.goto(`${server.url}${PAGE}?register=warm`);
  await page.waitForFunction(() => window.__ready !== false);
  const r = await read(page);
  const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  check(`New York machine (${zone}): the first session is "Next, at 9:30 am", Panjim's own clock`, zone === 'America/New_York' && r.ids.welcome.state === 'Next, at 9:30 am' && r.ids.welcome.phase === 'upcoming', `${zone}: ${r.ids.welcome.state}`);
  await ctx.close();
}

// ── the calm timer: a fake clock, a minute at a time ────────────────────
{
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width: 1000, height: 800 } }));
  const page = await ctx.newPage();
  // 10:14:30 IST on the 14th: 15 seconds before the 10:15 end of the welcome, 15 minutes before the 10:30 pair
  await page.clock.install({ time: new Date('2026-11-14T04:44:30Z') });
  // count what the page asks the browser to wake it for, before any script runs (after the fake clock, whose timers these wrap)
  await page.addInitScript(() => {
    window.__timers = []; window.__raf = 0;
    // only calls that come from the agenda's own module count; the browser and the fake clock make their own
    const mine = () => /agenda\/recipe\.js/.test(new Error().stack ?? '');
    const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => { if (mine()) window.__timers.push(ms); return st(fn, ms, ...a); };
    const si = window.setInterval; window.setInterval = (fn, ms, ...a) => { if (mine()) window.__timers.push(ms); return si(fn, ms, ...a); };
    const raf = window.requestAnimationFrame; window.requestAnimationFrame = fn => { if (mine()) window.__raf++; return raf(fn); };
  });
  await page.goto(`${server.url}${PAGE}?register=warm`);
  await page.waitForFunction(() => window.__ready !== false);
  // something to stand focus on, and a mark on the nodes, to see that nothing is replaced
  await page.evaluate(() => {
    const b = document.createElement('button'); b.id = 'probe'; b.textContent = 'probe'; document.getElementById('agenda').before(b); b.focus();
    document.querySelectorAll('.sg-session, .sg-session-state, .sg-agenda-status').forEach(n => { n.__mark = true; });
    window.__timers.length = 0; window.__raf = 0;
  });
  let r = await read(page);
  check('timer: at 10:14:30 the welcome is still on stage', r.ids.welcome.state.startsWith('Now on stage, until 10:15 am') && r.status.startsWith('One session is on stage now.'), r.status);
  await page.clock.runFor(30 * 1000); // 10:15:00
  r = await read(page);
  check('timer: half a minute later, at 10:15, it is finished and the 10:30 pair is "Next, at 10:30 am"', r.ids.welcome.state === 'Finished' && r.ids['storybook-reader'].state === 'Next, at 10:30 am' && r.overall === 'between', `${r.overall}: ${r.status}`);
  await page.clock.runFor(15 * 60 * 1000 + 5000); // past 10:30
  r = await read(page);
  check('timer: at 10:30 the pair are "Now on stage, until 11:15 am"', r.ids['storybook-reader'].state === 'Now on stage, until 11:15 am' && r.overall === 'on', r.status);
  await page.clock.runFor(10 * 60 * 1000); // ten more minutes
  const t = await page.evaluate(() => ({ timers: window.__timers.slice(), raf: window.__raf, active: document.activeElement?.id, kept: [...document.querySelectorAll('.sg-session, .sg-session-state, .sg-agenda-status')].every(n => n.__mark), live: document.querySelectorAll('[aria-live], [role=status], [role=alert]').length }));
  check(`timer: 26 minutes of clock cost ${t.timers.length} wake-ups, each at most a minute (longest ${Math.max(...t.timers)} ms), and no animation frames (${t.raf})`, t.timers.length >= 20 && t.timers.length <= 30 && t.timers.every(x => x <= 60100) && t.raf === 0, JSON.stringify(t.timers.slice(0, 6)));
  check('timer: focus stayed on the button, and no session, state or status node was replaced', t.active === 'probe' && t.kept, `active ${t.active}`);
  check('timer: and still no live region anywhere on the page', t.live === 0, `${t.live}`);
  await ctx.close();
}

// ── phone width ────────────────────────────────────────────────────────
for (const [register, theme] of [['warm', 'light'], ['playful', 'light'], ['quiet', 'dark']]) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}&theme=${theme}&now=${ON}`, { width: 390, height: 844 });
  await settle(page);
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, longest: Math.max(...[...document.querySelectorAll('.sg-session')].map(li => Math.round(li.getBoundingClientRect().right))) }));
  check(`at 390 px (${register}, ${theme}) the agenda does not scroll sideways (scrollWidth ${w.sw}, widest row ends at ${w.longest})`, w.sw <= 390 && w.longest <= 390, JSON.stringify(w));
  await page.screenshot({ path: `.shots/agenda/${register}-${theme}-phone.png`, fullPage: false });
  check(`at 390 px (${register}) no console errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

await done();
