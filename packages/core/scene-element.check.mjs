// Browser checks for <sg-scene> behaviour a Node test cannot reach. Run by hand or from CI:
//
//   node packages/core/scene-element.check.mjs
//
// Checks: a scene whose name arrives after it connects still mounts, once; a
// name that arrives before the scene module loads mounts when it loads; a name
// change swaps the scene; a scene with no name ever stays quiet.

import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const p = await browser.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${server.url}/tools/harness/blank.html`);

const out = await p.evaluate(async () => {
  const ready = el => new Promise(r => { const t = setTimeout(() => r(false), 8000); el.addEventListener('sg-ready', () => { clearTimeout(t); r(true); }, { once: true }); });
  const canvases = el => el.shadowRoot.querySelectorAll('.stage canvas').length;
  await import('/packages/core/index.js');
  const res = {};

  // 1. connected with no name, name set afterwards
  const a = document.createElement('sg-scene');
  document.body.append(a);
  await new Promise(r => setTimeout(r, 50));
  res.quietWithoutName = canvases(a) === 0;
  const aReady = ready(a);
  a.setAttribute('name', 'kolam');
  await import('/packages/scenes/kolam/index.js');
  res.lateName = await aReady;
  await new Promise(r => setTimeout(r, 50));
  res.lateNameOneCanvas = canvases(a);

  // 2. name set while connected, before its scene module has loaded
  const b = document.createElement('sg-scene');
  document.body.append(b);
  const bReady = ready(b);
  b.setAttribute('name', 'paus');
  await import('/packages/scenes/paus/index.js');
  res.nameBeforeModule = await bReady;

  // 3. a name change swaps the scene
  const aAgain = ready(a);
  a.setAttribute('name', 'paus');
  const before = a.meta?.title;
  res.swapped = (await aAgain) && !!a.meta && a.meta.title !== 'The threshold at dawn';
  res.swappedFrom = before;
  await new Promise(r => setTimeout(r, 50));
  res.swappedOneCanvas = canvases(a);
  return res;
});

check('a scene with no name stays quiet', out.quietWithoutName);
check('a name set after connecting mounts the scene', out.lateName);
check('it mounts once (one canvas)', out.lateNameOneCanvas === 1, `canvases: ${out.lateNameOneCanvas}`);
check('a name set before the scene module loads mounts when it loads', out.nameBeforeModule);
check('changing the name swaps the scene', out.swapped);
check('the swap leaves one canvas', out.swappedOneCanvas === 1, `canvases: ${out.swappedOneCanvas}`);
check('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
await server.close();
if (results.some(r => !r.ok)) process.exit(1);
