// Browser checks for Nod that a Node test cannot reach:
//
//   node packages/scenes/nod/nod.check.mjs
//
// The phone is read from its pixels: the share of the screen that is sent
// bubble (pale sea blue), draft card (haldi cream) and filled tick (green).
//
// 1. in playful, with no input for eight seconds, nothing is sent;
// 2. after Enter, the draft goes: more sent bubble, no draft card;
// 3. the still (reduced motion) shows a draft waiting with its tick empty.
//
// Each was watched failing first on a broken build (see the report).

import { session, openScene } from '../../../tools/lib/scene-probe.mjs';
import { SCREEN } from './model.js';

const s = await session();
const { check } = s;
const pct = v => `${(v * 100).toFixed(2)}%`;

// 1 and 2
{
  const p = await openScene(s, 'nod', { register: 'playful' });
  await p.wait(4500); // the first draft is showing by now
  const a = await p.fraction(SCREEN, 'sent'), da = await p.fraction(SCREEN, 'draft');
  await p.wait(8000);
  const b = await p.fraction(SCREEN, 'sent'), db = await p.fraction(SCREEN, 'draft');
  check('playful: a draft is waiting', da > 0.03, `draft card ${pct(da)} of the screen`);
  check('playful: with no nod, nothing is sent in eight seconds', Math.abs(b - a) < 0.002 && db > 0.03, `sent ${pct(a)} then ${pct(b)}; draft ${pct(db)}`);
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.page.keyboard.press('Enter');
  await p.wait(1200);
  const c = await p.fraction(SCREEN, 'sent'), dc = await p.fraction(SCREEN, 'draft');
  check('playful: Enter sends the draft', c > b + 0.02 && dc < 0.005, `sent ${pct(b)} then ${pct(c)}; draft ${pct(dc)}`);
  check('no console errors (playful)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3
{
  const p = await openScene(s, 'nod', { register: 'warm', reduced: true });
  await p.wait(500);
  // the waiting draft is the newest item, so its tick sits just above the input bar, at the right
  const tick = { x: SCREEN.x + SCREEN.w - 30 - 6, y: SCREEN.y + SCREEN.h - 50 - 15 - 6, w: 12, h: 12 };
  const d = await p.fraction(SCREEN, 'draft'), t = await p.fraction(tick, 'tick');
  check('the still: a draft waits, and its tick is empty', d > 0.03 && t < 0.05, `draft card ${pct(d)} of the screen, green inside the tick ${pct(t)}`);
  await p.close();
}

await s.done();
