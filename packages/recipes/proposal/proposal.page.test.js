import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stackTables, sections, metaHTML, statusHTML, proposalPage, STRINGS } from './proposal.page.js';
import { page } from './build.mjs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('Markdown tables stack on a phone: every cell carries its column heading', () => {
  const html = '<table>\n<thead><tr><th></th><th>You</th><th>Me</th></tr></thead>\n<tbody>\n<tr><td>Shoot</td><td>Direct it.</td><td>The brief.</td></tr>\n</tbody>\n</table>';
  const out = stackTables(html);
  assert.match(out, /^<div class="proposal-table"><table data-cols="3" data-row-heads>/);
  assert.match(out, /<td data-label="">Shoot<\/td><td data-label="You">Direct it\.<\/td><td data-label="Me">The brief\.<\/td>/);
  assert.equal(stackTables('<table class="price-table">x</table>'), '<table class="price-table">x</table>', 'tables written by directives are left alone');
});

test('the cover is everything before the first ##, with the scene taken out', () => {
  const s = sections('<sg-scene name="paus">\n<h1 id="t">T</h1>\n</sg-scene>\n<p>Lede.</p>\n<h2 id="a">A</h2>\n<p>a</p>\n<h2 id="b">B</h2>');
  assert.equal(s.scene, '<sg-scene name="paus">\n<h1 id="t">T</h1>\n</sg-scene>');
  assert.equal(s.lede, '<p>Lede.</p>');
  assert.deepEqual(s.sections.map(x => x.id), ['a', 'b']);
  assert.equal(sections('<h2 id="a">A</h2>').lede, '');
});

test('the meta reads like a letterhead, and the status is a stamp that reads as words', () => {
  const m = metaHTML({ for: 'Maria, Casa Exemplo', from: 'Sarat', date: 'September 2026', 'valid-until': '2026-09-30' });
  assert.match(m, /<div><dt>For<\/dt><dd>Maria, Casa Exemplo<\/dd><\/div>/);
  assert.match(m, /<dt>Holds until<\/dt><dd><time datetime="2026-09-30">30 September 2026<\/time><\/dd>/);
  assert.equal(metaHTML({}), '');
  assert.equal(statusHTML('internal review, not for sending'),
    '<sg-stamp class="proposal-status" tone="warning" seed="status"><p role="status"><strong>Internal review</strong> <span>not for sending</span></p></sg-stamp>');
  assert.equal(statusHTML(''), '');
});

test('a whole proposal: cover, one section per heading, options and signature, a way to keep a copy', async () => {
  const r = await page(read('./examples/sample/proposal.md'));
  const h = r.html;
  assert.deepEqual(r.warnings, []);
  assert.match(h, /<html lang="en-IN" data-register="warm">/);
  assert.match(h, /<header class="proposal-cover">\n<div class="proposal-cover__art">\n<sg-scene interactive="false" name="paus" register="warm">/, 'in a document the cover is a picture, not a tab stop');
  assert.match(h, /<sg-stamp class="proposal-status"[^>]*><p role="status"><strong>Sample<\/strong> <span>not a real offer<\/span>/);
  assert.equal((h.match(/<section class="proposal-section"/g) || []).length, 7);
  assert.match(h, /<sg-price-table from="kernels-booking" view="bands">\n<table class="price-table" data-view="bands">/, 'the rate card is written at build time');
  assert.match(h, /<sg-timeline>\n<ol class="timeline">/);
  assert.match(h, /<label for="folio-signature-1-option-2">Option 2, the website with the booking engine<\/label>/);
  assert.match(h, /<\/sg-signature>\n<\/div>\n\n<div class="proposal-keep" data-folio-chrome hidden>/, 'the keep block follows the signature');
  assert.match(h, new RegExp(`<button type="button" class="proposal-keep__print">${STRINGS.keep}</button>`));
  assert.match(h, /import '\/packages\/recipes\/proposal\/proposal\.js';/);
});

test('one register for the whole document: the scene follows the page', async () => {
  const src = read('./examples/sample/proposal.md');
  const r = await page(src, { register: 'quiet' });
  assert.match(r.html, /data-register="quiet"/);
  assert.match(r.html, /<sg-scene interactive="false" name="paus" register="quiet">/);
  assert.match((await page(src, { register: 'playful' })).html, /<sg-scene name="paus" register="playful">/, 'playful keeps the scene to play with');
  assert.throws(() => proposalPage(src, { register: 'loud' }), /register must be quiet, warm or playful/);
  assert.match(proposalPage('---\ncolour: red\n---\n# T').warnings[0], /front matter: colour is not used/);
});

test('index.html is the sample proposal, as build.mjs --index writes it', async () => {
  const { writeIndex } = await import('./build.mjs');
  const before = read('./index.html');
  const r = await page(read('./examples/sample/proposal.md'), { base: '../../', inlineScript: 'x' });
  assert.match(r.html, /href="\.\/proposal\.css"/);
  assert.match(r.html, /href="\.\.\/\.\.\/components\/signature\/signature\.css"/);
  await writeIndex();
  assert.equal(read('./index.html'), before, 'index.html is out of date: run node packages/recipes/proposal/build.mjs --index');
});

test('a paragraph that opens with a superscript number is set as a footnote', () => {
  const r = proposalPage('# T\n\n## A\n\nMore.¹ Text.\n\n¹ In 2019, a complaint.\n');
  assert.match(r.html, /<p>More\.¹ Text\.<\/p>\n<p class="proposal-footnote">¹ In 2019, a complaint\.<\/p>/);
});
