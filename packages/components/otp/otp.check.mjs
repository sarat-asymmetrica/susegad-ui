// Browser checks for <sg-otp>. Not a unit test (npm test runs the pure core);
// run it with `npm run check` or by hand:
//
//   node packages/components/otp/otp.check.mjs
//
// Without JavaScript: one input with the one-time-code autocomplete and the
// number pad; native validation blocks a short or non-digit code; the code
// submits. With JavaScript: still exactly one control in the accessibility
// tree; typing, type-over, backspace across boxes, arrow keys, a real paste,
// autofill-style value setting and an SMS-keyboard insert all end up as digits
// in the one input, and the boxes show them.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/components/otp/demo.html`;

// ── without JavaScript ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${url}?register=quiet`);
  const input = p.locator('#code');
  const attrs = await input.evaluate(i => [i.autocomplete, i.inputMode, i.pattern]).catch(() => null)
    ?? [await input.getAttribute('autocomplete'), await input.getAttribute('inputmode'), await input.getAttribute('pattern')];
  check('no JS: one input, with the one-time-code autocomplete and the number pad', await p.locator('#verify input').count() === 1 && attrs[0] === 'one-time-code' && attrs[1] === 'numeric', attrs.join(' '));
  check('no JS: no boxes', await p.locator('#verify .sg-otp-boxes').count() === 0);
  await p.fill('#code', '48a91');
  await p.click('#verify button[type="submit"]');
  await p.waitForTimeout(200);
  check('no JS: a short or non-digit code is blocked by native validation', !p.url().includes('code='), p.url());
  await p.fill('#code', '482913');
  await Promise.all([p.waitForURL(/code=/), p.click('#verify button[type="submit"]')]);
  check('no JS: the code submits with the form', new URL(p.url()).searchParams.get('code') === '482913', p.url());
  await ctx.close();
}

// ── with JavaScript ──
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${url}?register=playful`);
await p.waitForFunction(() => window.__ready);
await p.waitForFunction(() => document.querySelector('#code').closest('sg-otp').dataset.skin);
await p.evaluate(() => { window.__events = []; document.addEventListener('sg-otp', e => window.__events.push(e.detail)); });

const read = () => p.evaluate(() => {
  const input = document.getElementById('code'), el = input.closest('sg-otp');
  const boxes = [...el.querySelectorAll('.sg-otp-box')];
  return {
    value: input.value,
    boxes: boxes.map(b => b.textContent).join('') ,
    active: boxes.map((b, i) => (b.hasAttribute('data-active') ? i : -1)).filter(i => i >= 0),
    caret: [input.selectionStart, input.selectionEnd],
    sent: document.getElementById('sent').textContent,
  };
});

// the input lies over the boxes on purpose, so tap where a box is, as a finger would
const tapBox = async i => { const b = await p.locator('#verify .sg-otp-box').nth(i).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

const tree = await p.evaluate(() => {
  const el = document.getElementById('code').closest('sg-otp');
  return {
    boxesHidden: el.querySelector('.sg-otp-boxes').getAttribute('aria-hidden'),
    controls: el.querySelectorAll('input, button, [tabindex]').length,
    boxes: el.querySelectorAll('.sg-otp-box').length,
  };
});
const roles = await p.locator('#verify').getByRole('textbox').count();
check('one control: the native input is the only textbox; the six boxes are hidden from assistive tech', roles === 1 && tree.controls === 1 && tree.boxes === 6 && tree.boxesHidden === 'true', JSON.stringify({ roles, ...tree }));
check('the input keeps its label and its autofill attributes', await p.getByLabel('Enter the 6-digit code we sent to 98220 12345').first().evaluate(i => i.id === 'code' && i.autocomplete === 'one-time-code' && i.inputMode === 'numeric'));

await tapBox(0);
await p.keyboard.type('48a2');
let s = await read();
check('typing fills the boxes; letters go nowhere', s.value === '482' && s.boxes === '482', JSON.stringify(s));
check('the current box follows the caret', s.active.join() === '3', s.active.join());
await p.keyboard.press('Backspace');
await p.keyboard.press('Backspace');
s = await read();
check('backspace works back across the boxes', s.value === '4' && s.boxes === '4' && s.active.join() === '1', JSON.stringify(s));
await p.keyboard.type('82913');
s = await read();
check('a full code keeps the last box current and takes no more', s.value === '482913' && s.active.join() === '5');
await p.keyboard.type('7');
check('a seventh digit is refused', (await read()).value === '482913');
await p.keyboard.press('ArrowLeft');
await p.keyboard.press('ArrowLeft');
await p.keyboard.press('ArrowLeft');
s = await read();
check('arrow keys move between boxes', s.active.join() === '3', JSON.stringify(s));

// tap a filled box and type over it
await tapBox(1);
s = await read();
check('tapping a filled box selects its digit', s.caret.join() === '1,2' && s.active.join() === '1', JSON.stringify(s));
await p.keyboard.type('7');
s = await read();
check('typing over it replaces that digit only', s.value === '472913' && s.boxes === '472913', s.value);

// a real paste from the clipboard
await p.keyboard.press('Control+A');
await p.keyboard.press('Delete');
check('select all and delete clears every box', (await read()).value === '');
await p.evaluate(() => navigator.clipboard.writeText('Your Casa code is 118 204. It expires in 10 minutes.'));
await p.keyboard.press('Control+V');
s = await read();
check('pasting a whole message keeps just the code and fills every box', s.value === '118204' && s.boxes === '118204', JSON.stringify(s));

// autofill and SMS keyboards set the value their own way
await p.evaluate(() => { const i = document.getElementById('code'); i.value = '９９１２３４'; i.dispatchEvent(new Event('input', { bubbles: true })); });
s = await read();
check('an autofill that sets the value directly is cleaned to ASCII digits', s.value === '991234' && s.boxes === '991234', JSON.stringify(s));
await p.evaluate(() => { const i = document.getElementById('code'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
await p.focus('#code');
await p.keyboard.insertText('४८२९१३');
s = await read();
check('a code inserted in one go (SMS suggestion, IME) lands, even in Devanagari digits', s.value === '482913', JSON.stringify(s));

const ev = await p.evaluate(() => window.__events.at(-1));
check('sg-otp says when the code is complete', ev?.value === '482913' && ev.complete === true, JSON.stringify(ev));

await p.waitForTimeout(700); // let the playful stamps settle for the screenshot
await p.locator('#verify').screenshot({ path: '.shots/otp-focused-playful.png' }).catch(() => {});
await p.keyboard.press('Enter');
s = await read();
check('Enter submits the form with the code', s.sent === 'Would confirm code 482913.', s.sent);

// motion: stamps land in playful and are cancelled when done; reduced motion lands nothing
await p.waitForTimeout(900); // the last stamp of a pasted code lands about 0.9 s after the first
// count landings only (script animations), not CSS transitions or the caret's blink
const landings = el => el.getAnimations({ subtree: true }).filter(a => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition));
await p.evaluate(`window.__landings = ${landings}`);
const settled = await p.evaluate(() => window.__landings(document.getElementById('code').closest('sg-otp')).length);
check('landing animations are cleaned up once they finish', settled === 0, `${settled} left`);
{
  const rctx = await browser.newContext({ reducedMotion: 'reduce' });
  const r = await rctx.newPage();
  await r.goto(`${url}?register=playful`);
  await r.waitForFunction(() => window.__ready && document.querySelector('#code').closest('sg-otp').dataset.skin);
  await r.focus('#code');
  await r.keyboard.type('4829');
  const n = await r.evaluate(() => document.getElementById('code').closest('sg-otp').getAnimations({ subtree: true }).filter(a => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length);
  check('reduced motion: digits appear without landing', n === 0 && await r.evaluate(() => document.querySelector('#code').closest('sg-otp').querySelectorAll('[data-filled]').length === 4), `${n} running`);
  await rctx.close();
}

// the disabled one cannot be typed into
await p.locator('#later').focus().catch(() => {});
check('a disabled code takes no focus', await p.evaluate(() => document.activeElement.id !== 'later'));

check('no console or page errors', errors.length === 0, errors.join(' | '));

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
