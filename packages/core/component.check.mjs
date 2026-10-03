// Browser checks for SgElement and defineComponent. Run by hand or from CI:
//
//   node packages/core/component.check.mjs
//
// Checks: `hidden` hides every component even when its own CSS sets a display,
// and showing it again restores that display.

import { pickEngine } from '../../tools/lib/engine.mjs';
import { startServer } from '../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const p = await browser.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${server.url}/tools/harness/blank.html`);

const out = await p.evaluate(async () => {
  document.documentElement.dataset.register = 'warm';
  // a component whose only stylesheet insists on a display, and no [hidden] rule of its own
  document.head.insertAdjacentHTML('beforeend', '<style>sg-check-x { display: grid; }</style>');
  const { SgElement, defineComponent } = await import('/packages/core/component.js');
  defineComponent('sg-check-x', class extends SgElement {});
  await import('/packages/components/progress/progress.js');
  await import('/packages/components/loader/loader.js');
  document.body.innerHTML = '<sg-check-x hidden>x</sg-check-x>'
    + '<sg-progress hidden label="Upload"><progress value="0.4" max="1"></progress></sg-progress>'
    + '<sg-loader hidden label="Loading"></sg-loader>';
  await new Promise(r => setTimeout(r, 300));
  const shown = [...document.body.children].map(el => [el.localName, getComputedStyle(el).display]);
  document.querySelectorAll('[hidden]').forEach(el => el.removeAttribute('hidden'));
  const after = [...document.body.children].map(el => [el.localName, getComputedStyle(el).display]);
  return { shown, after, rules: [...document.adoptedStyleSheets].flatMap(s => [...s.cssRules].map(r => r.selectorText)) };
});

for (const [tag, d] of out.shown) check(`${tag}[hidden] is not displayed`, d === 'none', d);
for (const [tag, d] of out.after) check(`${tag} shows again when hidden is removed`, d !== 'none', d);
check('one rule per component, no duplicates', new Set(out.rules).size === out.rules.length, out.rules.join(', '));
check('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
