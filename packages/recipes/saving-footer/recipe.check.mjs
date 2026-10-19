// The recipe in a real browser: whatever the footer does, it never touches what
// the person is typing. Types at the end of the notes field in bursts that span
// finished saves, a save in flight, an outage with its error toast, and the
// recovery; then checks the value, the caret and the focus are exactly the person's.
// Also: the gallery stills are silent, and the live connection speaks only when it changes (R3).
// These were unit tests that launched Chromium; as a check they run in the suite, through a slot.
//
//   node packages/recipes/saving-footer/recipe.check.mjs            (chromium)
//   SG_ENGINE=webkit node packages/recipes/saving-footer/recipe.check.mjs

import assert from 'node:assert/strict';
import { harness } from '../../../tools/lib/component-check.mjs';

const { server, browser, check, done } = await harness();
const url = server.url;

/** One scenario: its assertions throw, and the throw is the check's detail (the rest still run). */
async function scenario(name, fn) {
  try { await fn(); check(name, true); } catch (e) { check(name, false, String(e?.message ?? e).split('\n').slice(0, 6).join(' | ')); }
}

await scenario('typing is never disturbed by saving, failing or recovering', async () => {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(`${url}/packages/recipes/saving-footer/index.html?register=warm`);
  await page.waitForFunction(() => window.__ready);
  const status = () => page.locator('#notes [role=status]').first().textContent();

  // every change to the polite line, in order: what a screen reader would hear
  await page.evaluate(() => {
    const line = document.querySelector('#notes .saving-footer__said');
    window.__said = [];
    new MutationObserver(() => window.__said.push(line.textContent)).observe(line, { childList: true, characterData: true, subtree: true });
  });

  const area = page.locator('textarea[name=notes]');
  const start = await area.inputValue();
  await area.focus();
  await area.evaluate(el => { const n = el.value.length; el.setSelectionRange(n, n); });

  const typed = [];
  const type = async text => { typed.push(text); await page.keyboard.type(text, { delay: 40 }); };

  await type(' Late arrival is fine.');
  await page.waitForFunction(() => document.querySelector('#notes [role=status]').textContent.startsWith('Saved at'), null, { timeout: 8000 });
  // start a save, then keep typing while it is in flight
  await type(' Veg');
  await page.waitForFunction(() => !document.querySelector('#notes sg-loader').hidden, null, { timeout: 5000 });
  await type(' only.');
  await page.waitForFunction(() => document.querySelector('#notes [role=status]').textContent.startsWith('Saved at'), null, { timeout: 8000 });

  // the network goes; type through the failure and the error toast
  await page.evaluate(() => document.getElementById('network').click());
  await area.focus(); // the switch took focus, as a real click would; come back to the end
  await area.evaluate(el => { const n = el.value.length; el.setSelectionRange(n, n); });
  await type(' Early breakfast, please.');
  await page.waitForFunction(() => document.querySelector('#notes [role=status]').textContent === 'Not saved', null, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelector('sg-toast[tone=error]'), null, { timeout: 5000 });
  await type(' Thank you.');
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'notes', 'the error toast did not take focus');

  // back online: the footer reconnects and saves by itself while typing goes on
  await page.evaluate(() => document.getElementById('network').click());
  // it was connected before, so the indicator says reconnecting during the handshake
  await page.waitForFunction(() => document.querySelector('#notes sg-connecting [role=status]')?.textContent === 'Connection: reconnecting', null, { timeout: 3000 });
  await area.focus();
  await area.evaluate(el => { const n = el.value.length; el.setSelectionRange(n, n); });
  await type(' See you Friday.');
  await page.waitForFunction(() => document.querySelector('#notes [role=status]').textContent.startsWith('Saved at'), null, { timeout: 12000 });

  const end = await area.evaluate(el => ({ value: el.value, a: el.selectionStart, b: el.selectionEnd, focused: document.activeElement === el }));
  assert.equal(end.value, start + typed.join(''), 'every keystroke landed, in order, at the end');
  assert.equal(end.a, end.value.length, 'the caret is where the person left it');
  assert.equal(end.b, end.value.length);
  assert.ok(end.focused, 'focus never left the field');
  assert.match(await status(), /^Saved at \d\d:\d\d$/);
  assert.deepEqual(problems, []);

  // only outcomes were announced: saved, not saved, saved again; never "Saving" or "Changes not saved yet"
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.length >= 3, `heard: ${JSON.stringify(said)}`);
  for (const line of said) assert.match(line, /^(Saved at \d\d:\d\d|Not saved)$/, `heard: ${JSON.stringify(said)}`);
  assert.ok(said.includes('Not saved') && said.at(-1).startsWith('Saved at'), `heard: ${JSON.stringify(said)}`);
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1], 'nothing is said twice in a row');
});

await scenario('the gallery stills are silent; the live footer still speaks', async () => {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(`${url}/packages/recipes/saving-footer/index.html?register=warm`);
  await page.waitForFunction(() => window.__ready);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-still] sg-connecting')].every(c => c.querySelector('.sg-connecting-words')));
  // live regions a screen reader could hear (anything under aria-hidden is never read)
  const stills = await page.$$eval('[data-still]', els => els.map(el =>
    [...el.querySelectorAll('[role=status], [role=alert], [aria-live]:not([aria-live=off])')]
      .filter(r => !r.closest('[aria-hidden="true"]'))
      .map(r => r.className || r.localName)));
  assert.ok(stills.length >= 7, `found ${stills.length} stills`);
  assert.deepEqual(stills, stills.map(() => []), 'no live region in any still');
  // the connection words in the stills still show, as plain text
  const words = await page.$$eval('[data-still] sg-connecting:not([hidden]) .sg-connecting-words', els => els.map(e => e.textContent));
  for (const w of ['Connection: offline', 'Connection: reconnecting']) assert.ok(words.includes(w), `${w} in ${JSON.stringify(words)}`);
  // the live footer keeps both of its polite lines
  assert.equal(await page.locator('#notes .saving-footer__said[role=status]').count(), 1);
  assert.equal(await page.locator('#notes sg-connecting [role=status]').count(), 1);
  assert.deepEqual(problems, []);
});

await scenario('the live connection is quiet on load and speaks only when it changes (R3)', async () => {
  for (const register of ['quiet', 'warm', 'playful']) {
    const page = await browser.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push(e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
    // every write to a connection's words while its region is live, from the first script on
    await page.addInitScript(() => {
      window.__heard = [];
      new MutationObserver(ms => {
        for (const m of ms) {
          const words = (m.target.nodeType === 3 ? m.target.parentElement : m.target).closest?.('#notes sg-connecting .sg-connecting-words');
          if (words && words.getAttribute('role') === 'status' && words.getAttribute('aria-live') !== 'off') window.__heard.push(words.textContent);
        }
      }).observe(document, { childList: true, characterData: true, subtree: true });
    });
    await page.goto(`${url}/packages/recipes/saving-footer/index.html?register=${register}`);
    await page.waitForFunction(() => window.__ready);
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => window.__heard), [], `${register}: nothing is read out on load`);
    await page.evaluate(() => document.getElementById('network').click());
    // a state wait with a generous ceiling; if it still runs out, say everything the page showed (a CI run lost this wait once and left nothing to go on)
    await page.waitForFunction(() => window.__heard.length > 0, null, { timeout: 20000 }).catch(async e => {
      const seen = await page.evaluate(() => ({ heard: window.__heard, pressed: document.getElementById('network').getAttribute('aria-pressed'), connecting: document.querySelector('#notes sg-connecting')?.outerHTML, footer: document.querySelector('#notes .saving-footer')?.textContent?.trim() })).catch(x => String(x));
      assert.fail(`${register}: nothing was read out within 20 s of turning the network off (${String(e.message).slice(0, 80)}); the page showed ${JSON.stringify(seen)}; page errors ${JSON.stringify(problems)}`);
    });
    const heard = await page.evaluate(() => window.__heard);
    assert.ok(heard.every(t => /^Connection: /.test(t)) && !heard.includes('Connection: connected'), `${register}: heard ${JSON.stringify(heard)}`);
    await page.close();
  }
});

await done();
