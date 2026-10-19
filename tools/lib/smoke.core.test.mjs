import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, discoverPages, itemsForDiff, requestFailureCounts, dropBenign, axeLine, failuresOf, summarise, formatFailures } from './smoke.core.js';

const items = [
  { name: 'menu', type: 'component', manifest: 'packages/components/menu/registry.json', files: [{ path: 'packages/components/menu/demo.html' }, { path: 'packages/components/menu/menu.js' }] },
  { name: 'booking', type: 'recipe', manifest: 'packages/recipes/booking/registry.json', dependencies: ['menu'], files: [{ path: 'packages/recipes/booking/held.html' }] },
  { name: 'tween', type: 'package', manifest: 'packages/tween/registry.json', files: [{ path: 'packages/tween/index.js' }] },
  { name: 'scene-kolam', type: 'scene', manifest: 'packages/scenes/kolam/registry.json', files: [{ path: 'packages/scenes/kolam/index.js' }] },
];
const have = new Set(['packages/recipes/booking/index.html', 'packages/scenes/kolam/demo.html']);
const exists = p => have.has(p);

test('pages come from listed html files and demo.html or index.html in the item folder, once each', () => {
  const pages = discoverPages({ items, exists });
  assert.deepEqual(pages.map(p => p.path), [
    '/packages/recipes/booking/held.html', '/packages/recipes/booking/index.html',
    '/packages/components/menu/demo.html', '/packages/scenes/kolam/demo.html',
  ]);
  assert.equal(pages.find(p => p.item === 'scene-kolam').type, 'scene');
  assert.ok(!pages.some(p => p.item === 'tween'), 'an item with no page adds none');
});

test('a diff reaches the changed item and what depends on it; prose reaches nothing; a shared file reaches all', () => {
  const some = itemsForDiff({ files: ['packages/components/menu/menu.js'], items });
  assert.equal(some.all, false);
  assert.deepEqual([...some.names].sort(), ['booking', 'menu']);
  assert.equal(itemsForDiff({ files: ['packages/components/menu/menu.docs.md'], items }).names.size, 0);
  const all = itemsForDiff({ files: ['packages/core/index.js'], items });
  assert.equal(all.all, true);
  assert.equal(all.names.size, items.length);
  assert.match(all.reason, /shared primitive/);
});

test('a cancelled media or fetch request is the page going away; any other failure counts', () => {
  assert.equal(requestFailureCounts('net::ERR_ABORTED', 'media'), false);
  assert.equal(requestFailureCounts('net::ERR_ABORTED', 'fetch'), false);
  assert.equal(requestFailureCounts('net::ERR_ABORTED', 'script'), true);
  assert.equal(requestFailureCounts('net::ERR_CONNECTION_REFUSED', 'media'), true);
});

test('only the ResizeObserver notice is dropped', () => {
  const kept = dropBenign(['ResizeObserver loop completed with undelivered notifications.', 'Uncaught TypeError: x']);
  assert.deepEqual(kept, ['Uncaught TypeError: x']);
});

test('axeLine names the rule, the count and the first two selectors, shadow paths joined', () => {
  const v = { id: 'color-contrast', nodes: [{ target: ['p.a'] }, { target: [['sg-x', '.in']] }, { target: ['p.c'] }] };
  assert.equal(axeLine(v), 'color-contrast (3: p.a, sg-x >>> .in)');
});

test('each kind of fault becomes a failure of its own kind, and a clean page has none', () => {
  assert.deepEqual(failuresOf({ desktop: { errors: [], axe: [] }, phone: { errors: [], overflow: 0 } }), []);
  const f = failuresOf({
    desktop: { errors: ['boom'], axe: ['label (1: input)'], notReady: 'scene never fired sg-ready' },
    phone: { errors: ['boom'], overflow: 30, clipped: true },
    reduced: { errors: ['still boom'] },
  });
  assert.deepEqual(f.map(x => x.kind), ['error', 'not-ready', 'axe', 'error', 'sideways', 'error']);
  assert.match(f.find(x => x.kind === 'sideways').message, /30 px sideways at 390 px.*clip/);

  assert.deepEqual(failuresOf({ desktop: { errors: [], axe: [] }, phone: { errors: [], overflow: 0, metaViewport: true } }), []);
  assert.deepEqual(failuresOf({ desktop: { errors: [], axe: [] }, phone: { errors: [], overflow: 0, metaViewport: false } }).map(x => x.kind), ['viewport']);
});

test('an empty run is not a pass; the summary counts failures by kind', () => {
  assert.equal(summarise([]).ok, false);
  const results = [
    { path: '/a.html', item: 'a', type: 'component', failures: [] },
    { path: '/b.html', item: 'b', type: 'scene', failures: [{ kind: 'axe', message: 'x' }, { kind: 'axe', message: 'y' }] },
  ];
  const s = summarise(results);
  assert.deepEqual([s.pages, s.passed, s.failed, s.ok, s.kinds], [2, 1, 1, false, { axe: 2 }]);
  const table = formatFailures(results);
  assert.match(table, /FAIL \/b\.html\s+b \(scene\)/);
  assert.match(table, /axe\s+x/);
  assert.equal(formatFailures([results[0]]), '');
});

test('only a template offline page is skipped, and with a reason', () => {
  assert.match(skipReason({ type: 'template', path: '/packages/templates/event/gom-latn/offline.html' }), /site root/);
  assert.equal(skipReason({ type: 'template', path: '/packages/templates/event/index.html' }), null);
  assert.equal(skipReason({ type: 'recipe', path: '/packages/recipes/offline/offline.html' }), null);
});

test('a no-js.html beside an item is a page (dialog and drawer shipped without a viewport meta unseen), and so are veranda\'s three unlisted pages', () => {
  const have2 = new Set([...have, 'packages/components/menu/no-js.html', 'packages/scenes/kolam/no-js.html', 'packages/scenes/veranda/words.html', 'packages/scenes/veranda/stage.html', 'packages/scenes/veranda/walk.html']);
  const withVeranda = [...items, { name: 'scene-veranda', type: 'scene', manifest: 'packages/scenes/veranda/registry.json', files: [{ path: 'packages/scenes/veranda/index.js' }] }];
  const paths = discoverPages({ items: withVeranda, exists: p => have2.has(p) }).map(p => p.path);
  for (const p of ['/packages/components/menu/no-js.html', '/packages/scenes/kolam/no-js.html', '/packages/scenes/veranda/words.html', '/packages/scenes/veranda/stage.html', '/packages/scenes/veranda/walk.html']) assert.ok(paths.includes(p), `${p} is not a smoke page`);
  assert.equal(new Set(paths).size, paths.length, 'a path appears once');
});

test('dropBenign matches the ResizeObserver notice with the "page error: " prefix smoke records, and nothing looser', () => {
  const n = 'ResizeObserver loop completed with undelivered notifications.';
  assert.deepEqual(dropBenign([`page error: ${n}`, n]), []);
  const keep = [`Uncaught: ${n} Also something broke.`, `page error: page error: ${n}`, `page error: ${n} Also something broke.`, `desktop: page error: ${n}`, 'page error: TypeError: x'];
  assert.deepEqual(dropBenign(keep), keep);
});
