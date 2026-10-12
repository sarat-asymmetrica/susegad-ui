import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImages, imgTags, CAP_BYTES } from './images.core.js';
import { runFixtures, checkTree, REPO_ROOT } from './images.check.mjs';

const rules = r => [...r.errors, ...r.warnings].map(x => `${x.rule}:${x.path}`);

test('a GIF in the library, the docs, the readme art or a README is an error; elsewhere it is not ours to judge', () => {
  const r = checkImages({ files: [{ path: 'packages/x/a.gif', size: 10 }, { path: 'apps/docs/b.gif', size: 10 }, { path: 'docs/readme/hero.gif', size: 10 }, { path: 'tools/fixtures/c.gif', size: 10 }, { path: 'docs/shots/d.gif', size: 10 }] });
  assert.deepEqual(rules(r), ['no-gif:apps/docs/b.gif', 'no-gif:docs/readme/hero.gif', 'no-gif:packages/x/a.gif']);
});

test('a README that names a local GIF is an error, a remote one is not', () => {
  const text = '![a](docs/x.gif)\n<img src="https://example.com/y.gif">\n<picture><source srcset="docs/z.gif 1x"></picture>';
  const r = checkImages({ texts: [{ path: 'README.md', text }] });
  assert.deepEqual(r.errors.map(e => e.message.match(/line (\d+) refers to ([^\s,]+)/).slice(1)), [['1', 'docs/x.gif'], ['3', 'docs/z.gif']]);
});

test('a raster in packages/ over the cap is an error, at the cap it is not, and other trees are free', () => {
  const r = checkImages({ files: [
    { path: 'packages/a/big.png', size: CAP_BYTES + 1 }, { path: 'packages/a/ok.png', size: CAP_BYTES },
    { path: 'apps/docs/og.jpg', size: CAP_BYTES * 3 }, { path: 'packages/a/data.json', size: CAP_BYTES * 9 },
  ] });
  assert.deepEqual(rules(r), ['raster-cap:packages/a/big.png']);
});

test('a poster needs its AVIF and WebP beside it, whatever the register and theme in its name', () => {
  const poster = 'apps/docs/posters/abri.warm.light';
  const only = checkImages({ files: [{ path: `${poster}.jpg`, size: 1 }] });
  assert.equal(only.errors.length, 2);
  const webp = checkImages({ files: [{ path: `${poster}.jpg`, size: 1 }, { path: `${poster}.webp`, size: 1 }] });
  assert.match(webp.errors[0].message, /\.avif/);
  const all = checkImages({ files: ['jpg', 'webp', 'avif'].map(e => ({ path: `${poster}.${e}`, size: 1 })) });
  assert.deepEqual(all.errors, []);
  // a poster named for what it is, not only its folder
  assert.equal(checkImages({ files: [{ path: 'packages/player/poster.png', size: 1 }] }).errors.length, 2);
  // an AVIF or WebP alone is not a poster missing anything
  assert.deepEqual(checkImages({ files: [{ path: 'apps/docs/posters/a.webp', size: 1 }] }).errors, []);
});

test('an <img> outside <picture> only warns, and so does one with no size', () => {
  const text = '<img src="a.jpg" width="1" height="1" alt="">\n<picture><img src="b.png" width="1" height="1" alt=""></picture>\n<img src="c.webp" alt="">\n<img src="d.png" style="aspect-ratio:3/2" alt="">\n<img src="https://x.test/e.jpg" alt="">';
  const r = checkImages({ texts: [{ path: 'apps/x/index.html', text }] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map(w => `${w.rule} ${w.message.match(/line (\d+)/)[1]}`), ['img-outside-picture 1', 'img-outside-picture 4', 'img-size 3']);
});

test('imgTags knows which images sit inside a picture', () => {
  const t = imgTags('<img src="a.jpg"><picture><source><img src="b.jpg"></picture><img src="c.jpg">');
  assert.deepEqual(t.map(x => [x.src, x.inPicture]), [['a.jpg', false], ['b.jpg', true], ['c.jpg', false]]);
});

test('the fixtures: each broken one goes red on its own rule and the clean one stays green (this is the check failing first)', () => {
  const got = runFixtures();
  assert.deepEqual(got.map(g => g.name), ['new-gif', 'gif-in-readme', 'poster-bare', 'poster-no-avif', 'img-size', 'outside-picture', 'clean', 'over-cap']);
  for (const g of got) assert.ok(g.ok, `${g.name}: ${g.detail}`);
});

test('the repo passes decision 0023: no GIF, nothing over the cap, every poster with its siblings', () => {
  const { errors } = checkTree(REPO_ROOT);
  assert.deepEqual(errors.map(e => `${e.rule} ${e.path}: ${e.message}`), []);
});
