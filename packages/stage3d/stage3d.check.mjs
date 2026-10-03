// Browser check for the stage3d tier: a page that shows no live 3D downloads no three.js (decision 0017).
//
//   node packages/stage3d/stage3d.check.mjs           (or: npm run check)
//   node packages/stage3d/stage3d.check.mjs --break   (a page imports three on purpose: the no-3D checks must FAIL)
//
// The request log is the instrument: every request of every page is recorded and matched against
// three's files. To prove the instrument can see three, the same detector is run on a page that does
// draw live (the depth photo, warm, on the GPU), and that run must count at least one request.
//
//  1. scene pages (Paus, Tinto) and the docs home, warm: no request for three.
//  2. the depth photo in quiet: the 2D tier, no request for three.
//  3. the depth photo in warm with reduced motion: the 2D tier, no request for three.
//  4. the depth photo in warm with WebGL disabled: the 2D tier, no request for three.
//  5. control: the depth photo in warm on the GPU: the live tier asks for three (so the detector works).

import { session, openTarget, waitReady } from '../../tools/lib/browser.mjs';

const BREAK = process.argv.includes('--break');
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const DEMO = '/packages/stage3d/depth-photo/demo.html';
const THREE = /\/node_modules\/three\/|three\.named\.js|\/three(\.module|\.core)?\.js/;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

/**
 * Open a page with every request recorded. openTarget navigates before it returns, so the recording
 * listener (and an optional init script) go on the context as it is made.
 * @returns {{ context, page, three: () => string[] }} three(): the requests that matched three's files
 */
async function open(s, t, view = {}, { init = null } = {}) {
  const requests = [], orig = s.browser.newContext.bind(s.browser);
  s.browser.newContext = async o => {
    const c = await orig(o);
    c.on('request', r => requests.push(r.url()));
    if (init) await c.addInitScript(init);
    return c;
  };
  try {
    const { context, page } = await openTarget(s, t, view);
    return { context, page, three: () => requests.filter(u => THREE.test(u)) };
  } finally { s.browser.newContext = orig; }
}

const s = await session({ args: GPU });
const breakInit = BREAK ? "addEventListener('DOMContentLoaded', () => import('/node_modules/three/build/three.module.js').catch(() => {}));" : null;

// 1: scene pages and the docs home
for (const t of [
  { scene: 'paus', register: 'warm', theme: 'light' },
  { scene: 'tinto', register: 'warm', theme: 'light' },
  { url: '/apps/docs/index.html', register: 'warm', theme: 'light' },
]) {
  const p = await open(s, t, {}, { init: breakInit });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(600);
  const hits = p.three();
  check(`no 3D on the page: ${t.scene ?? t.url} requests no three.js`, hits.length === 0, hits.length ? hits.slice(0, 2).join(' ') : 'no request matched');
  await p.context.close();
}

// 2 to 4: the depth photo on its 2D tier, three ways
for (const [label, t, view, wait] of [
  ['quiet', { url: DEMO, register: 'quiet', theme: 'light' }, {}],
  ['reduced motion', { url: DEMO, register: 'warm', theme: 'light' }, { reduced: true }],
]) {
  const p = await open(s, t, view, { init: breakInit });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(600);
  const tier = await p.page.evaluate(() => document.getElementById('dp').tier);
  const hits = p.three();
  check(`the depth photo in ${label} draws in 2D and requests no three.js`, tier === '2d' && hits.length === 0, `tier ${tier}, ${hits.length} three requests`);
  await p.context.close();
}
{
  const t = { url: DEMO, register: 'warm', theme: 'light' };
  const noGL = "const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : g.call(this, type, ...a); };" + (breakInit ?? '');
  const p = await open(s, t, {}, { init: noGL });
  await waitReady(p.page, t, { timeout: 30000 });
  await p.page.waitForTimeout(600);
  const tier = await p.page.evaluate(() => document.getElementById('dp').tier);
  const hits = p.three();
  check('the depth photo with WebGL disabled draws in 2D and requests no three.js', tier === '2d' && hits.length === 0, `tier ${tier}, ${hits.length} three requests`);
  await p.context.close();
}

// 5: the control. The live tier must ask for three, or the detector above proves nothing.
{
  const t = { url: DEMO, register: 'warm', theme: 'light' };
  const p = await open(s, t);
  await waitReady(p.page, t, { timeout: 30000 });
  const tier = await p.page.evaluate(() => document.getElementById('dp').tier);
  const hits = p.three();
  check('control: the live tier does request three.js, so the detector can see it', tier === 'live' && hits.length > 0, `tier ${tier}, ${hits.length} three requests: ${hits.slice(0, 1).join(' ')}`);
  await p.context.close();
}

await s.done();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass${BREAK ? ' (--break: the no-3D checks should FAIL)' : ''}`);
process.exit(BREAK ? 0 : failed ? 1 : 0);
