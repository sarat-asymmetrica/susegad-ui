// Browser checks for <sg-signature>. Not a unit test (npm test runs the pure
// core); run it with `npm run check` or by hand:
//
//   node packages/components/signature/signature.check.mjs
//
// Without JavaScript: the typed name is the whole control, `required` blocks
// an empty submit, and the name submits. With JavaScript: the pad, its help
// and buttons appear; either a drawing or a typed name satisfies `required`;
// drawing fills the hidden path input; undo, start again and form reset work
// from the keyboard; a disabled field cannot be drawn on.

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/components/signature/demo.html`;

// ── without JavaScript ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${url}?register=quiet`);
  check('no JS: no pad, just the typed-name input', await p.locator('#book canvas').count() === 0 && await p.locator('#book input[name="signature"]').count() === 1);
  check('no JS: the input has its label', await p.getByLabel('Type your full name to sign').first().count() === 1);
  await p.click('#book button[type="submit"]');
  await p.waitForTimeout(200);
  check('no JS: an empty submit is blocked by native validation', !p.url().includes('signature='), p.url());
  await p.fill('#sig-name', 'Sarat Chandran');
  await Promise.all([p.waitForURL(/signature=/), p.click('#book button[type="submit"]')]);
  check('no JS: the typed name submits with the form', new URL(p.url()).searchParams.get('signature') === 'Sarat Chandran', p.url());
  await ctx.close();
}

// ── with JavaScript ──
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${url}?register=warm`);
await p.waitForFunction(() => window.__ready);
await p.waitForFunction(() => document.querySelector('#sig').dataset.skin);

const read = () => p.evaluate(() => {
  const el = document.getElementById('sig'), input = el.querySelector('#sig-name'), form = el.closest('form');
  const fd = new FormData(form);
  return {
    method: el.method, path: fd.get('signature-path'), name: fd.get('signature'),
    status: el.querySelector('.sg-signature-status').textContent,
    valid: input.checkValidity(), message: input.validationMessage,
    undo: el.querySelector('.sg-signature-undo').disabled, clear: el.querySelector('.sg-signature-clear').disabled,
    sent: document.getElementById('sent').textContent,
  };
});
async function draw(sel = '#sig') {
  const c = await p.locator(`${sel} canvas`).boundingBox();
  await p.mouse.move(c.x + c.width * 0.2, c.y + c.height * 0.6);
  await p.mouse.down();
  for (let i = 1; i <= 24; i++) await p.mouse.move(c.x + c.width * (0.2 + i * 0.025), c.y + c.height * (0.6 - 0.2 * Math.sin(i / 3)));
  await p.mouse.up();
}

const setup = await p.evaluate(() => {
  const el = document.getElementById('sig'), input = el.querySelector('#sig-name');
  const help = el.querySelector('.sg-signature-help');
  return {
    pad: !!el.querySelector('.sg-signature-pad[aria-hidden="true"] canvas'),
    described: (input.getAttribute('aria-describedby') || '').split(' ').includes(help?.id),
    hidden: el.querySelector('input[type="hidden"]')?.name,
    textboxes: el.querySelectorAll('input:not([type="hidden"])').length,
    buttons: [...el.querySelectorAll('button')].map(b => `${b.type}:${b.textContent}`),
  };
});
check('with JS: a pad (hidden from assistive tech) and help linked to the input', setup.pad && setup.described, JSON.stringify(setup));
check('with JS: one text input, a hidden signature-path, two real buttons that never submit', setup.textboxes === 1 && setup.hidden === 'signature-path' && setup.buttons.join('|') === 'button:Undo last stroke|button:Start again', JSON.stringify(setup));

let s = await read();
check('required: nothing signed is invalid, in our words', !s.valid && s.message === 'Sign in the box, or type your full name.', s.message);
check('required stays on the input while nothing is signed, so assistive tech says so', await p.evaluate(() => document.getElementById('sig-name').required));
await p.click('#book button[type="submit"]');
s = await read();
check('required: the submit is blocked', s.sent === '');
check('undo and start again are disabled with nothing to take away', s.undo && s.clear);

// keyboard: type a name
await p.focus('#sig-name');
await p.keyboard.type('Sarat Chandran');
s = await read();
check('keyboard: typing a name signs', s.method === 'typed' && s.valid && s.path === '', JSON.stringify(s));
await p.keyboard.press('Enter');
s = await read();
check('keyboard: the typed name submits', /signature "Sarat Chandran", signature-path empty/.test(s.sent), s.sent);
await p.fill('#sig-name', '');

// draw
await draw();
s = await read();
check('drawing signs: the path fills with SVG path data', s.method === 'drawn' && /^M[\d.]+ [\d.]+L.*Z$/.test(s.path), (s.path || '').slice(0, 40));
check('drawing is announced once, in words', s.status === 'Signed by drawing. You can undo or start again.', s.status);
check('a drawing satisfies required without a typed name', s.valid && !s.undo && !(await p.evaluate(() => document.getElementById('sig-name').required)));
await p.click('#book button[type="submit"]');
s = await read();
check('a drawn signature submits', /signature-path \d+ characters/.test(s.sent), s.sent);

// register change re-inks, and the submitted path follows what is shown
const warmPath = s.path;
await p.evaluate(() => document.documentElement.setAttribute('data-register', 'quiet'));
await p.waitForFunction(() => document.querySelector('#sig').dataset.skin === 'quiet');
s = await read();
check('a register change re-inks, and the submitted path matches the new pen', s.path && s.path !== warmPath && s.path === await p.evaluate(() => document.getElementById('sig').pathData));
await p.evaluate(() => document.documentElement.setAttribute('data-register', 'warm'));
await p.waitForFunction(() => document.querySelector('#sig').dataset.skin === 'warm');

// undo from the keyboard
await draw();
await p.focus('#sig .sg-signature-undo');
await p.keyboard.press('Enter');
s = await read();
check('undo takes away the last stroke only', s.method === 'drawn' && s.path.split('M').length === 2, `${s.path.split('M').length - 1} strokes`);
await p.keyboard.press('Enter');
s = await read();
check('undoing the last stroke clears it and says so', s.method === null && s.path === '' && s.status === 'Signature cleared.' && !s.valid, JSON.stringify(s));
check('focus is not lost when undo disables itself: it moves to the name', await p.evaluate(() => document.activeElement.id) === 'sig-name');

// start again
await draw();
await p.fill('#sig-name', 'Sarat');
await p.focus('#sig .sg-signature-clear');
await p.keyboard.press('Space');
s = await read();
const focused = await p.evaluate(() => document.activeElement.id);
check('start again clears the drawing and the name, and puts focus on the name', s.path === '' && s.name === '' && focused === 'sig-name', `${focused} ${JSON.stringify(s)}`);

// form reset
await draw();
await p.evaluate(() => document.getElementById('book').reset());
await p.waitForTimeout(50);
s = await read();
check('a form reset clears the drawing too', s.path === '' && s.method === null);

// a disabled field
const before = await p.evaluate(() => document.querySelector('#off-name').closest('sg-signature').pathData);
const off = p.locator('#off-name').locator('xpath=..');
await off.scrollIntoViewIfNeeded();
const box = await off.locator('canvas').boundingBox();
await p.mouse.move(box.x + 50, box.y + 50); await p.mouse.down(); await p.mouse.move(box.x + 200, box.y + 80, { steps: 8 }); await p.mouse.up();
const after = await p.evaluate(() => document.querySelector('#off-name').closest('sg-signature').pathData);
check('a disabled field cannot be drawn on, and its buttons are disabled', before === '' && after === '' && await off.locator('button:disabled').count() === 2);

// the demo's pre-drawn signature
const demo = await p.evaluate(() => { const el = document.getElementById('drawn'); return { method: el.method, strokes: el.strokes.length, svg: el.toSVG('#000').startsWith('<svg') }; });
check('strokes can be set from outside, and toSVG() returns a standalone SVG', demo.method === 'drawn' && demo.strokes === 3 && demo.svg, JSON.stringify(demo));

check('no console or page errors', errors.length === 0, errors.join(' | '));

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
