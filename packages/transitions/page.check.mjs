// Browser checks for page transitions: cross-document navigation between two
// real pages, then the same-document helper's guards.
//
//   node packages/transitions/page.check.mjs      (or: npm run check)

import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const a = `${server.url}/packages/transitions/demo/a.html`;

// ── cross-document navigation, plain (no reduced motion) ────────────────────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await p.goto(a);
  const supported = await p.evaluate(() => typeof document.startViewTransition === 'function');
  check('the browser reports View Transitions support', supported, 'if false, the rest of this section is the graceful-fallback path, not the animated one');

  const namesOnA = await p.evaluate(() => ({
    header: getComputedStyle(document.querySelector('[data-vt="header"]')).viewTransitionName,
    scene: getComputedStyle(document.querySelector('[data-vt="scene"]')).viewTransitionName,
  }));
  check('page A names its persistent elements', namesOnA.header === 'sg-page-header' && namesOnA.scene === 'sg-page-scene', JSON.stringify(namesOnA));

  // A real link click, so the browser's own navigation (and its View Transition, if supported) runs.
  await Promise.all([p.waitForURL(/b\.html/), p.click('#to-b')]);
  await p.waitForFunction(() => window.__ready);
  check('the navigation reaches page B', await p.evaluate(() => document.getElementById('h1').textContent) === 'Page B');

  const namesOnB = await p.evaluate(() => ({
    header: getComputedStyle(document.querySelector('[data-vt="header"]')).viewTransitionName,
    scene: getComputedStyle(document.querySelector('[data-vt="scene"]')).viewTransitionName,
  }));
  check('page B names the same two elements, so the browser can match them across the navigation', JSON.stringify(namesOnB) === JSON.stringify(namesOnA), JSON.stringify(namesOnB));

  check('no console or page errors across the navigation', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── reduced motion: the navigation still lands, with nothing left animating ─
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(a);
  await Promise.all([p.waitForURL(/b\.html/), p.click('#to-b')]);
  await p.waitForFunction(() => window.__ready);
  check('reduced motion: the navigation still reaches page B', await p.evaluate(() => document.getElementById('h1').textContent) === 'Page B');
  await p.waitForTimeout(80);
  const n = await p.evaluate(() => document.getAnimations({ subtree: true }).filter(x => (x.effect?.getComputedTiming?.().duration ?? 0) > 1 && /^view-transition/.test(x.effect?.target?.constructor?.name ?? '')).length);
  check('reduced motion: no view-transition-group animation is left running', n === 0, `${n} such animations`);
  await ctx.close();
}

// ── the same-document helper's guards, in a real page (not just Node) ──────
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(a);
  const out = await p.evaluate(async () => {
    const mod = await import('../page.js');
    const log = [];
    // 1: runs directly with no pending transition and reduced motion forced off would normally
    // start one; force reducedMotion:true here so this check is deterministic regardless of the
    // browser's own View Transitions support.
    const r1 = mod.sameDocumentTransition(() => log.push('a'), { reducedMotion: true });
    // 2: two distinct names
    const n1 = mod.nextTransitionName('x'), n2 = mod.nextTransitionName('x');
    return { log, r1, distinct: n1 !== n2, shape: /^x-\d+$/.test(n1) };
  });
  check('sameDocumentTransition runs the update and returns null under reduced motion', out.log.length === 1 && out.r1 === null, JSON.stringify(out));
  check('nextTransitionName hands out distinct, prefixed names', out.distinct && out.shape, JSON.stringify(out));
  await ctx.close();
}

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks pass`);
process.exitCode = failed ? 1 : 0;
