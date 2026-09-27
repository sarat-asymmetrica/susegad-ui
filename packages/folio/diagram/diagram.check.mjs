// Browser checks for diagrams and <sg-diagram>. Not a unit test (npm test runs
// the pure model); run it with `npm run check` or by hand:
//
//   node packages/folio/diagram/diagram.check.mjs
//
// Without JavaScript: the static SVG is named, described, and every step is in
// an ordered list. With JavaScript: step-through by buttons and keys, with each
// step's words in a live region and focus kept; arrows draw once and finish;
// flows move and pause off screen; reduced motion and quiet keep flows still;
// a register change redraws and keeps the step; a narrow screen turns a
// rightward diagram downward but keeps a direction its author chose.

import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const url = `${server.url}/packages/folio/diagram/demo.html`;
const open = async (ctxOpts = {}, q = 'register=warm') => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, ...ctxOpts });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  await p.goto(`${url}?${q}`);
  if (ctxOpts.javaScriptEnabled !== false) await p.waitForFunction(() => window.__ready);
  return { ctx, p };
};
const finite = el => el.getAnimations({ subtree: true }).filter(a => a.effect.getComputedTiming().iterations !== Infinity);

// ── without JavaScript ──
{
  const { ctx, p } = await open({ javaScriptEnabled: false }, 'register=quiet');
  const svg = p.locator('#booking svg');
  check('no JS: the picture is there, as an image named by its title', await svg.getAttribute('role') === 'img' && (await p.locator('#booking-title').textContent()) === 'How a booking at Casa Exemplo travels');
  check('no JS: every step is readable in an ordered list', await p.locator('#booking ol.sg-diagram-steps li').count() === 4);
  check('no JS: the picture is described by that list', await svg.getAttribute('aria-describedby') === 'booking-text' && await p.locator('#booking-text').count() === 1);
  check('no JS: no buttons that would do nothing', await p.locator('#booking button').count() === 0);
  check('no JS: a diagram without steps has its text behind "Read the diagram as text"', await p.locator('#rain details.sg-diagram-text summary').textContent() === 'Read the diagram as text');
  check('no JS: flows show still dots', await p.locator('#rain .sg-d-dots circle').count() >= 9);
  await ctx.close();
}

// ── step-through ──
{
  const { ctx, p } = await open();
  await p.evaluate(() => { window.__steps = []; document.addEventListener('sg-diagram-step', e => window.__steps.push(e.detail.step)); });
  const state = () => p.evaluate(() => {
    const el = document.getElementById('booking');
    return {
      at: el.dataset.at, now: el.querySelector('.sg-diagram-now').textContent,
      current: [...el.querySelectorAll('.sg-diagram-steps li')].findIndex(li => li.getAttribute('aria-current') === 'step'),
      edge: [...el.querySelectorAll('.sg-d-edge.is-now')].map(g => g.dataset.edge).join(),
      lit: [...el.querySelectorAll('.sg-d-node.is-lit')].map(g => g.dataset.node).join(),
      focus: document.activeElement.textContent,
    };
  });
  const role = await p.locator('#booking .sg-diagram-now').getAttribute('role');
  let s = await state();
  check('with JS: a status line says how to use it, and speaks politely', role === 'status' && s.now.startsWith('All steps shown.') && s.at === '0', s.now);
  await p.locator('#booking button', { hasText: 'Next step' }).focus();
  await p.keyboard.press('Enter');
  s = await state();
  check('Next: step 1, said in words', s.at === '1' && s.now === 'Step 1 of 4. The guest picks the dates and pays a deposit on the booking portal.', s.now);
  check('the list marks the current step, and the picture lights its arrow and both ends', s.current === 0 && s.edge === '0' && s.lit.split(',').sort().join() === 'Guest,Portal', JSON.stringify(s));
  await p.keyboard.press('ArrowRight');
  s = await state();
  check('arrow keys step too', s.at === '2' && s.edge === '1', s.at);
  await p.keyboard.press('End');
  await p.keyboard.press('Enter');
  s = await state();
  check('End goes to the last step; Next there stays put and keeps focus', s.at === '4' && s.focus === 'Next step' && await p.locator('#booking button', { hasText: 'Next step' }).getAttribute('aria-disabled') === 'true', JSON.stringify(s));
  await p.keyboard.press('Home');
  s = await state();
  check('Home shows all the steps again', s.at === '0' && s.edge === '' && s.current === -1);
  check('sg-diagram-step fires for each move', (await p.evaluate(() => window.__steps)).join() === '1,2,4,0');

  // a register change redraws in the new hand and keeps the step
  await p.keyboard.press('ArrowRight');
  await p.evaluate(() => document.documentElement.setAttribute('data-register', 'quiet'));
  await p.waitForFunction(() => document.querySelector('#booking svg').getAttribute('data-register') === 'quiet');
  s = await state();
  check('a register change redraws the picture and keeps the step', s.at === '1' && s.edge === '0' && await p.locator('#booking rect.sg-d-box').count() === 4, JSON.stringify(s));
  check('no console or page errors (step-through)', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

// ── motion ──
{
  const { ctx, p } = await open();
  const early = await p.evaluate(() => document.getElementById('booking').getAnimations({ subtree: true }).length);
  await p.waitForTimeout(2500);
  const left = await p.evaluate(`(${finite})(document.getElementById('booking')).length`);
  check('the arrows draw when the diagram comes into view, then the animations are gone', early > 0 && left === 0, `${early} at first, ${left} after`);
  const flows = () => p.evaluate(() => {
    const el = document.getElementById('booking');
    const a = el.getAnimations({ subtree: true }).filter(x => x.effect.getComputedTiming().iterations === Infinity);
    return { particles: el.querySelectorAll('.sg-d-particle').length, running: a.filter(x => x.playState === 'running').length, paused: a.filter(x => x.playState === 'paused').length, dots: getComputedStyle(el.querySelector('.sg-d-dots')).display };
  });
  let f = await flows();
  check('things move along a flow, and the still dots step aside', f.particles === 3 && f.running === 3 && f.dots === 'none', JSON.stringify(f));
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(400);
  f = await flows();
  check('off screen, they pause', f.running === 0 && f.paused === 3, JSON.stringify(f));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  f = await flows();
  check('back on screen, they carry on', f.running === 3, JSON.stringify(f));
  check('no console or page errors (motion)', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}
for (const [label, opts, q] of [['reduced motion', { reducedMotion: 'reduce' }, 'register=playful'], ['quiet', {}, 'register=quiet']]) {
  const { ctx, p } = await open(opts, q);
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ anims: document.querySelector('main').getAnimations({ subtree: true }).length, particles: document.querySelectorAll('.sg-d-particle').length, dots: getComputedStyle(document.querySelector('#rain .sg-d-dots')).display }));
  check(`${label}: nothing moves; flows keep their still dots`, r.anims === 0 && r.particles === 0 && r.dots !== 'none', JSON.stringify(r));
  await ctx.close();
}

// ── Markdown rendered without a build: only data-src (decision 0013) ──
{
  const { ctx, p } = await open();
  const r = await p.evaluate(async () => {
    const host = document.createElement('div');
    host.innerHTML = '<sg-diagram id="bare" data-src="Guest -&gt; Portal: books\nPortal =&gt; Owner" data-steps><figure class="sg-diagram"><pre>source</pre></figure></sg-diagram>';
    document.body.append(host);
    await new Promise(r => requestAnimationFrame(r));
    const d = host.firstElementChild;
    return { svg: d.querySelector('svg.sg-diagram-svg')?.getAttribute('role'), pre: d.querySelectorAll('pre').length, steps: d.querySelectorAll('ol.sg-diagram-steps li').length, buttons: d.querySelectorAll('button').length, drawn: d.dataset.registerDrawn };
  });
  check('an <sg-diagram> with only data-src draws itself, with its steps', r.svg === 'img' && r.pre === 0 && r.steps === 2 && r.buttons === 2 && r.drawn === 'warm', JSON.stringify(r));
  check('no console or page errors (self-drawn)', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

// ── a narrow screen ──
{
  const { ctx, p } = await open({ viewport: { width: 390, height: 800 } });
  const dirs = await p.evaluate(() => Object.fromEntries(['booking', 'rain', 'people'].map(id => {
    const vb = document.querySelector(`#${id} svg`).viewBox.baseVal;
    return [id, vb.height > vb.width ? 'down' : 'right'];
  })));
  check('on a phone, rightward diagrams turn to run down', dirs.booking === 'down' && dirs.people === 'down', JSON.stringify(dirs));
  check('a direction the author chose is kept', dirs.rain === 'down');
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check('no sideways scroll at phone width', !over);
  check('no console or page errors (phone)', p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

// ── what the picture says: labels by their own lines, lines clear of other boxes ──
// Measured in the page, after the draw-in has finished, at three widths.
for (const width of [390, 600, 1100]) {
  const { ctx, p } = await open({ viewport: { width, height: 900 } });
  await p.waitForTimeout(1800);
  const r = await p.evaluate(() => {
    const out = { near: [], through: [], labels: 0, badges: 0 };
    for (const d of document.querySelectorAll('sg-diagram')) {
      const svg = d.querySelector('svg.sg-diagram-svg'), m = svg.getScreenCTM();
      const toScreen = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(m); return [q.x, q.y]; };
      const paths = [...svg.querySelectorAll('.sg-d-edge')].map(g => {
        const path = g.querySelector('.sg-d-path'), len = path.getTotalLength();
        return { k: g.dataset.edge, from: g.dataset.from, to: g.dataset.to, pts: Array.from({ length: 121 }, (_, i) => { const q = path.getPointAtLength((len * i) / 120); return toScreen(q.x, q.y); }) };
      });
      const dist = ([x, y], pts) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
      for (const l of svg.querySelectorAll('.sg-d-label')) {
        const b = (l.querySelector('text') ?? l).getBoundingClientRect(), c = [b.x + b.width / 2, b.y + b.height / 2];
        l.classList.contains('sg-d-badge') ? out.badges++ : out.labels++;
        const own = paths.find(q => q.k === l.dataset.edge), mine = dist(c, own.pts);
        for (const q of paths) if (q !== own && dist(c, q.pts) <= mine) out.near.push(`${d.id}: "${l.textContent}" is nearer ${q.from} to ${q.to} than its own line`);
      }
      const boxes = [...svg.querySelectorAll('.sg-d-node')].map(g => ({ id: g.dataset.node, r: g.querySelector('rect').getBoundingClientRect() }));
      for (const q of paths) for (const n of boxes) {
        if (n.id === q.from || n.id === q.to) continue;
        if (q.pts.some(([x, y]) => x > n.r.left + 2 && x < n.r.right - 2 && y > n.r.top + 2 && y < n.r.bottom - 2)) out.through.push(`${d.id}: ${q.from} to ${q.to} runs through ${n.id}`);
      }
    }
    return out;
  });
  check(`${width} px: every label is nearer its own line than any other (${r.labels} labels, ${r.badges} numbers)`, !r.near.length, r.near.join('; '));
  check(`${width} px: no line runs through a box that is not one of its ends`, !r.through.length, r.through.join('; '));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
