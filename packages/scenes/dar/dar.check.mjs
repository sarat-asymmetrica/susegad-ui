// Browser checks for Dar that a Node test cannot reach:
//
//   node packages/scenes/dar/dar.check.mjs
//
// 1. the still (reduced motion) shows the key on its hook: brass where the
//    key hangs;
// 2. warm settles: once the bolt is home, the canvas does not change;
// 3. playful: Enter swings the key, and Enter with the keyboard hand at the
//    bolt slides the bolt.
//
// Each was watched failing first on a broken build (see the report).

import { session, openScene } from '../../../tools/lib/scene-probe.mjs';
import { HOOK, BOLT, REST } from './model.js';

const s = await session();
const { check } = s;
const pct = v => `${(v * 100).toFixed(2)}%`;
const UNDER_HOOK = { x: HOOK.x - 30, y: HOOK.y + 30, w: 60, h: 110 };
const AT_BOLT = { x: BOLT.x - BOLT.travel - 20, y: BOLT.y - 26, w: 90, h: 52 };

// 1
{
  const p = await openScene(s, 'dar', { register: 'warm', reduced: true });
  await p.wait(400);
  const brass = await p.fraction(UNDER_HOOK, 'brass');
  check('the still: the key hangs on its hook', brass > 0.05, `brass under the hook ${pct(brass)}`);
  await p.close();
}

// 2
{
  const p = await openScene(s, 'dar', { register: 'warm' });
  await p.wait((REST + 1.2) * 1000);
  await p.snap('a');
  await p.wait(2000);
  await p.snap('b');
  const moved = await p.changed('a', 'b'), brass = await p.fraction(UNDER_HOOK, 'brass');
  check('warm: after the bolt is home, nothing moves', moved === 0 && brass > 0.05, `changed ${pct(moved)} over two seconds; brass under the hook ${pct(brass)}`);
  const playing = await p.page.evaluate(() => window.__piece.playing);
  check('warm: the element has stopped drawing', playing === false, `playing: ${playing}`);
  check('no console errors (warm)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3
{
  const p = await openScene(s, 'dar', { register: 'playful' });
  await p.wait((REST + 1) * 1000);
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.snap('rest');
  await p.page.keyboard.press('Enter');
  await p.wait(250);
  await p.snap('swung');
  const swung = await p.changed('rest', 'swung', UNDER_HOOK), boltStill = await p.changed('rest', 'swung', AT_BOLT);
  check('playful: Enter swings the key (and leaves the bolt alone)', swung > 0.02 && boltStill < 0.01, `under the hook ${pct(swung)}, at the bolt ${pct(boltStill)}`);
  // the keyboard hand starts in the middle; one step left and two down puts it on the bolt
  for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowDown']) await p.page.keyboard.press(k);
  await p.wait(3500);
  await p.snap('before');
  await p.page.keyboard.press('Enter');
  await p.wait(700);
  await p.snap('slid');
  const slid = await p.changed('before', 'slid', AT_BOLT);
  check('playful: Enter at the bolt slides it', slid > 0.03, `at the bolt ${pct(slid)}`);
  check('no console errors (playful)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

await s.done();
