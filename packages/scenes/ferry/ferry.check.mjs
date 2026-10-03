// Browser checks for Ferry that a Node test cannot reach:
//
//   node packages/scenes/ferry/ferry.check.mjs
//
// The ferry is found in the pixels: the centroid of its laterite hull over
// the water (the near bank is left out of the box).
//
// 1. with step absent, the ferry stays at stop 1 for eight seconds: no timer
//    moves it on;
// 2. setting step moves it to that stop, and the status says so;
// 3. in playful, Enter advances exactly one stop.
//
// Each was watched failing first on a broken build (see the report).

import { session, openScene } from '../../../tools/lib/scene-probe.mjs';
import { STOP_AT, HORIZON } from './model.js';

const s = await session();
const { check } = s;
const WATER = { x: 0, y: HORIZON + 24, w: 1030, h: 690 - HORIZON - 24 };
// the anchored canoe's fisherman wears kokum, which the hull test also sees: take his box out of the count
const CANOE = { x: 80, y: 560, w: 190, h: 70 };
const where = async p => {
  const m = await p.measure(WATER, 'laterite'), k = await p.measure(CANOE, 'laterite');
  const n = m.hits - k.hits;
  if (n <= 0) return null;
  return { x: (m.cx * m.hits - (k.cx ?? 0) * k.hits) / n, y: (m.cy * m.hits - (k.cy ?? 0) * k.hits) / n };
};
const near = (at, i, tol = 24) => at && Math.hypot(at.x - STOP_AT[i].x, at.y - (STOP_AT[i].y - 4)) < tol;
const fmt = at => (at ? `${at.x.toFixed(0)}, ${at.y.toFixed(0)}` : 'not found');

// 1
{
  const p = await openScene(s, 'ferry', { register: 'warm' });
  await p.wait(800);
  const a = await where(p);
  await p.wait(8000);
  const b = await where(p);
  check('step absent: the ferry waits at stop 1 and never moves on by itself', near(a, 0) && near(b, 0), `at ${fmt(a)}, then ${fmt(b)}; stop 1 is ${STOP_AT[0].x}, ${STOP_AT[0].y}`);
  const said = await p.status();
  check('step absent: nothing is announced', said === '', `"${said}"`);
  await p.close();
}

// 2
{
  const p = await openScene(s, 'ferry', { register: 'warm', step: 2, label: 'How it goes' });
  await p.wait(800);
  const a = await where(p);
  check('step 2: the ferry is at stop 2', near(a, 1), `at ${fmt(a)}`);
  await p.page.evaluate(() => window.__piece.setAttribute('step', '4'));
  await p.wait(2000);
  const mid = await where(p);
  await p.wait(7000);
  const b = await where(p);
  check('step 4: it sails there along the route (two seconds in, it is between stop 2 and stop 4)', mid && mid.x > STOP_AT[1].x + 20 && mid.x < STOP_AT[3].x - 20, `two seconds in, at ${fmt(mid)}`);
  check('step 4: it arrives at stop 4', near(b, 3, 30), `at ${fmt(b)}`);
  const said = await p.status();
  check('the status names the stop', said === 'How it goes: stop 4 of 4', `"${said}"`);
  check('no console errors (step)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3
{
  const p = await openScene(s, 'ferry', { register: 'playful' });
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.page.keyboard.press('Enter');
  await p.wait(300);
  const one = await p.page.evaluate(() => window.__piece.params.step);
  await p.page.keyboard.press('Enter');
  await p.wait(300);
  const two = await p.page.evaluate(() => window.__piece.params.step);
  check('playful: each Enter advances exactly one stop', one === 2 && two === 3, `after one press ${one}, after two ${two}`);
  check('no console errors (playful)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

await s.done();
