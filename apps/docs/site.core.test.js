import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KINDS, NAV, slugOf, pathOf, up, roman, sceneGroups, neighbours, navLinks, page, posterImg, card,
  indexPage, scenePage, itemPage, pencilBoxPage, homeDoors, redirectFor, esc,
} from './site.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const scene = (n, title = n) => ({ name: `scene-${n}`, type: 'scene', title, description: `${title}, a scene.` });
const comp = (n, extra = {}) => ({ name: n, type: 'component', title: n[0].toUpperCase() + n.slice(1), description: `The ${n}.`, registers: ['quiet', 'warm', 'playful'], ...extra });

test('slugs and paths: scenes drop their prefix, every kind has its folder', () => {
  assert.equal(slugOf(scene('paus')), 'paus');
  assert.equal(pathOf(scene('paus')), 'scenes/paus');
  assert.equal(pathOf(comp('badge')), 'components/badge');
  assert.equal(pathOf({ name: 'booking', type: 'recipe' }), 'recipes/booking');
  assert.equal(pathOf({ name: 'core', type: 'package' }), 'foundations/core');
  assert.equal(up(0), '');
  assert.equal(up(1), '../');
});

test('roman numerals past the old table of 24', () => {
  assert.deepEqual([1, 4, 9, 14, 19, 22, 24, 28, 29].map(roman), ['I', 'IV', 'IX', 'XIV', 'XIX', 'XXII', 'XXIV', 'XXVIII', 'XXIX']);
});

test('scene groups: volumes numbered in order, unnumbered groups, and no scene lost', () => {
  const items = ['paus', 'kolam', 'tinto', 'ferry', 'zed'].map(n => scene(n));
  const groups = sceneGroups([
    { title: 'Volume I', ids: ['paus', 'kolam', 'missing'] },
    { title: 'Volume III', ids: ['tinto'] },
    { title: 'The studio', ids: ['ferry'], plates: false },
  ], items);
  assert.deepEqual(groups.map(g => g.title), ['Volume I', 'Volume III', 'The studio', 'More scenes']);
  assert.deepEqual(groups.flatMap(g => g.items.map(x => [slugOf(x.item), x.plate])), [['paus', 'I'], ['kolam', 'II'], ['tinto', 'III'], ['ferry', null], ['zed', null]]);
});

test('a scene named in two groups appears once, in the first', () => {
  const groups = sceneGroups([{ title: 'A', ids: ['shet'] }, { title: 'B', ids: ['shet'] }], [scene('shet')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'A');
});

test('neighbours at the ends and in the middle', () => {
  assert.deepEqual(neighbours([1, 2, 3], 0), { prev: null, next: 2 });
  assert.deepEqual(neighbours([1, 2, 3], 1), { prev: 1, next: 3 });
  assert.deepEqual(neighbours([1, 2, 3], 2), { prev: 2, next: null });
});

test('nav: every section, the current one marked, prefixed for depth', () => {
  const html = navLinks('recipes', 1);
  assert.equal((html.match(/<a /g) || []).length, NAV.length);
  assert.match(html, /href="\.\.\/recipes" aria-current="page"/);
  assert.doesNotMatch(html, /href="\.\.\/scenes" aria-current/);
});

test("the home page's hand-written nav is the same as every generated page's", () => {
  const home = fs.readFileSync(path.join(HERE, 'index.html'), 'utf8');
  const got = [...home.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)[1].matchAll(/href="([^"]+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]);
  assert.deepEqual(got, NAV.map(n => [n.key, n.label]));
});

test('a page: shared shell, assets at the right depth, text escaped', () => {
  const html = page({ title: 'A <b>', description: 'x "y"', depth: 1, active: 'scenes', main: '<p>hi</p>', scripts: ['scene-page.js'] });
  assert.match(html, /<title>A &lt;b&gt; · Susegad UI<\/title>/);
  assert.match(html, /content="x &quot;y&quot;"/);
  for (const href of ['../prefs.js', '../packages/tokens/tokens.css', '../docs.css', '../site.css', '../shell.js', '../scene-page.js', '../for-rafe']) assert.ok(html.includes(`"${href}"`), href);
  assert.match(html, /class="brand" href="\.\.\/"/);
  assert.match(html, /id="main"/);
});

test('posters: none without a poster; the swap hook and lazy by default', () => {
  assert.equal(posterImg('badge', undefined, 0), '');
  const img = posterImg('badge', { w: 640, h: 400 }, 1);
  assert.match(img, /src="\.\.\/posters\/badge\.warm\.light\.jpg"/);
  assert.match(img, /data-poster="\.\.\/posters\/badge"/);
  assert.match(img, /loading="lazy"/);
  assert.doesNotMatch(posterImg('badge', { w: 1, h: 1 }, 0, { eager: true }), /loading=/);
});

test('a card links its page by its title and never shows a stray count', () => {
  const html = card(comp('badge', { useFor: [] }), { depth: 0, poster: undefined });
  assert.match(html, /<h3 class="s-card-title"><a href="components\/badge">Badge<\/a><\/h3>/);
  assert.match(html, /s-card-plain/);
  assert.doesNotMatch(html, />0</, 'an empty useFor must not print 0');
});

test('an index page lists every item of its kind and runs no live preview', () => {
  const items = ['badge', 'toast', 'check'].map(n => comp(n));
  const html = indexPage('component', { items, posters: { badge: { w: 640, h: 400 } } });
  for (const n of ['badge', 'toast', 'check']) assert.ok(html.includes(`href="components/${n}"`), n);
  assert.doesNotMatch(html, /<iframe|<sg-scene/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /index-page\.js/);
  assert.ok(html.indexOf('>Badge<') < html.indexOf('>Check<') && html.indexOf('>Check<') < html.indexOf('>Toast<'), 'alphabetical');
});

test('the scenes index: groups, plate numbers, no search script', () => {
  const groups = sceneGroups([{ title: 'Volume I', note: 'noise', ids: ['paus'] }], [scene('paus', 'Monsoon')]);
  const html = indexPage('scene', { groups, posters: {} });
  assert.match(html, /Volume I <span class="s-group-note">noise<\/span>/);
  assert.match(html, /Plate I/);
  assert.match(html, /href="scenes\/paus"/);
  assert.doesNotMatch(html, /index-page\.js|<sg-scene/);
});

const meta = { title: 'Monsoon, through the glass', word: 'Paus', gloss: 'rain', caption: 'A window.', W: 900, H: 600, alt: 'A window in the rain', techniques: ['wobble'], prompt: 'Draw a <window>.', map: [['a phrase', 'wobble', 'why'], { phrase: 'p2', technique: 'noise', why: 'w2' }] };

test('a scene page: one drawing, its words as HTML, prompt and map folded, prev/next', () => {
  const list = [scene('kolam'), scene('paus'), scene('tinto')];
  const html = scenePage(list[1], meta, { list, index: 1, plate: 'II', group: 'Volume I', poster: { w: 900, h: 600 }, extras: [{ href: 'world.html', title: 'Words in the world' }], demo: null, techniqueName: id => id.toUpperCase() });
  assert.equal((html.match(/<sg-scene/g) || []).length, 1);
  assert.match(html, /<sg-scene class="stage" name="paus"/);
  assert.match(html, /<h1 id="scene-title" class="plate-title">Monsoon, through the glass<\/h1>/);
  assert.match(html, /Draw a &lt;window&gt;\./, 'the prompt is escaped');
  assert.match(html, /<details class="fold" id="prompt">/);
  assert.match(html, /<details class="fold" id="map">/);
  assert.doesNotMatch(html, /<details[^>]* open/, 'folded by default');
  assert.match(html, /<dt>p2<\/dt><dd><span class="term">NOISE<\/span>w2<\/dd>/, 'object map entries too');
  assert.match(html, /href="\.\.\/pencil-box#t-wobble"/);
  assert.match(html, /rel="prev"[\s\S]*Kolam|href="\.\.\/scenes\/kolam" rel="prev"/);
  assert.match(html, /href="\.\.\/scenes\/tinto" rel="next"/);
  assert.match(html, /Words in the world/);
  assert.match(html, /class="poster scene-still"/);
  assert.match(html, /Plate II/);
});

test('an item page: docs and prompt as given markup, deps linked, demo button, install line', () => {
  const list = [comp('badge'), comp('check')];
  const html = itemPage(list[0], { list, index: 0, poster: undefined, demo: '/packages/components/badge/demo.html', docsHtml: '<h2 id="use">Use</h2>', promptHtml: '<p>Make a badge.</p>', deps: [{ name: 'core', type: 'package', title: 'Core' }] });
  assert.match(html, /<h2 id="use">Use<\/h2>/);
  assert.match(html, /<p>Make a badge\.<\/p>/);
  assert.match(html, /href="\.\.\/foundations\/core">Core</);
  assert.match(html, /href="\/packages\/components\/badge\/demo\.html">Open the live demo/);
  assert.match(html, /npx susegad add badge/);
  assert.match(html, /href="\.\.\/components\/check" rel="next"/);
  assert.doesNotMatch(html, /\.md"/);
});

test('an item page with no docs says so plainly', () => {
  const html = itemPage(comp('x'), { list: [comp('x')], index: 0, demo: null, docsHtml: '', promptHtml: '', deps: [] });
  assert.match(html, /no written docs yet/);
  assert.doesNotMatch(html, /Open the live demo|id="prompt"/);
});

test('the pencil box: each technique with the scenes that use it', () => {
  const html = pencilBoxPage({ wobble: ['wobbly ink', 'lines drawn by hand'], lone: ['lonely', 'unused'] }, [{ item: scene('paus'), meta: { word: 'Paus', techniques: ['wobble'] } }]);
  assert.match(html, /id="t-wobble"[\s\S]*href="scenes\/paus">Paus</);
  assert.match(html, /id="t-lone"><dt>lonely<\/dt><dd>unused<\/dd>/);
});

test('home doors: one per kind with counts, posters only where they exist', () => {
  const html = homeDoors([{ type: 'scene', count: 28, samples: [scene('paus'), scene('kolam')] }, { type: 'package', count: 16, samples: [] }], { 'scene-paus': { w: 9, h: 6 } }, 22);
  assert.match(html, /href="scenes">Scenes<\/a> <span class="door-count">28</);
  assert.match(html, /href="foundations">Foundations</);
  assert.equal((html.match(/<img/g) || []).length, 1);
  assert.match(html, /href="pencil-box">The pencil box<\/a> <span class="door-count">22</);
});

test('old anchors land where the thing lives now', () => {
  const s = ['paus', 'kolam'];
  assert.equal(redirectFor('#paus', s), 'scenes/paus');
  assert.equal(redirectFor('#paus-prompt', s), 'scenes/paus#prompt');
  assert.equal(redirectFor('#kolam-map', s), 'scenes/kolam#map');
  assert.equal(redirectFor('#pencil-box', s), 'pencil-box');
  assert.equal(redirectFor('#scenes', s), 'scenes');
  assert.equal(redirectFor('#t-wobble', s), 'pencil-box#t-wobble');
  assert.equal(redirectFor('#main', s), null, 'the skip link stays');
  assert.equal(redirectFor('#ideas', s), null);
  assert.equal(redirectFor('', s), null);
});

test('every kind has a page folder distinct from the source tree', () => {
  // out/docs/packages holds the library's own files, so no kind may live at /packages
  assert.ok(Object.values(KINDS).every(k => !['packages', 'tools', 'registry', 'posters'].includes(k.key)));
  assert.equal(esc('<&">'), '&lt;&amp;&quot;&gt;');
});

test('sentences: whole sentences up to the limit, never a cut mid-sentence when one fits', async () => {
  const { sentences } = await import('./site.core.js');
  assert.equal(sentences('One two. Three four. Five six.', 20), 'One two. Three four.');
  assert.equal(sentences('One two. Three four.', 6), 'One two.', 'the first sentence, even a little over');
  assert.equal(sentences('A very long first sentence indeed.', 10), 'A very lon…', 'but never a whole paragraph');
  assert.equal(sentences('No full stop at all', 50), 'No full stop at all');
  assert.equal(sentences('Uses 0.5 and v1.2 inside. Then more.', 30), 'Uses 0.5 and v1.2 inside.', 'a dot inside a number is not an end');
});
