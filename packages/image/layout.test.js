// layout.core.js in Node: fitRect, reserve, flowColumn and flowAround, through the type tier's fake oracle
// and a fake dimension source. The checks themselves live in layout.props.js, so mutants.test.js can run
// the same list against deliberately broken copies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLayout } from '../type/layout.core.js';
import { createFakeOracle } from '../type/oracle.fake.js';
import * as core from './layout.core.js';
import { createFakeDims } from './dims.fake.js';
import { CHECKS } from './layout.props.js';

for (const [name, run] of CHECKS) test(name, () => run(core));

test('the text lands beside the floats once the header size is known, and the box does not change when it is known twice', async () => {
  const dims = createFakeDims({ '/a.jpg': { w: 1200, h: 800 }, '/b.png': { w: 600, h: 800 } }, { late: ['/b.png'] });
  const layout = createLayout(createFakeOracle());
  const blocks = [{ prepared: layout.prepare('Salt in the air and the tide going out past the old jetty where the nets hang to dry in the sun. '.repeat(3), '400 16px Kalam'), lineHeight: 24 }];
  const col = { x: 0, y: 0, w: 420 };
  const floatsAt = () => [
    { id: 'a', side: 'right', width: 150, dims: dims.peek('/a.jpg') },
    { id: 'b', side: 'left', width: 120, dims: dims.peek('/b.png'), y: 40 },
  ];
  const first = core.flowAround(layout, blocks, col, floatsAt(), { gap: 12, minWidth: 80 });
  assert.equal(first.boxes.find(b => b.id === 'b').guessed, true, 'b has no size yet: its box is a guess, and says so');
  const waited = dims.dims('/b.png');
  dims.arrive('/b.png');
  assert.deepEqual(await waited, { w: 600, h: 800 });
  const second = core.flowAround(layout, blocks, col, floatsAt(), { gap: 12, minWidth: 80 });
  const b = second.boxes.find(x => x.id === 'b');
  assert.equal(b.guessed, false);
  assert.deepEqual([b.w, b.h], [120, 160]);
  // from then on nothing depends on the picture's bytes: the same sizes give the same lines
  assert.deepEqual(core.flowAround(layout, blocks, col, floatsAt(), { gap: 12, minWidth: 80 }), second);
  assert.notDeepEqual(first.boxes.find(x => x.id === 'b').h, b.h, 'a guessed box differs from the true one: reserve from the header, not a guess');
});

test('layout.core.js imports nothing and touches no DOM, canvas or network', () => {
  const src = readFileSync(new URL('./layout.core.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual([...src.matchAll(/\bimport\b|\brequire\b/g)], []);
  assert.deepEqual([...src.matchAll(/\b(document|window|fetch|Image|OffscreenCanvas|getContext|navigator)\b/g)].map(m => m[1]), []);
});
