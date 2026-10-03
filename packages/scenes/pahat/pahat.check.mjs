// Browser checks for Pahat that a Node test cannot reach:
//
//   node packages/scenes/pahat/pahat.check.mjs
//
// The sky is read from the pixels at the top of the window, left of the
// first bar: the share that is past first light.
//
// 1. warm: the sky is dark at first and light later, and never darker in between;
// 2. warm: once the dawn is over and the birds have gone, the element stops drawing;
// 3. the still (reduced motion) is the finished morning, not the dark;
// 4. playful: the hand moves the dawn, dark at the left and light at the right.
//
// Each was watched failing first on a broken build (see the report).

import { session, openScene } from '../../../tools/lib/scene-probe.mjs';
import { WIN } from './model.js';

const s = await session();
const { check } = s;
const pct = v => `${(v * 100).toFixed(1)}%`;
const SKYBOX = { x: WIN.x0 + 10, y: WIN.top + 6, w: 90, h: 50 };

// 1 and 2
{
  const p = await openScene(s, 'pahat', { register: 'warm' });
  const seen = [];
  for (const ms of [500, 9000, 9000, 9000]) { await p.wait(ms); seen.push(await p.fraction(SKYBOX, 'daylight')); }
  const rising = seen.every((v, i) => i === 0 || v >= seen[i - 1] - 0.01); // a twinkling star can flicker one pixel
  check('warm: the sky goes from dark to first light, never back', seen[0] < 0.05 && seen.at(-1) > 0.9 && rising, seen.map(pct).join(' → '));
  await p.wait(9000);
  const playing = await p.page.evaluate(() => window.__piece.playing);
  check('warm: after the dawn, the element stops drawing', playing === false, `playing: ${playing}`);
  check('no console errors (warm)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3
{
  const p = await openScene(s, 'pahat', { register: 'warm', reduced: true });
  await p.wait(400);
  const light = await p.fraction(SKYBOX, 'daylight');
  check('the still is the morning, not the dark', light > 0.9, `daylight in the sky ${pct(light)}`);
  await p.close();
}

// 4
{
  const p = await openScene(s, 'pahat', { register: 'playful' });
  const box = await p.page.evaluate(() => { const r = window.__piece.shadowRoot.querySelector('.stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = u => [box.x + box.w * u, box.y + box.h * 0.5];
  await p.page.mouse.move(...at(0.5)); await p.page.mouse.move(...at(0.2), { steps: 5 });
  await p.wait(400);
  const left = await p.fraction(SKYBOX, 'daylight');
  await p.page.mouse.move(...at(0.9), { steps: 8 });
  await p.wait(400);
  const right = await p.fraction(SKYBOX, 'daylight');
  check('playful: the hand moves the dawn (dark at the left, light at the right)', left < 0.05 && right > 0.9, `left ${pct(left)}, right ${pct(right)}`);
  check('no console errors (playful)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

await s.done();
