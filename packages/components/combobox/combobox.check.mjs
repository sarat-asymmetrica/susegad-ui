// Browser checks for <sg-combobox>: the no-JavaScript path, the keyboard (ARIA
// APG editable combobox, list autocomplete), what a screen reader is given, and
// matching across spellings and scripts. Run by hand or with `npm run check`:
//
//   node packages/components/combobox/combobox.check.mjs

import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/components/combobox/demo.html`;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open({ js = true, register = 'warm', reduced = false } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}?register=${register}`);
  if (js) await page.waitForFunction(() => window.__ready === true && document.querySelector('sg-combobox')?.dataset.skin);
  return { page, ctx, errors };
}

// ── without JavaScript: the browser's own <input list> + <datalist>, submitted by the form ──
{
  const { page, ctx } = await open({ js: false });
  check('no JS: the input keeps its datalist', await page.getAttribute('#from', 'list') === 'cities');
  check('no JS: the input is a plain textbox (the browser adds its own suggestions)', (await page.locator('#from').ariaSnapshot()).includes('combobox') || (await page.locator('#from').ariaSnapshot()).includes('textbox'));
  await page.click('button[type=submit]');
  check('no JS: an empty required city stops the form', await page.evaluate(() => !location.search.includes('from=') && document.querySelector('#from').matches(':invalid')));
  await page.fill('#from', 'Mumbai');
  await page.fill('#stay', 'Balcão, Siolim');
  await Promise.all([page.waitForURL(/from=/), page.click('button[type=submit]')]);
  const q = new URL(page.url()).searchParams;
  check('no JS: the form submits what was typed', q.get('from') === 'Mumbai' && q.get('stay') === 'Balcão, Siolim', page.url().split('?')[1]);
  await ctx.close();
}

// ── with JavaScript: the APG pattern ──
{
  const { page, ctx, errors } = await open();
  const input = page.locator('#from');
  const attr = n => input.getAttribute(n);
  check('the input becomes a combobox with a list popup', await attr('role') === 'combobox' && await attr('aria-autocomplete') === 'list' && await attr('aria-expanded') === 'false' && !(await attr('list')));
  const controls = await attr('aria-controls');
  check('it controls a listbox named by the label', await page.evaluate(id => { const l = document.getElementById(id); return l?.getAttribute('role') === 'listbox' && document.getElementById(l.getAttribute('aria-labelledby'))?.textContent === 'Travelling from'; }, controls));

  await page.keyboard.press('Tab');
  check('Tab reaches the input', await page.evaluate(() => document.activeElement.id) === 'from');
  await page.keyboard.type('mum');
  check('typing opens the list, with no option chosen for the person', await attr('aria-expanded') === 'true' && !(await attr('aria-activedescendant')));
  const sugg = await page.evaluate(() => document.querySelector('#from').closest('sg-combobox').suggestions);
  check('"mum" suggests Mumbai, then Navi Mumbai', JSON.stringify(sugg) === '["Mumbai","Navi Mumbai"]', sugg.join(', '));
  await wait(600);
  check('the number of suggestions is said politely, once', await page.locator('sg-combobox .sg-combobox__status').first().textContent() === '2 suggestions');

  const tree = await page.locator('sg-combobox').first().ariaSnapshot();
  check('the screen-reader tree: an expanded combobox and a listbox of options', /combobox "Travelling from"[^\n]*\[expanded\]/.test(tree) && /listbox "Travelling from"/.test(tree) && /option "Mumbai Maharashtra"/.test(tree), tree.replace(/\n/g, ' | ').slice(0, 220));

  await page.keyboard.press('ArrowDown');
  const first = await attr('aria-activedescendant');
  check('Down Arrow moves to the first option, focus stays in the input', !!first && await page.evaluate(id => document.getElementById(id)?.getAttribute('aria-selected') === 'true' && document.activeElement.id === 'from', first));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  check('Down Arrow wraps from the last option to the first', await attr('aria-activedescendant') === first);
  await page.keyboard.press('ArrowUp');
  check('Up Arrow wraps back to the last', (await attr('aria-activedescendant')).endsWith('-1'));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  check('Enter chooses the option and closes the list', await input.inputValue() === 'Mumbai' && await attr('aria-expanded') === 'false' && !(await attr('aria-activedescendant')));

  await page.keyboard.press('ArrowDown');
  check('Down Arrow opens the list again', await attr('aria-expanded') === 'true');
  await page.keyboard.press('Escape');
  check('Escape closes the list and keeps the text', await attr('aria-expanded') === 'false' && await input.inputValue() === 'Mumbai');
  await page.keyboard.press('Escape');
  check('Escape again clears the text', await input.inputValue() === '');

  await page.keyboard.type('Bombay');
  const via = await page.evaluate(() => [...document.querySelectorAll('#' + document.querySelector('#from').getAttribute('aria-controls') + ' [role=option]')].map(o => o.textContent));
  check('an older name finds the place, and says so', via[0] === 'Mumbai also Bombay', via.join(' | '));
  await page.fill('#from', '');
  await page.keyboard.type('मुं');
  check('Devanagari finds Mumbai', (await page.evaluate(() => document.querySelector('#from').closest('sg-combobox').suggestions))[0] === 'Mumbai');
  await page.keyboard.press('Tab');
  check('Tab closes the list and moves on without choosing', await attr('aria-expanded') === 'false' && await input.inputValue() === 'मुं' && await page.evaluate(() => document.activeElement.id) === 'stay');

  await page.keyboard.type('Balcao');
  check('"Balcao" finds "Balcão"', (await page.evaluate(() => document.querySelector('#stay').closest('sg-combobox').suggestions))[0] === 'Balcão, Siolim');
  const marked = await page.evaluate(() => document.querySelector(`#${document.querySelector('#stay').getAttribute('aria-controls')} mark`)?.textContent);
  check('the matched letters are marked, accents and all', marked === 'Balcão', marked);
  await page.keyboard.press('Escape');
  await page.fill('#stay', 'Goa Velha, by the church');
  await page.fill('#from', 'Pune');
  await page.locator('#stay').press('Enter');
  await wait(100);
  const sent = await page.textContent('#sent');
  check('a place not in the list is kept, and Enter submits the form', sent.includes('stay=Goa+Velha') && sent.includes('from=Pune'), sent);

  await page.click('#from');
  const clicked = await attr('aria-expanded');
  await page.click('#' + (await page.evaluate(() => document.querySelector(`#${document.querySelector('#from').getAttribute('aria-controls')} [role=option]`).id)));
  check('a pointer can open the list and choose', clicked === 'true' && await input.inputValue() === 'Pune' && await attr('aria-expanded') === 'false');
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion and every register: the same behaviour, no errors ──
for (const register of ['quiet', 'warm', 'playful']) {
  const { page, ctx, errors } = await open({ register, reduced: true });
  await page.click('#from');
  await page.keyboard.type('ben');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check(`${register}, reduced motion: choose by keyboard`, await page.inputValue('#from') === 'Bengaluru' && errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── S5: warm is written on the paper; playful is a stamped box ──
{
  const { page, ctx, errors } = await open({ register: 'warm' });
  const rest = await page.evaluate(() => {
    const host = document.querySelector('#from').closest('sg-combobox');
    return { pencil: host.querySelectorAll('.sg-rule__pencil path').length, border: getComputedStyle(host.querySelector('input')).borderTopColor, strokes: host.querySelectorAll('.sg-combobox__caret path').length };
  });
  check('warm rests on a pencil rule with no box, and the caret is two pencil strokes', rest.pencil === 2 && rest.border === 'rgba(0, 0, 0, 0)' && rest.strokes === 2, JSON.stringify(rest));
  await page.click('#from');
  await page.keyboard.type('mum');
  await page.keyboard.press('ArrowDown');
  const live = await page.evaluate(() => {
    const host = document.querySelector('#from').closest('sg-combobox');
    const active = host.querySelector('[aria-selected="true"]');
    return {
      ink: getComputedStyle(host.querySelector('.sg-rule__ink')).display !== 'none',
      fill: getComputedStyle(active).backgroundColor,
      underline: getComputedStyle(active.querySelector('.sg-combobox__value'), '::after').content !== 'none',
      rules: getComputedStyle(host.querySelector('[role="option"]'), '::before').content !== 'none',
    };
  });
  check('warm: focus inks the rule; the active suggestion is underlined in ink, not filled; pencil rules between', live.ink && live.fill === 'rgba(0, 0, 0, 0)' && live.underline && live.rules, JSON.stringify(live));
  check('warm: no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
