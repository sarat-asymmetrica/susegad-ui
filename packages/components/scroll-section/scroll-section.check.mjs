// Browser checks for <sg-scroll-section>: progress tracks real scroll, the
// off-screen gate stops the loop, quiet and reduced motion show the still,
// warm/playful add the parallax attribute and quiet does not, no console
// errors.
//
//   node packages/components/scroll-section/scroll-section.check.mjs

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const demo = `${server.url}/packages/components/scroll-section/demo.html`;

const progress = p => p.evaluate(() => document.getElementById('section').progress);
const sceneProgress = p => p.evaluate(() => +document.querySelector('#section sg-scene').getAttribute('progress'));

for (const register of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${demo}?register=${register}`);
  await p.waitForFunction(() => window.__ready);
  await p.waitForFunction(() => !!document.getElementById('section').dataset.skin);
  const tag = `${register}:`;

  const before = await progress(p);
  check(`${tag} progress starts at 0 (or the still value), the section not yet reached`, register === 'quiet' ? before === 1 : before === 0, `${before}`);

  await p.mouse.wheel(0, 2200); // scroll roughly to the section
  await p.waitForTimeout(250);
  const mid = await progress(p);

  if (register === 'quiet') {
    check(`${tag} quiet never scrubs: progress stays at its still value of 1 regardless of scroll`, mid === 1, `${mid}`);
  } else {
    check(`${tag} scrolling moves progress off 0`, mid > 0 && mid <= 1, `${mid}`);
    check(`${tag} the scene's own progress attribute mirrors the section's`, Math.abs((await sceneProgress(p)) - mid) < 0.01, `${await sceneProgress(p)} vs ${mid}`);
    const parallax = await p.evaluate(() => document.getElementById('section').hasAttribute('data-scroll-parallax'));
    check(`${tag} the register's parallax attribute is set`, parallax);
  }

  await p.mouse.wheel(0, 4000); // scroll well past the section
  await p.waitForTimeout(250);
  const after = await progress(p);
  if (register !== 'quiet') check(`${tag} progress reaches (close to) 1 once the section has fully passed`, after > 0.9, `${after}`);

  check(`${tag} no console or page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// quiet never gets the parallax attribute
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=quiet`);
  await p.waitForFunction(() => window.__ready && document.getElementById('section').dataset.skin);
  const has = await p.evaluate(() => document.getElementById('section').hasAttribute('data-scroll-parallax'));
  check('quiet: no parallax attribute, ever', !has);
  // Regression check (a real bug, found by looking at the screenshot, not
  // by any assertion): pinning the child scene's progress attribute to "1"
  // on the way to still() left it painting a blank box. The fix hands the
  // scene back to its own still() with no progress attribute at all.
  const painted = await p.evaluate(() => {
    const stage = document.querySelector('#section sg-scene')?.shadowRoot?.querySelector('.stage');
    return stage ? stage.querySelector('canvas, svg') != null : false;
  });
  check('quiet: the still scene actually paints something (not a blank box)', painted);
  await ctx.close();
}

// reduced motion: the same still path as quiet, in warm
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1000, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready && document.getElementById('section').dataset.skin);
  const still = await progress(p);
  await p.mouse.wheel(0, 2200);
  await p.waitForTimeout(200);
  const afterScroll = await progress(p);
  check('reduced motion, warm: the section never scrubs, staying at its still value', still === 1 && afterScroll === 1, `${still} -> ${afterScroll}`);
  await ctx.close();
}

// off-screen: the loop genuinely stops, not just "the section is out of
// view" -- checked by counting sg-scroll-progress events fired during a
// quiet window well after scrolling past (A4: pause off screen).
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${demo}?register=warm`);
  await p.waitForFunction(() => window.__ready && document.getElementById('section').dataset.skin);
  await p.evaluate(() => {
    window.__events = 0;
    document.getElementById('section').addEventListener('sg-scroll-progress', () => { window.__events++; });
  });
  await p.mouse.wheel(0, 8000); // scroll well past the section, off screen
  await p.waitForTimeout(400); // let the IntersectionObserver report and the loop stop
  await p.evaluate(() => { window.__events = 0; }); // reset the counter once settled off screen
  await p.waitForTimeout(500); // a quiet window with no scrolling at all
  const fired = await p.evaluate(() => window.__events);
  const offBottom = await p.evaluate(() => document.getElementById('section').getBoundingClientRect().bottom < -200);
  check('the section is genuinely off screen for this check to mean anything', offBottom);
  check('no sg-scroll-progress events fire while off screen and the page is otherwise idle: the rAF loop has stopped', fired === 0, `${fired} events`);
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
