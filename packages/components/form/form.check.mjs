// Browser checks for <sg-form>: the page without JavaScript, keyboard submits,
// the problems summary and focus, and the states (sending only while work is
// pending, sent, failed, reset). Run by hand or with `npm run check`:
//
//   node packages/components/form/form.check.mjs

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const CSS = ['tokens/tokens.css', 'components/form/form.css', 'components/field/field.css', 'components/field-note/field-note.css', 'components/loader/loader.css', 'components/stamp/stamp.css', 'components/toast/toast.css']
  .map(h => `<link rel="stylesheet" href="/packages/${h}">`).join('');
const FORM = `
  <sg-form><form id="f" action="/tools/harness/blank.html" method="get">
    <sg-field><label for="name">Your name</label><input id="name" name="name" required></sg-field>
    <sg-field><label for="contact">Phone or email</label><input id="contact" name="contact" type="email" required></sg-field>
    <sg-field><label for="msg">Anything else (optional)</label><textarea id="msg" name="message"></textarea></sg-field>
    <button id="send">Send</button> <button type="reset" id="clear">Clear</button>
  </form></sg-form>`;

async function open({ js = true, register = 'warm' } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.route('**/form-check.html', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8">${CSS}</head><body>${FORM}</body></html>` }));
  await p.goto(`${server.url}/form-check.html`);
  if (js) {
    await p.evaluate(async () => {
      await import('/packages/components/field/field.js');
      await import('/packages/components/form/form.js');
      await customElements.whenDefined('sg-form');
      window.states = [];
      document.querySelector('sg-form').addEventListener('sg-form-state', e => window.states.push(e.detail.state));
    });
    await p.waitForTimeout(100);
  }
  return { ctx, p, errors };
}
const status = p => p.evaluate(() => {
  const v = document.querySelector('.sg-form-words');
  return { text: v.textContent, live: v.getAttribute('aria-live'), state: document.querySelector('sg-form').dataset.state, art: document.querySelector('.sg-form-art').firstElementChild?.localName ?? null };
});

// ── without JavaScript: the browser validates and submits ──
{
  const { ctx, p } = await open({ js: false });
  await p.click('#send');
  await p.waitForTimeout(300);
  const blocked = await p.evaluate(() => ({ path: location.pathname, invalid: document.querySelectorAll(':invalid').length }));
  check('no JavaScript: an empty required field stops the submit', blocked.path === '/form-check.html' && blocked.invalid >= 2, JSON.stringify(blocked));
  await p.fill('#name', 'Sarat');
  await p.fill('#contact', 'sarat@example.com');
  await p.focus('#contact');
  await Promise.all([p.waitForURL(/blank\.html\?/), p.keyboard.press('Enter')]);
  const q = new URL(p.url()).searchParams;
  check('no JavaScript: Enter submits a valid form, every field included', q.get('name') === 'Sarat' && q.get('contact') === 'sarat@example.com' && q.has('message'), p.url().split('?')[1]);
  await ctx.close();
}

// ── with JavaScript: problems ──
{
  const { ctx, p, errors } = await open();
  const notes = await p.evaluate(() => [...document.querySelectorAll('sg-field-note[validate]')].map(n => n.getAttribute('for')));
  check('every field that validates gets a field note', ['name', 'contact', 'msg'].every(id => notes.includes(id)), notes.join(','));
  check('the browser bubbles give way to the notes (novalidate is set by script)', await p.evaluate(() => document.getElementById('f').noValidate));
  await p.focus('#contact');
  await p.keyboard.type('sarat@');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(100);
  const s = await status(p);
  const focus = await p.evaluate(() => document.activeElement.id);
  check('a submit with problems counts and names them', s.text === 'Check 2 fields: Your name, Phone or email.' && s.state === 'invalid', s.text);
  check('focus goes to the first problem, whose note it reads; the summary stays silent', focus === 'name' && s.live === 'off', `${focus}, live=${s.live}`);
  check('nothing was submitted', await p.evaluate(() => location.pathname) === '/form-check.html');
  check('no console or page errors (problems)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── with JavaScript: a quick answer never shows "sending"; a slow one does; a second submit is ignored ──
{
  const { ctx, p, errors } = await open();
  await p.fill('#name', 'Sarat'); await p.fill('#contact', 'sarat@example.com');
  await p.evaluate(() => {
    window.calls = 0;
    window.answer = () => Promise.resolve({ message: 'Sent. We will write back within a day.' });
    document.querySelector('sg-form').addEventListener('sg-submit', e => { window.calls++; e.detail.respondWith(window.answer()); });
  });
  await p.click('#send');
  await p.waitForTimeout(400);
  let s = await status(p);
  const quick = await p.evaluate(() => window.states.join(','));
  check('a quick answer goes straight to sent: no loader flashes', quick === 'sent' && s.state === 'sent', quick);
  check('sent is said politely, in words', s.text === 'Sent. We will write back within a day.' && s.live === 'polite', s.text);
  check('warm: a Stamp lands for "sent"', s.art === 'sg-stamp', s.art);

  await p.evaluate(() => { window.states.length = 0; window.answer = () => new Promise(r => setTimeout(() => r({}), 600)); });
  await p.click('#send');
  await p.waitForTimeout(250);
  s = await status(p);
  const busy = await p.evaluate(() => ({ disabled: document.getElementById('send').getAttribute('aria-disabled'), busy: document.getElementById('f').hasAttribute('aria-busy') }));
  check('slow work says "sending", with a Loader, and the button says it is busy', s.state === 'sending' && s.text === 'Sending your message.' && s.art === 'sg-loader' && busy.disabled === 'true' && busy.busy, JSON.stringify({ ...s, ...busy }));
  await p.click('#send', { force: true });
  await p.waitForTimeout(600);
  s = await status(p);
  check('a second submit while sending is ignored', await p.evaluate(() => window.calls) === 2, `calls=${await p.evaluate(() => window.calls)}`);
  check('then it settles to sent, and the button is free again', s.state === 'sent' && await p.evaluate(() => !document.getElementById('send').hasAttribute('aria-disabled')));

  await p.evaluate(() => { window.answer = () => Promise.reject(new Error("the house's inbox is not answering")); });
  await p.focus('#send');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  s = await status(p);
  const toast = await p.evaluate(() => document.querySelector('.sg-toast-live[role=alert]')?.textContent ?? '');
  check('a failure says what happened and that the words are kept', s.state === 'failed' && s.text.startsWith("Couldn't send: the house's inbox is not answering.") && s.live === 'off', s.text);
  check('the failure is also an error toast (an alert), said once', toast.includes("Error: Couldn't send. The house's inbox is not answering. Your words are still in the form."), toast);
  check('focus stays where it was, and the words are still in the form', await p.evaluate(() => document.activeElement.id === 'send' && document.getElementById('name').value === 'Sarat'));

  await p.click('#clear');
  await p.waitForTimeout(100);
  s = await status(p);
  check('reset clears the state and its words', s.state === 'idle' && s.text === '' && s.art === null, JSON.stringify(s));
  check('no console or page errors (states)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── with JavaScript and no handler: the browser submits as usual ──
{
  const { ctx, p } = await open({ register: 'quiet' });
  await p.fill('#name', 'Sarat'); await p.fill('#contact', 'sarat@example.com');
  await Promise.all([p.waitForURL(/blank\.html\?/), p.click('#send')]);
  check('with no handler, a valid form still submits natively', new URL(p.url()).searchParams.get('name') === 'Sarat');
  await ctx.close();
}

// ── fetch: the form posts itself ──
{
  const { ctx, p } = await open({ register: 'quiet' });
  await p.evaluate(() => document.querySelector('sg-form').setAttribute('fetch', ''));
  await p.fill('#name', 'Sarat'); await p.fill('#contact', 'sarat@example.com');
  const [req] = await Promise.all([p.waitForRequest(r => r.url().includes('blank.html?')), p.click('#send')]);
  await p.waitForTimeout(300);
  const s = await status(p);
  check('with `fetch`, the form sends itself and stays on the page', req.url().includes('name=Sarat') && s.state === 'sent' && new URL(p.url()).pathname === '/form-check.html', s.state);
  check('quiet: the states are words only, nothing drawn', s.art === null && s.text === 'Sent.', JSON.stringify(s));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
