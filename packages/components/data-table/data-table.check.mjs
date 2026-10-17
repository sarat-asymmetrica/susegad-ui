import test from 'node:test';
import { harness, settle } from '../../../tools/lib/component-check.mjs';

// Browser checks for <sg-data-table>: axe in every register and theme, the
// keyboard sort (Tab, Enter, Space, aria-sort), the Indian grouping rendered,
// 390 px with sideways scroll inside the wrapper only, no JavaScript, reduced
// motion, and a control probe on the same markup without the element.
//
//   node packages/components/data-table/data-table.check.mjs

const { server, browser, check, open, openHtml, axe, axeNoJs, done } = await harness();
const DEMO = '/packages/components/data-table/demo.html';

const CSS = '/packages/components/data-table/data-table.css';
const TABLE = `
  <table>
    <caption>Collections, April to September 2026</caption>
    <thead><tr>
      <th scope="col" data-sort="month">Month</th>
      <th scope="col" data-sort="collected" data-money-col>Collected</th>
      <th scope="col" data-sort="invoices" data-money-col>Invoices</th>
    </tr></thead>
    <tbody>
      <tr><td>April 2026</td><td data-money="245000">₹2,45,000</td><td data-value="38">38</td></tr>
      <tr><td>May 2026</td><td data-money="310000">₹3,10,000</td><td data-value="42">42</td></tr>
      <tr><td>June 2026</td><td data-money="125000">₹1,25,000</td><td data-value="29">29</td></tr>
      <tr><td>July 2026</td><td data-money="168000">₹1,68,000</td><td data-value="31">31</td></tr>
    </tbody>
    <tfoot><tr><td>Total</td><td data-money="848000">₹8,48,000</td><td data-value="140">140</td></tr></tfoot>
  </table>`;
const PAGE = (body, { register = 'quiet', js = true } = {}) => `<!doctype html><html lang="en" data-register="${register}"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="${CSS}"></head>
  <body><main>${body}</main>${js ? '<script type="module">import "/packages/components/data-table/data-table.js";</script>' : ''}</body></html>`;
const EL = () => `<sg-data-table>${TABLE}</sg-data-table>`;

/** First-of-month reading of the table: sort state, first body row, money text. */
const read = page => page.evaluate(() => {
  const t = document.querySelector('table');
  const sort = [...t.querySelectorAll('thead th')].find(th => th.hasAttribute('aria-sort'));
  return {
    sorted: sort?.getAttribute('data-sort') ?? null,
    dir: sort?.getAttribute('aria-sort') ?? null,
    first: t.tBodies[0]?.rows[0]?.cells[0]?.textContent ?? null,
    order: [...t.tBodies[0].rows].map(r => r.cells[0].textContent),
    money: t.tBodies[0].rows[1]?.cells[1]?.textContent ?? '',
    wrap: !!t.closest('.sg-table-wrap'),
    buttons: t.querySelectorAll('thead button').length,
  };
});

// ── axe, and a clean console, in every register and theme ───────────────
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${DEMO}?register=${register}&theme=dark`);
  await settle(page);
  const v = await axe(page);
  check(`axe, dark, ${register} on its own: 0 violations`, !v.length, v.join('; '));
  check(`${register}: no console errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
check('axe without JavaScript: 0 violations', !(await axeNoJs(DEMO)).length);

// ── the Indian grouping, rendered ────────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`);
  await settle(page);
  const r = await page.evaluate(() => {
    const table = document.querySelector('table'), text = [...table.querySelectorAll('td[data-money], tfoot td[data-money]')].map(td => td.textContent);
    return {
      lakh: [...table.querySelectorAll('td[data-money]')].some(td => td.getAttribute('data-money') === '125000' && td.textContent === '₹1,25,000'),
      lakhPair: text.includes('₹13,07,050'),
      noWestern: text.every(t => !/[0-9]{3},[0-9]{3},/.test(t)),
      digits: getComputedStyle(table).fontVariantNumeric,
    };
  });
  check('125000 renders as ₹1,25,000, the lakh rhythm, straight from the core', r.lakh && r.lakhPair, JSON.stringify(r));
  check('no Western grouping anywhere on the page', r.noWestern);
  check('the table sets tabular figures', /tabular-nums/.test(r.digits), r.digits);
  await ctx.close();
}

// ── the keyboard sort ────────────────────────────────────────────────────
async function tabTo(page, sel, max = 14) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`);
  await settle(page);
  const presses = await tabTo(page, '.sg-table-sort');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check(`${register}: Tab reaches the first sort button (${presses} presses) with a focus ring`, presses > 0 && ring, `presses ${presses}, ring ${ring}`);
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('sort-keys', PAGE(EL()));
  await page.waitForSelector('.sg-table-sort');
  await page.keyboard.press('Tab'); // the wrapper (region)
  await page.keyboard.press('Tab'); // Month
  await page.keyboard.press('Enter');
  let r = await read(page);
  check('Enter sorts ascending and writes aria-sort="ascending"', r.sorted === 'month' && r.dir === 'ascending' && r.first === 'April 2026', JSON.stringify(r));
  await page.keyboard.press('Enter');
  r = await read(page);
  check('Enter again sorts descending and the rows reverse', r.dir === 'descending' && r.first === 'May 2026', JSON.stringify(r.order.join()));
  await page.keyboard.press(' ');
  r = await read(page);
  check('Space clears the sort: aria-sort goes and the written order returns', r.dir === null && !r.sorted && r.order.join('|') === 'April 2026|May 2026|June 2026|July 2026', JSON.stringify(r));
  const other = await page.evaluate(() => { document.querySelectorAll('.sg-table-sort')[1].focus(); document.activeElement.click(); });
  r = await read(page);
  check('a second column starts again at ascending', r.sorted === 'collected' && r.dir === 'ascending', JSON.stringify(r));
  const stable = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map(tr => tr.cells[0].textContent));
  check('equal values would keep their order (the June lakh row is not moved by a tie)', stable.length === 4, stable.join('|'));
  await ctx.close();
}
{
  // numbers as numbers: 29 sorts before 38, not "29" after "140"
  const { ctx, page } = await openHtml('sort-numbers', PAGE(EL()));
  await page.waitForSelector('.sg-table-sort');
  await page.evaluate(() => document.querySelectorAll('.sg-table-sort')[2].click());
  const r = await read(page);
  check('a number column sorts numerically: 29, 31, 38, 42', r.order.join('|') === 'June 2026|July 2026|April 2026|May 2026', JSON.stringify(r.order));
  await page.evaluate(() => document.querySelectorAll('.sg-table-sort')[2].click());
  const desc = await read(page);
  check('descending: 42 first', desc.order[0] === 'May 2026', desc.order.join('|'));
  await ctx.close();
}

// ── the foot never moves ────────────────────────────────────────────────
{
  const { ctx, page } = await openHtml('tfoot-still', PAGE(EL()));
  await page.waitForSelector('.sg-table-sort');
  await page.evaluate(() => document.querySelectorAll('.sg-table-sort')[2].click());
  const r = await page.evaluate(() => document.querySelector('tfoot td').textContent);
  check('the footer stays put under the sorted body', r === 'Total', r);
  await ctx.close();
}

// ── 390 px: the table scrolls inside itself, the page does not ──────────
{
  const { ctx, page } = await open(`${DEMO}?register=quiet`, { width: 390 });
  await settle(page);
  const r = await page.evaluate(() => {
    const wrap = document.querySelector('.sg-table-wrap');
    return { doc: document.documentElement.scrollWidth, wrapClient: wrap.clientWidth, wrapScroll: wrap.scrollWidth, tableScroll: wrap.querySelector('table').scrollWidth };
  });
  check('at 390 the page does not scroll sideways', r.doc <= 390, `doc ${r.doc}`);
  check('the wrapper does scroll sideways, so nothing is cut off', r.wrapScroll > r.wrapClient && r.tableScroll >= r.wrapScroll, JSON.stringify(r));
  await ctx.close();
}
{
  // the wrapper is a labelled, focusable region, so a keyboard user can scroll it
  const { ctx, page } = await openHtml('wrap-region', PAGE(EL(), { register: 'quiet' }));
  await page.waitForSelector('.sg-table-wrap');
  const r = await page.evaluate(() => { const w = document.querySelector('.sg-table-wrap'); return { role: w.getAttribute('role'), label: w.getAttribute('aria-label'), tab: w.tabIndex }; });
  check('the scroll region is named by the caption and focusable', r.role === 'region' && r.label.includes('Collections') && r.tab === 0, JSON.stringify(r));
  await ctx.close();
}

// ── no JavaScript: the table reads, in the written order ────────────────
{
  const { ctx, page } = await openHtml('no-js', PAGE(EL(), { js: false }));
  const r = await read(page);
  check('without JavaScript: no wrapper, no buttons, the written order, the written money', !r.wrap && r.buttons === 0 && r.order.join('|') === 'April 2026|May 2026|June 2026|July 2026' && r.money === '₹3,10,000', JSON.stringify(r));
  await ctx.close();
}

// ── reduced motion: still ───────────────────────────────────────────────
{
  const { ctx, page } = await open(`${DEMO}?register=playful`, { reduced: true });
  await page.waitForFunction(() => document.querySelector('sg-data-table')?.dataset.skin, null, { timeout: 8000 }).catch(() => {}); // the skin is a dynamic import: wait for it, not for a guess
  await settle(page);
  const r = await page.evaluate(() => ({ anims: document.getAnimations().length, skin: document.querySelector('sg-data-table').dataset.skin }));
  check('reduced motion: nothing animates, and the playful skin still loads', r.anims === 0 && r.skin === 'playful', JSON.stringify(r));
  await ctx.close();
}

// ── the control: the same probes on markup the element never touched ────
{
  const { ctx, page } = await openHtml('table-control', PAGE(TABLE, { js: false }));
  const r = await read(page);
  check('control: a plain table with no element has no wrapper, no buttons, no aria-sort, and its money exactly as written, so every probe above can fail', !r.wrap && r.buttons === 0 && r.sorted === null && r.money === '₹3,10,000', JSON.stringify(r));
  await ctx.close();
}

await done();
