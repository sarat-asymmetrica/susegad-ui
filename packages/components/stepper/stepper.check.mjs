// Browser checks for the stepper: the no-JavaScript path, the keyboard, and
// that nothing typed is ever lost. Run by hand or with `npm run check`:
//
//   node packages/components/stepper/stepper.check.mjs [--shots]
//
// --shots also saves screenshots of each step to .shots/stepper/.

import fs from 'node:fs';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/stepper', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = reg => `${server.url}/packages/components/stepper/demo.html?register=${reg}`;

// ── Without JavaScript ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(PAGE('quiet'));
  const shown = await p.$$eval('sg-stepper > fieldset', fs => fs.map(f => f.offsetParent !== null));
  check('no JS: every step shows, in order', shown.length === 3 && shown.every(Boolean), JSON.stringify(shown));
  check('no JS: one submit button, visible', await p.locator('button[type=submit]').isVisible() && (await p.$$('button[type=submit]')).length === 1);
  await p.fill('input[name=name]', 'Anjali Kamat');
  await p.fill('input[name=email]', 'anjali@example.com');
  await p.click('button[type=submit]');
  await p.waitForURL(/sent=1/);
  const q = new URL(p.url()).searchParams;
  check('no JS: the form submits every step natively', q.get('arrive') === '2026-10-16' && q.get('adults') === '2' && q.get('name') === 'Anjali Kamat', p.url().split('?')[1]);
  await p.goto(PAGE('quiet'));
  await p.click('button[type=submit]');
  check('no JS: native validation stops an incomplete form', !p.url().includes('sent=1'));
  if (shots) await p.screenshot({ path: '.shots/stepper/no-js.png', fullPage: true });
  await ctx.close();
}

// ── With JavaScript, in each register ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(PAGE(reg));
  await p.waitForFunction(() => window.__ready && document.querySelector('sg-stepper')?.skin);
  const view = () => p.evaluate(() => {
    const s = document.querySelector('sg-stepper');
    const a = document.activeElement;
    return {
      shown: [...s.querySelectorAll(':scope > fieldset')].map(f => !f.hidden),
      progress: s.querySelector('.sg-stepper-progress').textContent,
      next: s.querySelector('.sg-stepper-next').hidden ? null : s.querySelector('.sg-stepper-next').textContent,
      back: !s.querySelector('.sg-stepper-back').hidden,
      submit: !s.querySelector('button[type=submit]').hidden,
      focus: a.tagName === 'LEGEND' ? `legend:${a.textContent}` : a.name || a.className || a.tagName,
      described: a.tagName === 'LEGEND' ? document.getElementById(a.getAttribute('aria-describedby'))?.textContent : null,
    };
  });
  let v = await view();
  check(`${reg}: one step at a time, with where you are in words`, JSON.stringify(v.shown) === '[true,false,false]' && v.progress === 'Step 1 of 3' && v.next === 'Next: Who is coming' && !v.back && !v.submit, JSON.stringify(v));
  if (shots) await p.screenshot({ path: `.shots/stepper/${reg}-1.png` });

  // keyboard: Tab to the date field, Enter moves on
  await p.focus('input[name=leave]');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(50);
  v = await view();
  check(`${reg}: Enter in a field moves to the next step, focus on its legend`, v.shown[1] && v.focus === 'legend:Who is coming' && v.described === 'Step 2 of 3', JSON.stringify(v));

  // Next is blocked while this step has a problem
  await p.fill('input[name=adults]', '0');
  await p.click('.sg-stepper-next');
  v = await view();
  check(`${reg}: Next waits for this step to be complete`, v.shown[1] && v.focus === 'adults', JSON.stringify(v));
  await p.fill('input[name=adults]', '3');
  await p.fill('textarea[name=notes]', 'A cot for the baby, please.');
  await p.keyboard.press('Shift+Tab'); // keyboard reaches Next by Tab as well
  await p.click('.sg-stepper-next');
  await p.waitForTimeout(reg === 'quiet' ? 50 : 650);
  v = await view();
  check(`${reg}: the last step shows Back and the form's own submit`, v.shown[2] && v.back && v.submit && v.next === null && v.progress === 'Step 3 of 3', JSON.stringify(v));
  if (shots) await p.screenshot({ path: `.shots/stepper/${reg}-3.png` });

  // back and forward: nothing lost
  await p.click('.sg-stepper-back');
  const kept = await p.inputValue('textarea[name=notes]');
  const adults = await p.inputValue('input[name=adults]');
  check(`${reg}: going back keeps what you typed`, kept === 'A cot for the baby, please.' && adults === '3', `${kept} / ${adults}`);
  if (shots) await p.screenshot({ path: `.shots/stepper/${reg}-2-back.png` });

  // a problem in a hidden step is found on submit, and you are taken to it
  await p.click('.sg-stepper-back');
  await p.fill('input[name=arrive]', '');
  await p.click('.sg-stepper-next');
  v = await view();
  check(`${reg}: Next on step 1 waits for the arrival date`, v.shown[0] && v.focus === 'arrive', JSON.stringify(v));
  await p.evaluate(() => document.querySelector('sg-stepper').go(2)); // as if they skipped ahead
  await p.fill('input[name=name]', 'Anjali Kamat');
  await p.fill('input[name=email]', 'anjali@example.com');
  await p.click('button[type=submit]');
  await p.waitForTimeout(80);
  v = await view();
  check(`${reg}: submit takes you to the step with the problem`, v.shown[0] && v.focus === 'arrive' && !p.url().includes('sent=1'), JSON.stringify(v));

  // register swap mid-walk keeps the step
  await p.fill('input[name=arrive]', '2026-10-16');
  await p.evaluate(() => document.querySelector('sg-stepper').go(2));
  await p.evaluate(r => { document.documentElement.dataset.register = r === 'quiet' ? 'warm' : 'quiet'; }, reg);
  await p.waitForTimeout(300);
  v = await view();
  check(`${reg}: a register change keeps the step and the values`, v.shown[2] && (await p.inputValue('textarea[name=notes]')) === 'A cot for the baby, please.', JSON.stringify(v));

  await p.click('button[type=submit]');
  await p.waitForURL(/sent=1/);
  const q = new URL(p.url()).searchParams;
  check(`${reg}: submit sends every step, hidden ones too`, q.get('arrive') === '2026-10-16' && q.get('adults') === '3' && q.get('notes') === 'A cot for the baby, please.' && q.get('email') === 'anjali@example.com', p.url().split('?')[1]);
  check(`${reg}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── Reduced motion: nothing animates between steps ──
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(PAGE('playful'));
  await p.waitForFunction(() => window.__ready && document.querySelector('sg-stepper')?.skin);
  await p.click('.sg-stepper-next');
  const running = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  check('reduced motion: the walk is drawn at once, nothing animates', running === 0, `${running} running`);
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} stepper checks pass`);
process.exit(failed ? 1 : 0);
