// Browser checks for <sg-select>: the no-JavaScript path, the keyboard, and what a
// screen reader is given. The select is the browser's own, so these checks mostly
// prove the enhancement took nothing away. Run by hand or with `npm run check`:
//
//   node packages/components/select/select.check.mjs

import { engineName, pickEngine, unsupportedIn } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const engine = engineName();
const browser = await pickEngine(engine).launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/components/select/demo.html`;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open({ js = true, register = 'warm', reduced = false } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}?register=${register}`);
  if (js) await page.waitForFunction(() => window.__ready === true && document.querySelector('sg-select')?.dataset.skin);
  return { page, ctx, errors };
}

// ── without JavaScript ──
{
  const { page, ctx } = await open({ js: false });
  await page.click('button[type=submit]');
  check('no JS: an unchosen required room stops the form', await page.evaluate(() => !location.search.includes('room=') && document.querySelector('#room').matches(':invalid')));
  await page.selectOption('#room', 'quintal');
  await page.selectOption('#guests', '3');
  await Promise.all([page.waitForURL(/room=/), page.click('button[type=submit]')]);
  const q = new URL(page.url()).searchParams;
  check('no JS: the form submits the chosen values', q.get('guests') === '3' && !!q.get('room') && q.get('lang') === 'en', page.url().split('?')[1]);
  check('no JS: the disabled select is not sent', !q.has('season'));
  await ctx.close();
}

// ── with JavaScript: nothing native is lost ──
{
  const { page, ctx, errors } = await open();
  const tree = await page.locator('main').ariaSnapshot();
  check('screen readers get a combobox named by its label, with its value', /combobox "Guests"/.test(tree) && /combobox "Room"/.test(tree), tree.split('\n').filter(l => l.includes('combobox')).join(' | '));
  check('the disabled select says so', /combobox "Season" \[disabled\]/.test(tree));
  check('the hint is its description', await page.evaluate(() => document.querySelector('#season').getAttribute('aria-describedby') === 'season-hint'));
  check('the select is still the native element, not a rebuilt listbox', await page.evaluate(() => document.querySelector('#guests') instanceof HTMLSelectElement && !document.querySelector('[role=listbox]')));

  await page.keyboard.press('Tab');
  check('Tab reaches the first select', await page.evaluate(() => document.activeElement.id) === 'guests');
  await page.keyboard.press('Tab');
  await page.keyboard.press(' ');
  await wait(200);
  check('Space opens the picker', await page.evaluate(() => document.querySelector('#room').matches(':open')));
  if (engine === 'firefox') {
    // Confirmed directly, 2026-09-28: Firefox opens the native picker on
    // Space (the check above passes), but ArrowDown/Enter inside it neither
    // move the selection nor close it -- focus stays on the <select> itself,
    // value stays empty. A real gap in Firefox's support for keyboard
    // navigation inside an open, CSS-customised native <select> (the
    // Customizable Select feature), not a Susegad bug: the select is
    // entirely native here. The rest of this block still needs a chosen
    // value to test the drawing and the form, so it's set with
    // selectOption() (a real, if not keyboard, interaction) instead.
    unsupportedIn(engine, 'arrow-key navigation inside an open native <select> picker', 'ArrowDown/Enter do not move the selection or close the popover');
    await page.keyboard.press('Escape');
    await wait(150);
    await page.selectOption('#room', { index: 1 });
  } else {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await wait(200);
    check('the arrows and Enter choose, and the picker closes', await page.inputValue('#room') !== '' && !(await page.evaluate(() => document.querySelector('#room').matches(':open'))), await page.inputValue('#room'));
    check('focus comes back to the select', await page.evaluate(() => document.activeElement.id) === 'room');
    await page.keyboard.press(' ');
    await wait(150);
    await page.keyboard.press('Escape');
    await wait(150);
    check('Escape closes the picker without changing the choice', !(await page.evaluate(() => document.querySelector('#room').matches(':open'))) && await page.inputValue('#room') !== '');
  }
  const warm = await page.evaluate(() => {
    const at = id => document.querySelector(`#${id}`).closest('sg-select');
    const shown = id => getComputedStyle(at(id).querySelector('.sg-rule__ink')).display !== 'none';
    return { room: shown('room'), guests: shown('guests'), pencil: at('guests').querySelectorAll('.sg-rule__pencil path').length, border: getComputedStyle(at('guests').querySelector('select')).borderTopColor };
  });
  check('warm rests on a pencil rule, with no box', warm.pencil === 2 && warm.border === 'rgba(0, 0, 0, 0)', JSON.stringify(warm));
  check('warm inks the rule under a chosen value only', warm.room && !warm.guests, JSON.stringify(warm));
  await page.click('button[type=submit]');
  check('the form still gets the value', (await page.textContent('#sent')).includes('room='));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion and every register ──
for (const register of ['quiet', 'warm', 'playful']) {
  const { page, ctx, errors } = await open({ register, reduced: true });
  await page.focus('#guests');
  if (engine === 'firefox') {
    unsupportedIn(engine, 'arrow-key navigation inside an open native <select> picker', 'see the with-JavaScript block above');
    await page.selectOption('#guests', '3');
    const closed = await page.evaluate(() => [...document.querySelectorAll('select')].every(s => !s.matches(':open')));
    check(`${register}, reduced motion: choose (via selectOption, not the keyboard), every other picker stays closed`, await page.inputValue('#guests') === '3' && closed && errors.length === 0, errors.join(' | '));
  } else {
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await wait(150);
    const closed = await page.evaluate(() => [...document.querySelectorAll('select')].every(s => !s.matches(':open')));
    check(`${register}, reduced motion: choose by keyboard, every other picker stays closed`, await page.inputValue('#guests') === '3' && closed && errors.length === 0, errors.join(' | '));
  }
  await ctx.close();
}

await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
