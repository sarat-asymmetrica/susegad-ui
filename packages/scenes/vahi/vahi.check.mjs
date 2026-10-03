// Browser checks for Vahi that a Node test cannot reach:
//
//   node packages/scenes/vahi/vahi.check.mjs
//
// 1. progress is real state: with progress set, the canvas does not change
//    over two seconds of running frames, and the status names the work.
// 2. the still is finished: under reduced motion the book is shut, so the
//    open book's left page is table, not paper.
// 3. the calm zone holds: with text slotted, the pile is moved clear of the
//    reading panel, and nothing under it moves while papers move elsewhere.
// 4. playful: Enter throws the pile again (a new seed) with no errors.
//
// Each was watched failing first on a broken build (see the request,
// docs/requests/2026-09-27-studio-scenes.md, and the report).

import { session, openScene } from '../../../tools/lib/scene-probe.mjs';
import { BOOK } from './model.js';

const s = await session();
const { check } = s;

// 1
{
  const p = await openScene(s, 'vahi', { register: 'warm', progress: 0.5, label: 'Records sorted' });
  await p.wait(300);
  const a = await p.hash();
  await p.wait(2000);
  const b = await p.hash();
  check('progress set: the drawing holds still while the work does', a === b, `${a} then ${b}`);
  const said = await p.status();
  check('progress set: the status names the work', said === 'Records sorted: 50% done', `"${said}"`);
  check('no console errors (progress)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 2
{
  const p = await openScene(s, 'vahi', { register: 'warm', reduced: true });
  await p.wait(300);
  const leftPage = { x: BOOK.x - BOOK.pw + 24, y: BOOK.y - BOOK.ph / 2 + 24, w: BOOK.pw - 48, h: BOOK.ph - 48 };
  const paperShare = await p.fraction(leftPage, 'sheet');
  check('reduced motion: the still shows the book shut (no open page left of the spine)', paperShare < 0.05, `paper-white share on the left page ${paperShare.toFixed(3)}`);
  const cover = { x: BOOK.x + 30, y: BOOK.y + 70, w: BOOK.pw - 60, h: 60 };
  const coverWhite = await p.fraction(cover, 'sheet');
  check('reduced motion: the closed cover lies over the right page', coverWhite < 0.05, `paper-white share under the cover ${coverWhite.toFixed(3)}`);
  await p.close();
}

// 3
{
  const p = await openScene(s, 'vahi', { register: 'warm', content: 1 });
  const panel = await p.panel();
  await p.wait(1500);
  await p.snap('a');
  await p.wait(4000);
  await p.snap('b');
  const inside = await p.changed('a', 'b', panel), everywhere = await p.changed('a', 'b');
  const paperUnder = await p.fraction(panel, 'sheet');
  check('calm zone: no paper lies under the reading panel', paperUnder < 0.01, `paper-white share under the panel ${(paperUnder * 100).toFixed(2)}%`);
  check('calm zone: papers move, but not under the reading panel', inside < 0.01 && everywhere > 0.01, `changed under the panel ${(inside * 100).toFixed(2)}%, over the whole drawing ${(everywhere * 100).toFixed(2)}%`);
  await p.close();
}

// 4
{
  const p = await openScene(s, 'vahi', { register: 'playful' });
  const before = await p.page.evaluate(() => window.__piece.seed);
  await p.page.evaluate(() => window.__piece.shadowRoot.querySelector('.stage').focus());
  await p.page.keyboard.press('Enter');
  await p.wait(400);
  const after = await p.page.evaluate(() => window.__piece.seed);
  check('playful: Enter throws the pile again', after !== before, `seed ${before} then ${after}`);
  check('no console errors (playful)', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

await s.done();
