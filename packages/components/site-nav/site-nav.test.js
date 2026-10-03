import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, current, pencilLine, tabTilt } from './site-nav.core.js';

test('paths are compared as the site means them', () => {
  assert.equal(normalizePath('/work/'), '/work');
  assert.equal(normalizePath('/work/index.html'), '/work');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/index.html?x=1#y'), '/');
  assert.equal(normalizePath(''), '/');
});

test('an exact match is the page; a folder above it marks the section; home never marks a section', () => {
  const links = ['/', '/work/', '/notes/', '/now/'];
  assert.deepEqual(current(links, '/work/'), { index: 1, kind: 'page' });
  assert.deepEqual(current(links, '/'), { index: 0, kind: 'page' });
  assert.deepEqual(current(links, '/work/aldona/'), { index: 1, kind: 'true' });
  assert.equal(current(links, '/about/'), null);
  assert.equal(current(['/', '/work'], '/workshop'), null, 'a shared prefix is not a folder');
  assert.deepEqual(current(['/work', '/work/aldona'], '/work/aldona/photos'), { index: 1, kind: 'true' }, 'the longest folder wins');
});

test('the pencil line spans the link, is deterministic, two passes', () => {
  const a = pencilLine(80, 'Work');
  assert.deepEqual(a, pencilLine(80, 'Work'));
  assert.notDeepEqual(a, pencilLine(80, 'Notes'));
  assert.equal(a.length, 2);
  const xs = a[0].match(/-?[\d.]+/g).map(Number).filter((_, i) => !(i % 2));
  assert.ok(Math.min(...xs) <= 0 && Math.max(...xs) >= 76);
});

test('tabs tilt a little, never much, the same each time', () => {
  for (let i = 0; i < 100; i++) { const t = Math.abs(tabTilt('x', i)); assert.ok(t >= 0.6 && t <= 2.4); }
  assert.equal(tabTilt('Work', 1), tabTilt('Work', 1));
});
