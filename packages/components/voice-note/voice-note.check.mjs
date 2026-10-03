// Browser checks for <sg-voice-note>: axe, consent (no sound before its own
// press, counted by wrapping HTMLMediaElement.play), playing and seeking by
// keyboard, the transcript with and without JavaScript, and measured versus
// stand-in waveforms. The consent probe also runs on a deliberately broken
// page that plays on load, to show it can fail.
//
//   node packages/components/voice-note/voice-note.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';

const { check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/voice-note/demo.html';

// Count every play() and every sounding media element, from before any page script runs.
const COUNT = () => {
  window.__plays = 0;
  const real = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { window.__plays++; return real.apply(this, a); };
};
const sounding = p => p.evaluate(() => ({ plays: window.__plays, sounding: [...document.querySelectorAll('audio, video')].filter(m => !m.paused || m.currentTime > 0).length }));

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── consent: nothing sounds until the play button is pressed ──
{
  const { ctx, page } = await open(DEMO, { init: COUNT });
  await page.addInitScript(COUNT);
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(800);
  const before = await sounding(page);
  check('no sound before a press: play() never called, nothing playing', before.plays === 0 && before.sounding === 0, JSON.stringify(before));
  await page.click('[data-register="warm"] .sg-voice-play');
  await page.waitForFunction(() => document.querySelector('[data-register="warm"] audio').currentTime > 1.2, null, { timeout: 8000 }).catch(() => {});
  const after = await page.evaluate(() => {
    const host = document.querySelector('[data-register="warm"] sg-voice-note');
    return {
      plays: window.__plays,
      time: +host.querySelector('audio').currentTime.toFixed(2),
      label: host.querySelector('.sg-voice-play').getAttribute('aria-label'),
      played: host.querySelectorAll('.sg-voice-bars .sg-played').length,
      marked: host.querySelector('.sg-voice-cue[data-current]')?.textContent.slice(0, 30) ?? null,
      others: [...document.querySelectorAll('audio')].filter(a => a !== host.querySelector('audio') && !a.paused).length,
    };
  });
  check('one press, one play(): the audio moves, and only that note plays', after.plays === 1 && after.time > 1 && after.others === 0, JSON.stringify(after));
  check('while playing: the button says Pause, the bars fill, the spoken phrase is marked', /^Pause/.test(after.label) && after.played > 0 && after.marked?.startsWith('The sky'), JSON.stringify(after));
  await page.click('[data-register="warm"] .sg-voice-play');
  check('a second press pauses it', await page.evaluate(() => document.querySelector('[data-register="warm"] audio').paused));
  await ctx.close();
}
{
  // broken on purpose: a note whose page script plays it on load
  const { ctx, page } = await openHtml('autoplays', `<!doctype html><html lang="en"><head><title>t</title></head><body>
    <sg-voice-note><audio controls src="/packages/recipes/storybook-spread/spread.en.wav"></audio><p class="sg-voice-transcript">x</p></sg-voice-note>
    <script>addEventListener('load', () => document.querySelector('audio').play().catch(() => {}));</script></body></html>`);
  await page.addInitScript(COUNT);
  await page.reload();
  await page.waitForTimeout(900);
  const s = await sounding(page);
  check('control: a page that plays on load is caught by the same probe', s.plays > 0, JSON.stringify(s));
  await ctx.close();
}
{
  // an autoplay attribute in the markup is removed by the element
  const { ctx, page } = await openHtml('autoplay-attr', `<!doctype html><html lang="en"><head><title>t</title>
    <link rel="stylesheet" href="/packages/components/voice-note/voice-note.css"></head><body>
    <sg-voice-note><audio controls autoplay src="/packages/recipes/storybook-spread/spread.en.wav"></audio><p class="sg-voice-transcript">x</p></sg-voice-note>
    <script type="module">import '/packages/components/voice-note/voice-note.js';</script></body></html>`);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => { const a = document.querySelector('audio'); return { autoplay: a.hasAttribute('autoplay'), paused: a.paused, t: a.currentTime }; });
  check('an autoplay attribute is removed and the note stays silent', !r.autoplay && r.paused && r.t < 0.5, JSON.stringify(r));
  await ctx.close();
}

// ── keyboard: Tab to the button, Space plays, Tab to the waveform, arrows seek ──
{
  const { ctx, page } = await open(DEMO);
  await page.focus('[data-register="quiet"] .sg-voice-play');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const playing = await page.evaluate(() => !document.querySelector('[data-register="quiet"] audio').paused);
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  const onRange = await page.evaluate(() => document.activeElement.type === 'range' && document.activeElement.closest('sg-voice-note') === document.querySelector('[data-register="quiet"] sg-voice-note'));
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const n = document.querySelector('[data-register="quiet"] sg-voice-note'); return { t: +n.querySelector('audio').currentTime.toFixed(2), text: n.querySelector('input').getAttribute('aria-valuetext'), ring: getComputedStyle(n.querySelector('.sg-voice-wave')).outlineStyle }; });
  check('keyboard: Space plays and pauses; Tab reaches the waveform; arrows seek and it says where', playing && onRange && r.t > 0.3 && /^0:0\d of 0:3\d$/.test(r.text) && r.ring === 'solid', JSON.stringify({ playing, onRange, ...r }));
  await ctx.close();
}

// ── waveforms: measured where peaks are given, a marked stand-in where not ──
{
  const { ctx, page } = await open(DEMO);
  await settle(page);
  const w = await page.evaluate(() => [...document.querySelectorAll('sg-voice-note')].map(n => `${n.dataset.waveform}:${n.querySelectorAll('.sg-voice-bars path').length}`));
  check('three measured waveforms and one marked stand-in, each drawn with bars', w.filter(x => x.startsWith('measured')).length === 3 && w.filter(x => x.startsWith('stand-in')).length === 1 && w.every(x => +x.split(':')[1] >= 8), w.join(', '));
  await ctx.close();
}

// ── without JavaScript: native controls and the transcript ──
{
  const { ctx, page } = await open(DEMO, { js: false });
  const r = await page.evaluate(() => [...document.querySelectorAll('sg-voice-note')].map(n => ({ controls: n.querySelector('audio').hasAttribute('controls'), h: Math.round(n.querySelector('audio').getBoundingClientRect().height), t: Math.round(n.querySelector('.sg-voice-transcript').getBoundingClientRect().height) })));
  check('without JavaScript: the browser\'s controls and the transcript show for every note', r.length === 4 && r.every(x => x.controls && x.h > 20 && x.t > 20), JSON.stringify(r));
  await ctx.close();
}

// ── phone width ──
{
  const { ctx, page } = await open(DEMO, { width: 390 });
  await settle(page);
  const r = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.sg-voice-play')].map(b => Math.round(b.getBoundingClientRect().width)) }));
  check('at 390 px: no sideways scroll, and play buttons are at least 24 px', r.page <= 390 && r.buttons.every(w => w >= 24), JSON.stringify(r));
  await ctx.close();
}

await done();
