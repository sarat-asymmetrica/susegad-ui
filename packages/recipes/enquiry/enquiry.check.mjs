// Browser checks for the "Ask the house" recipe. Run by hand or with `npm run check`:
//
//   node packages/recipes/enquiry/enquiry.check.mjs
//
// 1. Keyboard only, warm: Tab order, a submit with problems (summary, focus,
//    the house's own words), fixing them, and a send that sends nothing and says so.
// 2. The wave gate: quiet, reduced motion, no JavaScript. The form is usable,
//    the browser blocks it while it is invalid, and it submits once it is valid.
// 3. Importing recipe.js wires nothing: with demo.js left out, no prototype
//    answer is mounted and the form posts as the page wrote it.

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const URL_ = `${server.url}/packages/recipes/enquiry/index.html`;

// ── 1. keyboard only, with JavaScript ──
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [], posts = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (r.method() !== 'GET' || /sent\.html/.test(r.url())) posts.push(`${r.method()} ${r.url()}`); });
  await p.goto(`${URL_}?register=warm`);
  await p.waitForFunction(() => window.__ready === true);
  await p.waitForTimeout(150);

  const order = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim())); }
  check('Tab walks the form in reading order', order.join(',') === 'f-name,f-contact,f-from,f-dates,f-group,f-occasion,f-msg,Send', order.join(','));

  await p.keyboard.press('Enter'); // on Send
  await p.waitForTimeout(150);
  let s = await p.evaluate(() => ({ words: document.querySelector('.sg-form-words').textContent, focus: document.activeElement.id }));
  check('Send with nothing filled in: a summary, and focus on the first problem', s.words === 'Check 2 fields: Your name, Phone or email.' && s.focus === 'f-name', JSON.stringify(s));
  const contactNote = await p.evaluate(() => document.querySelector('sg-field-note[for="f-contact"]').textContent);
  check("the contact note uses the house's words", contactNote === 'Error: Enter a phone number or an email address, so the house can reply.', contactNote);

  await p.keyboard.type('Sarat');
  await p.keyboard.press('Tab');
  await p.keyboard.type('sarat@');
  await p.keyboard.press('Tab');
  const contact = await p.evaluate(() => document.querySelector('sg-field-note[for="f-contact"]').textContent);
  check('a half-written address gets the format message', contact === 'Error: Enter a phone number like 98220 12345, or an email address like name@example.com.', contact);
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('End');
  await p.keyboard.type('example.com');
  const fixed = await p.evaluate(() => ({ shown: document.querySelector('sg-field-note[for="f-contact"]').hasAttribute('data-shown'), invalid: document.getElementById('f-contact').getAttribute('aria-invalid') }));
  check('fixing it clears the note as you type', !fixed.shown && fixed.invalid === null, JSON.stringify(fixed));
  await p.fill('#f-contact', '98220 12345');
  check('a phone number is also fine', await p.evaluate(() => document.getElementById('f-contact').validity.valid));

  // the combobox: an old name finds the city, and the keyboard chooses it
  await p.focus('#f-from');
  await p.keyboard.type('Bombay');
  await p.waitForTimeout(150);
  const first = await p.evaluate(() => document.querySelector('sg-combobox').suggestions?.[0]);
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  const from = await p.evaluate(() => document.getElementById('f-from').value);
  check('travelling from: "Bombay" finds Mumbai, and Down then Enter chooses it', first === 'Mumbai' && from === 'Mumbai', `${first} -> ${from}`);

  // the select: more than six is a question for the house, not an error
  await p.selectOption('#f-group', '7+');
  await p.waitForTimeout(100);
  const group = await p.evaluate(() => ({ text: document.getElementById('f-group-note').textContent, invalid: document.getElementById('f-group').getAttribute('aria-invalid') }));
  check("more than six people: the house's own answer, as a hint, not an error", group.text === "The house sleeps 6. Tell us more below and we'll see what's possible." && group.invalid === null, JSON.stringify(group));
  await p.selectOption('#f-group', '4');
  const cleared = await p.evaluate(() => document.getElementById('f-group-note').textContent);
  check('choosing four takes the hint away', cleared === '', cleared);
  await p.focus('#f-msg');
  await p.keyboard.type('Is the pool shallow at one end?');

  await p.focus('.enquiry__send');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  s = await p.evaluate(() => ({
    state: document.querySelector('sg-form').dataset.state,
    words: document.querySelector('.sg-form-words').textContent,
    live: document.querySelector('.sg-form-words').getAttribute('aria-live'),
    stamp: document.querySelector('.sg-form-art sg-stamp')?.textContent.replace(/\s+/g, ' ').trim(),
    kept: document.getElementById('f-msg').value,
  }));
  check('a valid enquiry says, politely, that nothing was sent', s.state === 'sent' && s.words.startsWith('Prototype: nothing was sent.') && s.live === 'polite', s.words);
  check('warm: the stamp says "Not sent"', (s.stamp ?? '').startsWith('Not sent'), s.stamp);
  check('the words stay in the form', s.kept === 'Is the pool shallow at one end?');
  check('and nothing left the page: no POST, no sent.html', posts.length === 0, posts.join(', '));
  check('no console or page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── 2. the gate: quiet, reduced motion, JavaScript off ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${URL_}?register=quiet`);
  const look = await p.evaluate(() => ({
    fields: document.querySelectorAll('input, textarea, select').length,
    suggestions: document.querySelectorAll('#f-from-places option').length,
    labelled: [...document.querySelectorAll('input, textarea, select')].every(c => c.labels.length === 1),
    rule: getComputedStyle(document.getElementById('f-name')).borderBottomStyle,
  }));
  check('no JavaScript: every field is there, labelled, on its ruled line', look.fields === 7 && look.suggestions > 0 && look.labelled && look.rule === 'solid', JSON.stringify(look));
  await p.click('.enquiry__send');
  await p.waitForTimeout(300);
  check('no JavaScript: the browser blocks an empty enquiry', new URL(p.url()).pathname.endsWith('/index.html'));
  await p.fill('#f-name', 'Sarat');
  await p.fill('#f-contact', 'sarat@');
  await p.click('.enquiry__send');
  await p.waitForTimeout(300);
  const blocked = await p.evaluate(() => ({ path: location.pathname, bad: document.getElementById('f-contact').validity.patternMismatch }));
  check('no JavaScript: the contact pattern is checked by the browser', blocked.path.endsWith('/index.html') && blocked.bad, JSON.stringify(blocked));
  await p.fill('#f-contact', 'sarat@example.com');
  await p.fill('#f-from', 'Panaji');
  await p.selectOption('#f-group', '4');
  const [req] = await Promise.all([p.waitForRequest(r => r.method() === 'POST'), p.waitForURL(/sent\.html/), p.focus('#f-contact').then(() => p.keyboard.press('Enter'))]);
  const body = req.postData() ?? '';
  const page = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, text: document.body.textContent }));
  check('no JavaScript: a valid enquiry submits, every field included', /name=Sarat/.test(body) && /contact=sarat%40example\.com/.test(body) && /group=4/.test(body) && /from=Panaji/.test(body) && /message=/.test(body), body);
  check('no JavaScript: the page it lands on says nothing was received', page.h1 === 'Not sent: this is a prototype' && page.text.includes('keeps nothing'), page.h1);
  await ctx.close();
}

// ── 4. a number in a person's own numerals (review W2 S4) ──
{
  for (const js of [true, false]) {
    const ctx = await browser.newContext({ javaScriptEnabled: js });
    const p = await ctx.newPage();
    await p.goto(`${URL_}?register=warm`);
    if (js) await p.waitForFunction(() => window.__ready === true);
    await p.fill('#f-name', 'Anjali Kamat');
    if (js) await p.locator('#f-contact').pressSequentially('९८२२० १२३४५', { delay: 10 });
    else await p.fill('#f-contact', '९८२२० १२३४५');
    const v = await p.evaluate(() => { const f = document.getElementById('f-contact'); return { value: f.value, valid: f.validity.valid }; });
    if (js) check('JavaScript: "९८२२० १२३४५" is welcome, and written as 98220 12345', v.valid && v.value === '98220 12345', JSON.stringify(v));
    else check('no JavaScript: "९८२२० १२३४५" passes the pattern as typed', v.valid, JSON.stringify(v));
    await p.fill('#f-contact', '೯೮೨೨೦-೧೨೩೪೫');
    if (js) await p.locator('#f-contact').dispatchEvent('input');
    const k = await p.evaluate(() => { const f = document.getElementById('f-contact'); return { value: f.value, valid: f.validity.valid }; });
    check(`${js ? 'JavaScript' : 'no JavaScript'}: Kannada numerals too`, k.valid && (!js || k.value === '98220-12345'), JSON.stringify(k));
    await ctx.close();
  }
}

// ── 3. importing recipe.js wires nothing; the page's own send is the only answer ──
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  // the demo page, with demo.js swapped for a page that imports recipe.js and mounts nothing
  await p.route('**/packages/recipes/enquiry/demo.js', r => r.fulfill({ contentType: 'text/javascript', body: `
    import * as recipe from './recipe.js';
    window.__exports = Object.keys(recipe).sort();
    customElements.whenDefined('sg-form').then(() => { window.__ready = true; });` }));
  await p.goto(`${URL_}?register=warm`);
  await p.waitForFunction(() => window.__ready === true);
  check('recipe.js exports the pieces', JSON.stringify(await p.evaluate(() => window.__exports)) === JSON.stringify(['STRINGS', 'answer', 'mountEnquiry', 'mountGroupHint']), JSON.stringify(await p.evaluate(() => window.__exports)));
  await p.fill('#f-name', 'Anjali Kamat');
  await p.fill('#f-contact', '98220-12345');
  // nobody answered sg-submit, so <sg-form> lets the form post natively, to sent.html
  const [req] = await Promise.all([p.waitForRequest(r => r.method() === 'POST'), p.waitForURL(/sent\.html/), p.click('.enquiry__send')]);
  check('importing recipe.js mounts no prototype answer: the form posts as the page wrote it', /contact=98220-12345/.test(req.postData() ?? ''), req.postData());
  check('recipe.js alone: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
