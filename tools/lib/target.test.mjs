import test from 'node:test';
import assert from 'node:assert/strict';
import { targetPath, targetSlug, targetFrom } from './target.mjs';

test('a scene goes through the harness with its options as query params', () => {
  const p = targetPath({ scene: 'kolam', register: 'quiet', theme: 'dark', seed: 3, params: { grid: '7' }, content: true, freeze: 2 });
  const u = new URL(p, 'http://x');
  assert.equal(u.pathname, '/tools/harness/scene.html');
  assert.equal(u.searchParams.get('name'), 'kolam');
  assert.equal(u.searchParams.get('register'), 'quiet');
  assert.equal(u.searchParams.get('theme'), 'dark');
  assert.equal(u.searchParams.get('seed'), '3');
  assert.equal(u.searchParams.get('grid'), '7');
  assert.equal(u.searchParams.get('content'), '1');
  assert.equal(u.searchParams.get('freeze'), '2');
  assert.equal(u.searchParams.get('module'), null);
});

test('the fixture scene carries its module and element', () => {
  const u = new URL(targetPath({ scene: 'fixture' }), 'http://x');
  assert.equal(u.searchParams.get('module'), '/tools/fixtures/fixture-scene/index.js');
  assert.equal(u.searchParams.get('element'), 'sg-fixture-scene');
});

test('a url is used as given, rooted', () => {
  assert.equal(targetPath({ url: 'apps/docs/index.html' }), '/apps/docs/index.html');
  assert.equal(targetPath({ url: '/a/b.html?x=1' }), '/a/b.html?x=1');
});

test('a url carries register, theme and palette for demo pages', () => {
  const u = new URL(targetPath({ url: '/packages/components/toast/demo.html?x=1', register: 'playful', theme: 'dark', palette: 'casa' }), 'http://x');
  assert.equal(u.pathname, '/packages/components/toast/demo.html');
  assert.equal(u.searchParams.get('x'), '1');
  assert.equal(u.searchParams.get('register'), 'playful');
  assert.equal(u.searchParams.get('theme'), 'dark');
  assert.equal(u.searchParams.get('palette'), 'casa');
});

test('rejects ambiguous or bad targets', () => {
  assert.throws(() => targetPath({}), /exactly one/);
  assert.throws(() => targetPath({ scene: 'a', url: '/b' }), /exactly one/);
  assert.throws(() => targetPath({ scene: '../x' }), /bad scene name/);
  assert.throws(() => targetPath({ scene: 'a', register: 'loud' }), /register must be/);
  assert.throws(() => targetPath({ scene: 'a', theme: 'sepia' }), /theme must be/);
  assert.throws(() => targetPath({ scene: 'a', noJs: true }), /--no-js needs a page/);
});

test('slugs are filesystem-safe', () => {
  assert.equal(targetSlug({ scene: 'kolam' }), 'kolam');
  assert.equal(targetSlug({ url: '/apps/docs/index.html?x=1' }), 'apps-docs-index');
  assert.equal(targetSlug({ url: '/' }), 'root');
});

test('the positional name counts as --scene unless --url is given', () => {
  assert.equal(targetFrom({ param: {} }, ['paus']).scene, 'paus');
  assert.equal(targetFrom({ url: '/x.html', param: {} }, ['2']).scene, undefined);
  assert.equal(targetFrom({ scene: 'kolam', param: {} }, ['2']).scene, 'kolam');
  assert.equal(targetFrom({ url: '/x.html', param: {}, 'no-js': true }).noJs, true);
});

test('a url Git Bash rewrote into a drive path is taken back to the repo path', () => {
  assert.equal(targetPath({ url: 'C:/Program Files/Git/packages/components/toggle/demo.html' }), '/packages/components/toggle/demo.html');
  assert.equal(targetPath({ url: 'C:\\Program Files\\Git\\usr\\apps\\docs\\index.html' }), '/apps/docs/index.html');
  assert.equal(targetPath({ url: '/packages/x.html' }), '/packages/x.html');
  assert.throws(() => targetPath({ url: 'D:/work/site/index.html' }), /not a drive path/);
});
