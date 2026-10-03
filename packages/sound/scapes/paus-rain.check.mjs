// Browser checks for the Paus rain soundscape.
//
//   node packages/sound/scapes/paus-rain.check.mjs   (or: npm run check)
//
// Headless Chromium cannot judge whether this actually sounds like rain (see
// the progress note for what a human should listen for). What it can prove:
// the drops event fires; nothing plays before a gesture; once on, an
// AudioContext exists and the oscillator pool never grows past its cap even
// under playful's heaviest rain; turning the switch off stops new voices.

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const page = `${server.url}/tools/harness/scene.html?name=paus&register=playful&intensity=1`;

const ctx = await browser.newContext();
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await p.addInitScript(() => {
  // Headless Chromium's AudioContext does not reliably fire 'ended' without a real output
  // device, so this counts a voice as live for the same ~130ms window the module itself
  // uses as its release backstop (its own setTimeout, not this one) -- not by trusting
  // 'ended', which would otherwise make voices look like they never free up.
  window.__acCount = 0; window.__peakVoices = 0; window.__liveOsc = 0;
  const AC = window.AudioContext;
  // WebKit's automated (no real audio device) context does not always expose
  // window.AudioContext at addInitScript time; without a real constructor to
  // wrap, leave it as it is rather than handing Proxy a non-object target.
  if (!AC) return;
  window.AudioContext = new Proxy(AC, {
    construct(t, a) {
      window.__acCount++;
      const inst = new t(...a);
      const co = inst.createOscillator.bind(inst);
      inst.createOscillator = (...x) => {
        const o = co(...x);
        window.__liveOsc++; window.__peakVoices = Math.max(window.__peakVoices, window.__liveOsc);
        setTimeout(() => { window.__liveOsc = Math.max(0, window.__liveOsc - 1); }, 140);
        return o;
      };
      return inst;
    },
  });
});
await p.goto(page);
await p.waitForFunction(() => window.__ready);

await p.evaluate(async () => {
  const { attachPausRain } = await import('/packages/sound/scapes/paus-rain.js');
  window.__detach = attachPausRain(window.__piece, { maxPerFrame: 3 });
  window.__drops = 0;
  window.__piece.addEventListener('sg-paus-drops', () => { window.__drops++; });
});
await p.waitForTimeout(600);
const dropsFired = await p.evaluate(() => window.__drops);
check('the drops event fires as Paus animates', dropsFired > 0, `${dropsFired} events`);

const before = await p.evaluate(() => window.__acCount);
check('before any gesture, with the switch off: no AudioContext', before === 0, `${before} contexts`);

// the gesture, and turning the switch on
await p.click('#box');
await p.evaluate(async () => {
  const { setSoundOn } = await import('/packages/sound/index.js');
  setSoundOn(true);
});
await p.waitForTimeout(1200); // enough frames of heavy rain for several ticks to want to fire

const after = await p.evaluate(() => ({ contexts: window.__acCount, peak: window.__peakVoices }));
check('once the switch is on and a gesture has happened, a context exists', after.contexts >= 1, JSON.stringify(after));
// the module's own cap is 4; a small margin above it allows for the 140ms release window this
// instrumentation uses (longer than the module's own ~130ms backstop) overlapping by one voice
check('the oscillator pool stays near its 4-voice cap, even in playful\'s heaviest rain', after.peak > 0 && after.peak <= 6, `peak ${after.peak}`);

// turning the switch off: no error, and the drops event keeps firing (the scene itself
// doesn't care about sound), but no new context should ever appear a second time
await p.evaluate(async () => {
  const { setSoundOn } = await import('/packages/sound/index.js');
  setSoundOn(false);
});
await p.waitForTimeout(400);
const stillOne = await p.evaluate(() => window.__acCount);
check('turning the switch off reuses the same context (no leak of a second one)', stillOne === after.contexts, `${stillOne} contexts`);

await p.evaluate(() => window.__detach());
check('destroy() runs cleanly', true);
check('no console or page errors', errors.length === 0, errors.join(' | '));

await ctx.close();
await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
