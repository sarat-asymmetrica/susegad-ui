import test from 'node:test';
import assert from 'node:assert/strict';
import { posterSource } from './posters.mjs';

const has = (...files) => f => files.includes(f);

test('a scene is photographed through the harness', () => {
  const src = posterSource({ type: 'scene', name: 'scene-paus', manifest: 'packages/scenes/paus/registry.json' }, has());
  assert.equal(src.kind, 'scene');
  assert.match(src.url, /^\/tools\/harness\/scene\.html\?name=paus&seed=1$/);
});

test('a piece with its own folder uses that folder\'s demo, then its index', () => {
  assert.equal(posterSource({ type: 'component', manifest: 'packages/components/accordion/registry.json' },
    has('packages/components/accordion/demo.html')).url, '/packages/components/accordion/demo.html');
  const recipe = posterSource({ type: 'recipe', manifest: 'packages/recipes/member-directory/registry.json' },
    has('packages/recipes/member-directory/index.html'));
  assert.equal(recipe.url, '/packages/recipes/member-directory/index.html');
  assert.equal(recipe.pastHeading, false);
});

test('a second manifest in a folder uses its own page, never the folder\'s main demo (the blank veranda-stage poster)', () => {
  const stage = posterSource({ type: 'component', manifest: 'packages/scenes/veranda/stage.registry.json' },
    has('packages/scenes/veranda/demo.html', 'packages/scenes/veranda/stage.html'));
  assert.equal(stage.url, '/packages/scenes/veranda/stage.html');
  assert.equal(stage.pastHeading, true);
  assert.equal(posterSource({ type: 'component', manifest: 'packages/core/orient.registry.json' },
    has('packages/core/orient.demo.html')).url, '/packages/core/orient.demo.html');
  // no page of its own: no poster, rather than a picture of something else
  assert.equal(posterSource({ type: 'component', manifest: 'packages/core/movable.registry.json' }, has('packages/core/demo.html')), null);
});
