// Browser checks for the field note's behaviour. Not a unit test (npm test
// runs the pure core); run it by hand:
//
//   node packages/components/field-note/field-note.check.mjs
//
// Checks: nothing shows while typing into a field the first time; leaving it
// shows the note and wires aria-describedby and aria-invalid; typing a valid
// value clears both at once and keeps other describedby ids; a submit shows
// every note, focuses the first problem and keeps the rest silent; a server
// message shows as written; a hint never marks the field invalid.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const ctx = await browser.newContext();
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${server.url}/tools/harness/blank.html`);
await p.evaluate(async () => {
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field-note/field-note.css">');
  document.body.innerHTML = `
    <form id="f">
      <label for="name">Your name</label>
      <input id="name" required aria-describedby="name-hint"><span id="name-hint">As on your ID.</span>
      <sg-field-note for="name" validate></sg-field-note>
      <label for="email">Email</label>
      <input id="email" type="email" required>
      <sg-field-note for="email" validate></sg-field-note>
      <label for="dates">Dates</label>
      <input id="dates" value="12 to 15 October">
      <sg-field-note for="dates">Those dates are booked.</sg-field-note>
      <label for="phone">Phone</label>
      <input id="phone">
      <sg-field-note for="phone" tone="hint">We only call about this booking.</sg-field-note>
      <label for="arrive">Arriving</label>
      <input id="arrive" type="date" min="2026-10-16" value="2026-10-12">
      <sg-field-note for="arrive" validate></sg-field-note>
      <button id="send">Send</button>
    </form>`;
  document.getElementById('f').addEventListener('submit', e => e.preventDefault());
  await import('/packages/components/field-note/field-note.js');
  await customElements.whenDefined('sg-field-note');
});
const read = sel => p.evaluate(s => {
  const f = document.querySelector(s);
  const n = document.querySelector(`sg-field-note[for="${f.id}"]`);
  return { describedby: f.getAttribute('aria-describedby') ?? '', invalid: f.getAttribute('aria-invalid'), text: n.textContent.trim(), shown: n.hasAttribute('data-shown'), live: n.getAttribute('aria-live'), noteId: n.id };
}, sel);

await p.focus('#email');
await p.keyboard.type('sarat');
let s = await read('#email');
check('typing into a field the first time shows nothing', !s.shown && s.invalid === null, JSON.stringify(s));
await p.keyboard.press('Tab');
await p.waitForTimeout(50);
s = await read('#email');
check('leaving it shows the note, in words, with the tone spoken', s.shown && s.text === 'Error: Enter an email address like name@example.com.', s.text);
check('the field points at the note and is marked invalid', s.describedby.split(' ').includes(s.noteId) && s.invalid === 'true', JSON.stringify(s));
check('a single note is spoken politely', s.live === 'polite');
await p.focus('#email');
await p.keyboard.type('@example.com');
s = await read('#email');
check('a valid value clears the note and both attributes at once', !s.shown && s.invalid === null && !s.describedby.includes(s.noteId) && s.text === '', JSON.stringify(s));

// submit: every note shows, the first problem gets focus, and the notes stay silent (focus reads its own)
await p.fill('#email', '');
await p.click('#send');
await p.waitForTimeout(50);
const name = await read('#name');
const email = await read('#email');
const active = await p.evaluate(() => document.activeElement.id);
check('a submit shows every note', name.shown && email.shown, `${name.text} | ${email.text}`);
check('focus goes to the first problem', active === 'name', active);
check('the field keeps the ids it already had in aria-describedby', name.describedby.split(' ')[0] === 'name-hint' && name.describedby.includes(name.noteId), name.describedby);
check('after a submit the notes do not all speak at once', name.live === 'off' && email.live === 'off', `${name.live}, ${email.live}`);
await p.keyboard.type('Sarat');
const fixed = await read('#name');
check('typing a fix clears it as you go', !fixed.shown && fixed.invalid === null && fixed.describedby === 'name-hint', JSON.stringify(fixed));

const dates = await read('#dates');
check('a server message shows as written and marks the field', dates.shown && dates.text === 'Error: Those dates are booked.' && dates.invalid === 'true', dates.text);
const phone = await read('#phone');
check('a hint is described but never marks the field invalid', phone.shown && phone.describedby.includes(phone.noteId) && phone.invalid === null && phone.text === 'We only call about this booking.', JSON.stringify(phone));

const faces = await p.evaluate(async () => {
  document.documentElement.dataset.register = 'warm';
  const n = document.querySelector('sg-field-note[for="arrive"]');
  await new Promise(r => setTimeout(r, 300));
  const v = n.querySelector('.sg-field-note__value');
  return { hand: getComputedStyle(n).fontFamily.split(',')[0], value: v && getComputedStyle(v).fontFamily.split(',')[0], text: v?.textContent, whole: n.textContent };
});
check('warm: the sentence is in the hand, the example in the body face (a 1 must not read as an l)', /Kalam/.test(faces.hand) && /Mukta/.test(faces.value) && faces.text === '16' && faces.whole === 'Error: Choose 16 October 2026 or later.', JSON.stringify(faces));
const arrive = await read('#arrive');
check('a date limit is said the way people say dates (page lang "en")', arrive.text === 'Error: Choose 16 October 2026 or later.', arrive.text);
await p.evaluate(() => document.querySelector('sg-field-note[for="dates"]').setMessage(''));
const cleared = await read('#dates');
check('setMessage("") clears a server message', !cleared.shown && cleared.invalid === null, JSON.stringify(cleared));
await p.evaluate(() => { document.querySelector('sg-field-note[for="phone"]').hidden = true; });
check('a hidden note is not displayed', await p.evaluate(() => getComputedStyle(document.querySelector('sg-field-note[for="phone"]')).display === 'none'));
check('no console or page errors', errors.length === 0, errors.join(' | '));

// ── R2: in every register a note's words are written once, values and underline included ──
for (const register of ['quiet', 'warm', 'playful']) {
  const q = await ctx.newPage();
  await q.goto(`${server.url}/tools/harness/blank.html`);
  const writes = await q.evaluate(async register => {
    document.documentElement.dataset.register = register;
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field-note/field-note.css">');
    document.body.innerHTML = `<form><label for="ph">Phone</label><input id="ph" pattern="[0-9 ]{10,12}">
      <sg-field-note for="ph" validate data-pattern-mismatch="Use 10 digits, like 98220 12345."></sg-field-note></form>`;
    await import('/packages/components/field-note/field-note.js');
    await customElements.whenDefined('sg-field-note');
    const n = document.querySelector('sg-field-note');
    await new Promise(r => setTimeout(r, 400)); // the skin is loaded
    const batches = [];
    new MutationObserver(ms => batches.push(ms.map(m => m.target.className?.baseVal ?? m.target.className))).observe(n, { childList: true, characterData: true, subtree: true });
    const f = document.getElementById('ph');
    f.value = 'call me'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); f.blur();
    f.dispatchEvent(new FocusEvent('blur'));
    await new Promise(r => setTimeout(r, 400));
    return { batches: batches.length, text: n.textContent, value: [...n.querySelectorAll('.sg-field-note__value')].map(v => v.textContent).join('|'), font: n.querySelector('.sg-field-note__value') ? getComputedStyle(n.querySelector('.sg-field-note__value')).fontWeight : '' };
  }, register);
  check(`${register}: the note's words are written once (R2)`, writes.batches === 1 && writes.text === 'Error: Use 10 digits, like 98220 12345.', JSON.stringify(writes));
  if (register !== 'quiet') check(`${register}: the number to copy is in the body face`, writes.value === '10|98220 12345' && writes.font === '500', JSON.stringify(writes));
  else check('quiet: the number is set like the rest of the words', writes.font !== '500', JSON.stringify(writes));
  await q.close();
}

// ── a note written inside its field's label (review W2 B1): refuse, clear, refuse again ──
{
  const q = await ctx.newPage();
  await q.goto(`${server.url}/tools/harness/blank.html`);
  await q.evaluate(async () => {
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/field-note/field-note.css">');
    document.body.innerHTML = `<form><div style="width:40rem"><label style="display:inline-grid">Departure <input type="date" id="dep" required>
      <sg-field-note for="dep" validate></sg-field-note></label></div><button>Go</button></form>`;
    await import('/packages/components/field-note/field-note.js');
    await customElements.whenDefined('sg-field-note');
  });
  const REFUSAL = 'Stays over Christmas week are at least 4 nights.';
  const state = () => q.evaluate(() => {
    const f = document.getElementById('dep'), n = document.querySelector('sg-field-note');
    return { text: n.textContent, inLabel: !!n.closest('label'), width: Math.round(f.getBoundingClientRect().width) };
  });
  const name = async () => (await q.locator('#dep').ariaSnapshot()).match(/"([^"]*)"/)?.[1] ?? '';
  const refuse = async () => {
    await q.fill('#dep', '2026-12-24');
    await q.evaluate(r => { const f = document.getElementById('dep'); f.setCustomValidity(r); f.dispatchEvent(new Event('change', { bubbles: true })); }, REFUSAL);
    await q.evaluate(() => document.getElementById('dep').blur());
    await q.waitForTimeout(100);
  };
  const before = await state();
  check('a note written inside its label steps out, just after it', !before.inLabel);
  await q.focus('#dep');
  await refuse();
  const first = await state();
  check('refused: the note says the reason once', first.text === `Error: ${REFUSAL}`, first.text);
  check('refused: the field\'s name is just its label', await name() === 'Departure', await name());
  await q.focus('#dep');
  await q.fill('#dep', '');
  await q.evaluate(() => { const f = document.getElementById('dep'); f.setCustomValidity(''); f.dispatchEvent(new Event('change', { bubbles: true })); f.blur(); });
  await q.waitForTimeout(100);
  const cleared = await state();
  check('cleared: "Enter your departure." and nothing else', cleared.text === 'Error: Enter your departure.', cleared.text);
  await q.focus('#dep');
  await refuse();
  const again = await state();
  check('refused again: the reason once, never the old message folded in', again.text === `Error: ${REFUSAL}`, again.text);
  check('refused again: the name is still just the label', await name() === 'Departure', await name());
  check('the input keeps its width through all three', before.width === first.width && first.width === cleared.width && cleared.width === again.width, [before, first, cleared, again].map(s => s.width).join(', '));

  // and the name is built without the note even if a page keeps one inside the label
  const kept = await q.evaluate(async () => {
    const l = document.createElement('label');
    l.innerHTML = 'Arrival <input type="date" id="arr" required><span class="sg-vh">(hidden help)</span><span aria-hidden="true">*</span>';
    document.querySelector('form').prepend(l);
    const n = document.createElement('sg-field-note');
    n.setAttribute('for', 'arr'); n.setAttribute('validate', '');
    l.after(n);
    await new Promise(r => setTimeout(r, 50));
    l.append(n); // moved back in after connecting: the name must still come out clean
    const f = document.getElementById('arr');
    f.focus(); f.blur();
    f.form.requestSubmit();
    await new Promise(r => setTimeout(r, 100));
    return n.textContent;
  });
  check('a note kept inside the label still names the field from the label alone', kept === 'Error: Enter your arrival.', kept);
  await q.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
