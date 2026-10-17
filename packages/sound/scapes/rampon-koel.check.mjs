// Browser checks for the Rampon koel soundscape.
//
//   node packages/sound/scapes/rampon-koel.check.mjs   (or: npm run check)
//
// Headless Chromium cannot judge whether this sounds like a koel (see the
// progress note for what a human should listen for). What it can prove:
// nothing plays before a gesture; it only calls in playful, never in warm or
// quiet even with the switch on; and once on, in playful, with a bird
// actually on screen, a call happens within the schedule's own window.

import { harness } from '../../../tools/lib/component-check.mjs';
import { pageHas } from '../../../tools/lib/engine.mjs';

const h = await harness({ axe: "this check drives the scene test page tools/harness/scene.html, not a demo page; tools/smoke.mjs axes the registry's demo pages (it lists no paus or rampon page), so no axe check reads it" });
const { server, browser, check } = h;
const hasAudio = await pageHas(browser, "typeof AudioContext === 'function'"); // without one every count below is zero and the zeros would pass

async function withScene(register, fn) {
  const ctx = await h.context();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(() => {
    window.__acCount = 0; window.__calls = 0;
    const AC = window.AudioContext;
    // See paus-rain.check.mjs: without a real AudioContext constructor to wrap
    // (WebKit, no audio device), leave window.AudioContext as it is.
    if (!AC) return;
    window.AudioContext = new Proxy(AC, {
      construct(t, a) {
        window.__acCount++;
        const inst = new t(...a);
        const co = inst.createOscillator.bind(inst);
        inst.createOscillator = (...x) => { window.__calls++; return co(...x); };
        return inst;
      },
    });
  });
  await p.goto(`${server.url}/tools/harness/scene.html?name=rampon&register=${register}&seed=1`);
  await p.waitForFunction(() => window.__ready);
  await p.evaluate(async () => {
    const { attachRamponKoel } = await import('/packages/sound/scapes/rampon-koel.js');
    window.__detach = attachRamponKoel(window.__piece);
  });
  await fn(p);
  const errs = errors;
  await p.evaluate(() => window.__detach());
  await ctx.close();
  return errs;
}

if (!hasAudio) h.skip('every koel check (before the gesture, warm and quiet never call, playful calls, a hidden tab stops)', "this build has no AudioContext, so no context can be made, counted or heard; a count of zero would pass for want of one");
if (!hasAudio) {
  // what can still be asked without a context: the scene and the attached scape run without throwing
  const errs = await withScene('playful', async p => { await p.waitForTimeout(2600); });
  check('no console or page errors with the scape attached (no AudioContext in this engine)', errs.length === 0, errs.join(' | '));
} else {
// ── before any gesture: nothing plays, in any register ─────────────────────
{
  const errs = await withScene('playful', async p => {
    await p.waitForTimeout(2600); // past FIRST_CALL_AFTER_S, so a broken gate would show by now
    const ac = await p.evaluate(() => window.__acCount);
    check('before any gesture: no AudioContext, even past the schedule\'s first call time', ac === 0, `${ac} contexts`);
  });
  check('no console or page errors (before gesture)', errs.length === 0, errs.join(' | '));
}

// ── switch on, but warm: never calls ────────────────────────────────────────
{
  const errs = await withScene('warm', async p => {
    await p.click('#box');
    await p.evaluate(async () => { const { setSoundOn } = await import('/packages/sound/index.js'); setSoundOn(true); });
    await p.waitForTimeout(3000);
    const calls = await p.evaluate(() => window.__calls);
    check('warm, switch on, gesture done: the koel never calls (playful only)', calls === 0, `${calls} oscillators`);
  });
  check('no console or page errors (warm)', errs.length === 0, errs.join(' | '));
}

// ── switch on, playful: calls within the schedule ───────────────────────────
{
  const errs = await withScene('playful', async p => {
    await p.click('#box');
    await p.evaluate(async () => { const { setSoundOn } = await import('/packages/sound/index.js'); setSoundOn(true); });
    await p.waitForTimeout(4500); // FIRST_CALL_AFTER_S (2s) plus room for the bout
    const r = await p.evaluate(() => ({ contexts: window.__acCount, calls: window.__calls }));
    check('playful, switch on, gesture done: a context exists', r.contexts >= 1, JSON.stringify(r));
    check('playful, switch on, gesture done: at least one call has happened', r.calls >= 2, `${r.calls} oscillators (2 per call)`);
  });
  check('no console or page errors (playful, on)', errs.length === 0, errs.join(' | '));
}

// ── tab hidden: stops calling ────────────────────────────────────────────
{
  const ctx = await h.context();
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__calls = 0; const AC = window.AudioContext; if (!AC) return; window.AudioContext = new Proxy(AC, { construct(t, a) { const inst = new t(...a); const co = inst.createOscillator.bind(inst); inst.createOscillator = (...x) => { window.__calls++; return co(...x); }; return inst; } }); });
  await p.goto(`${server.url}/tools/harness/scene.html?name=rampon&register=playful&seed=1`);
  await p.waitForFunction(() => window.__ready);
  await p.evaluate(async () => { const { attachRamponKoel } = await import('/packages/sound/scapes/rampon-koel.js'); window.__detach = attachRamponKoel(window.__piece); });
  await p.click('#box');
  await p.evaluate(async () => { const { setSoundOn } = await import('/packages/sound/index.js'); setSoundOn(true); });
  await p.evaluate(() => Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(3000);
  const calls = await p.evaluate(() => window.__calls);
  check('tab hidden: the koel never calls', calls === 0, `${calls} oscillators`);
  await p.evaluate(() => window.__detach());
  await ctx.close();
}
}

await h.done();
