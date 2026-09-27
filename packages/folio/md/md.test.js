import test from 'node:test';
import assert from 'node:assert/strict';
import { render, toDocument, inline, parseAttrs, isoDate, sayDate, MarkdownError } from './index.js';

const md = src => render(src).html;
const problems = src => { try { render(src); return []; } catch (e) { assert.ok(e instanceof MarkdownError); return e.problems; } };

test('headings, paragraphs, breaks and rules', () => {
  assert.equal(md('# Hello'), '<h1 id="hello">Hello</h1>');
  assert.equal(md('Title\n=====\n\nSub\n---'), '<h1 id="title">Title</h1>\n<h2 id="sub">Sub</h2>');
  assert.equal(md('one\ntwo\n\nthree'), '<p>one\ntwo</p>\n<p>three</p>');
  assert.equal(md('a  \nb'), '<p>a<br>\nb</p>');
  assert.equal(md('***'), '<hr>');
  assert.equal(md('## Stay\n\n## Stay'), '<h2 id="stay">Stay</h2>\n<h2 id="stay-2">Stay</h2>', 'ids stay unique');
  assert.equal(md('# मुंबई ಬೆಂಗಳೂರು'), '<h1 id="मुंबई-ಬೆಂಗಳೂರು">मुंबई ಬೆಂಗಳೂರು</h1>', 'ids keep Indic letters');
});

test('inline: emphasis, code, links, images, autolinks, escapes', () => {
  assert.equal(inline('*a* **b** _c_ __d__'), '<em>a</em> <strong>b</strong> <em>c</em> <strong>d</strong>');
  assert.equal(inline('snake_case_name stays'), 'snake_case_name stays', 'underscores inside words are not emphasis');
  assert.equal(inline('`a *b* <c>`'), '<code>a *b* &lt;c&gt;</code>');
  assert.equal(inline('[the **map**](https://osm.org "Map")'), '<a href="https://osm.org" title="Map">the <strong>map</strong></a>');
  assert.equal(inline('![A veranda](v.jpg)'), '<img src="v.jpg" alt="A veranda">');
  assert.equal(inline('<https://example.com/a?b=1>'), '<a href="https://example.com/a?b=1">https://example.com/a?b=1</a>');
  assert.equal(inline('\\*not em\\* & 5 < 6'), '*not em* &amp; 5 &lt; 6');
  assert.equal(inline('[x](javascript:alert(1))'), '<a href="#">x</a>', 'script URLs are refused');
  assert.equal(inline('₹18,400 &amp; more'), '₹18,400 &amp; more', 'entities are kept');
});

test('lists: tight, loose, nested, ordered with a start', () => {
  assert.equal(md('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  assert.equal(md('- a\n\n- b'), '<ul>\n<li><p>a</p></li>\n<li><p>b</p></li>\n</ul>');
  assert.equal(md('3. c\n4. d'), '<ol start="3">\n<li>c</li>\n<li>d</li>\n</ol>');
  assert.equal(md('- a\n  - a1\n  - a2\n- b'), '<ul>\n<li>a\n<ul>\n<li>a1</li>\n<li>a2</li>\n</ul></li>\n<li>b</li>\n</ul>');
  assert.equal(md('- a\nlazy line'), '<ul>\n<li>a\nlazy line</li>\n</ul>');
});

test('quotes, code blocks, tables and raw HTML', () => {
  assert.equal(md('> one\n> two\n>\n> - x'), '<blockquote>\n<p>one\ntwo</p>\n<ul>\n<li>x</li>\n</ul>\n</blockquote>');
  assert.equal(md('```js\nconst a = "<b>";\n```'), '<pre><code class="language-js">const a = &quot;&lt;b&gt;&quot;;</code></pre>');
  assert.equal(md('| Item | Amount |\n|:--|--:|\n| Room | ₹18,400 |\n| GST \\| tax | `a|b` |'),
    '<table>\n<thead><tr><th class="align-left">Item</th><th class="align-right">Amount</th></tr></thead>\n<tbody>\n<tr><td class="align-left">Room</td><td class="align-right">₹18,400</td></tr>\n<tr><td class="align-left">GST | tax</td><td class="align-right"><code>a|b</code></td></tr>\n</tbody>\n</table>');
  assert.equal(md('<details>\n<summary>More</summary>\n</details>'), '<details>\n<summary>More</summary>\n</details>');
});

test('directive attributes: values, quotes, id, class, flags, and errors', () => {
  assert.deepEqual(parseAttrs('{name=paus seed="the rain" #cover .wide steps}'), { attrs: { name: 'paus', seed: 'the rain', steps: true }, id: 'cover', classes: ['wide'] });
  assert.throws(() => parseAttrs('{title="unclosed}'), /the quoted value of title is not closed/);
  assert.throws(() => parseAttrs('{= bad}'), /key=value/);
});

test('::scene and :::scene, with Markdown slotted over the drawing', () => {
  const r = render('::scene{name=paus register=warm intensity=0.6}');
  assert.equal(r.html, '<sg-scene name="paus" register="warm" intensity="0.6"></sg-scene>');
  assert.deepEqual(r.requires.map(q => q.js), ['/packages/scenes/paus/index.js']);
  assert.equal(md(':::scene{name=kolam}\n## The door is open\n:::'), '<sg-scene name="kolam">\n<h2 id="the-door-is-open">The door is open</h2></sg-scene>');
});

test('::price-table writes a readable fallback and checks its dates', () => {
  assert.equal(md('::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20}'),
    '<sg-price-table from="kernels-booking" arrival="2026-11-16" departure="2026-11-20" guests="2">\n<p class="folio-fallback">Prices for 16 to 20 November 2026, for 2 guests, are worked out from the rate card when this document opens.</p>\n</sg-price-table>');
  assert.deepEqual(problems('Intro\n\n::price-table{from=kernels-booking arrival=2026-11-20 departure=2026-11-16}').map(p => [p.line, p.message]),
    [[3, '::price-table: departure must be after arrival']]);
  assert.match(problems('::price-table{from=kernels-booking arrival=2026-02-30 departure=2026-03-02}')[0].message, /arrival must be a real date written YYYY-MM-DD/);
  assert.match(problems('::price-table{arrival=2026-11-16 departure=2026-11-20}')[0].message, /needs from, like ::price-table\{from=kernels-booking\}/);
});

test(':::timeline, :::note, :::diagram and ::signature', () => {
  const t = md(':::timeline{scrub}\n- 2026-11-01: Survey the house\n- 2026-12: **Repair** the roof\n- Week 12: Open\n:::');
  assert.match(t, /<sg-timeline scrub>/);
  assert.match(t, /<time datetime="2026-11-01">1 November 2026<\/time>/);
  assert.match(t, /<time datetime="2026-12">December 2026<\/time> <span class="folio-timeline__what"><strong>Repair<\/strong> the roof/);
  assert.match(t, /<span class="folio-timeline__when">Week 12<\/span>/);
  assert.equal(md(':::note{tone=warning}[Before you sign]\nRead the **terms**.\n:::'),
    '<aside class="folio-note" data-tone="warning" role="note">\n<p class="folio-note__label">Before you sign</p>\n<p>Read the <strong>terms</strong>.</p>\n</aside>');
  const d = md(':::diagram{#flow title="How a booking flows" steps direction=down}\nGuest -> Portal: books\nPortal -> Owner: asks\n:::');
  assert.match(d, /^<sg-diagram id="flow" data-src="Guest -&gt; Portal: books\nPortal -&gt; Owner: asks" data-opts="\{&quot;title&quot;:&quot;How a booking flows&quot;,&quot;direction&quot;:&quot;down&quot;\}" data-steps data-direction="down" data-direction-set>/, 'without a renderer, the same data-* contract as renderDiagram (decision 0013)');
  assert.match(d, /<figure class="sg-diagram folio-diagram"><figcaption>How a booking flows<\/figcaption><pre class="folio-diagram__source">Guest -&gt; Portal: books/);
  assert.deepEqual(problems(':::diagram\nRain => Roof\n:::'), [], 'a flow counts as an arrow');
  const s = md('::signature{name="Sarat Chandran" role="for Asymmetrica" required}');
  assert.match(s, /<label for="folio-signature-1">Type your full name to sign<\/label>/);
  assert.match(s, /<input id="folio-signature-1" name="signature" autocomplete="name" required aria-describedby="folio-signature-1-for">/);
  assert.equal(md('::signature'), md('::signature'), 'the same source gives the same page');
});

test('mistakes are reported with their line numbers, all at once', () => {
  const src = [
    '# Proposal',                                  // 1
    '',                                            // 2
    '::scene',                                     // 3  no name
    '::sparkle{x=1}',                              // 4  unknown directive
    ':::timeline',                                 // 5
    '- next week we start',                        // 6  no "when: what"
    '- 2026-13-01: Nothing',                       // 7  not a date
    ':::',                                         // 8
    '::note{tone=warning}',                        // 9  note is a container
    '::scene{name=paus colour}',                   // 10 colour is a flag with no value? passes as extra; register bad below
    '::scene{name=paus register=loud}',            // 11
    ':::note',                                     // 12 never closed
    'text',                                        // 13
  ].join('\n');
  const p = problems(src).map(x => `${x.line}: ${x.message}`);
  assert.deepEqual(p, [
    '3: ::scene: needs name, like ::scene{name=...}',
    '4: ::sparkle is not a directive Folio knows. Use one of: scene, diagram, price-table, timeline, signature, note',
    '6: each timeline line is "- when: what", like - 2026-11-01: Survey the house, or "1. **Title.** What happens"',
    '7: "2026-13-01" is not a real date. Write YYYY-MM-DD or YYYY-MM, or a label like Week 1',
    '9: note holds content: write :::note, then its lines, then ::: on its own line',
    '11: ::scene: register must be one of quiet, warm, playful (it is "loud")',
    '12: :::note is not closed. Add a line with ::: after its content (nested containers use more colons).',
  ]);
  assert.match(new MarkdownError(problems(src)).message, /^line 3: ::scene: needs name/);
});

test('an unclosed code block is caught', () => {
  assert.deepEqual(problems('Intro\n\n```\ncode').map(p => p.line), [3]);
});

test('dates the way people write them', () => {
  assert.equal(sayDate('2026-11-16'), '16 November 2026');
  assert.equal(sayDate('2026-11-28', '2026-12-02'), '28 November to 2 December 2026');
  assert.equal(sayDate('2026-12-30', '2027-01-02'), '30 December 2026 to 2 January 2027');
  assert.equal(isoDate('2026-02-29'), null, '2026 is not a leap year');
});

test('toDocument: a whole page, importing only what exists', () => {
  const src = '---\ntitle: A proposal for Casa Exemplo\nregister: warm\nlang: en-IN\n---\n# Casa Exemplo\n\n::scene{name=paus}\n\n::signature{name="Owner"}\n';
  const { html, warnings } = toDocument(src, { exists: p => p.startsWith('/packages/scenes/') });
  assert.match(html, /^<!doctype html>\n<html lang="en-IN" data-register="warm">/);
  assert.match(html, /<title>A proposal for Casa Exemplo<\/title>/);
  assert.match(html, /<link rel="stylesheet" href="\/packages\/tokens\/tokens.css">/);
  assert.match(html, /import '\/packages\/scenes\/paus\/index.js';/);
  assert.doesNotMatch(html, /signature\.js/, 'a missing module is not imported');
  assert.deepEqual(warnings, ['line 10: ::signature needs /packages/components/signature/signature.js, which is not in this project yet, so the page shows its plain version.']);
  assert.throws(() => toDocument('---\nregister: loud\n---\nx'), /register must be quiet, warm or playful/);
  assert.match(toDocument('Just text', { exists: () => true }).warnings[0], /no title/);
});

test('renderers write a directive at build time, and their problems keep document line numbers', () => {
  const renderers = {
    diagram: ({ source, title }) => ({ html: `<sg-diagram data-title="${title}">${source.split('\n').length} lines</sg-diagram>`, errors: [{ line: 2, message: 'a connection needs two ends' }] }),
    'price-table': a => `<table data-nights="${a.arrival}/${a.departure}"></table>`,
    timeline: ({ lines, title }) => ({ html: `<sg-timeline label="${title}"></sg-timeline>`, problems: [{ line: lines[0].line, message: 'checked by the timeline' }] }),
  };
  const src = '# T\n\n:::diagram{title=Flow}\n\nA -> B\nB ->\n:::\n\n::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20}\n';
  let err;
  try { render(src, { renderers }); } catch (e) { err = e; }
  assert.deepEqual(err.problems, [{ line: 6, message: ':::diagram: An arrow needs a name at each end, like Guest -> Portal.' }], 'line 2 of the source is line 6 of the document, checked by the grammar before any renderer');
  const ok = render('::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20}\n\n:::timeline[Plan]\n- a: b\n:::', { renderers: { 'price-table': renderers['price-table'], timeline: ({ title }) => ({ html: `<sg-timeline label="${title}"></sg-timeline>` }) } });
  assert.match(ok.html, /<sg-price-table from="kernels-booking" arrival="2026-11-16" departure="2026-11-20" guests="2">\n<table data-nights="2026-11-16\/2026-11-20"><\/table>\n<\/sg-price-table>/);
  assert.match(ok.html, /<sg-timeline label="Plan"><\/sg-timeline>/, 'with a renderer, the timeline checks its own lines');
});

test('the real diagram renderer through the builder hook: id, direction, steps and line numbers (decision 0013)', async () => {
  const { renderersFor } = await import('../build/renderers.mjs');
  const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const { renderers } = await renderersFor(root, false);
  const out = render(':::diagram{#flow title="How a booking flows" steps direction=down}\nGuest -> Portal: books\nPortal -> Owner: asks\n:::', { renderers });
  assert.match(out.html, /^<sg-diagram id="flow"[^>]* data-steps data-direction="down" data-direction-set/);
  assert.match(out.html, /<ol class="sg-diagram-steps" id="flow-text"/);
  let err;
  try { render('# T\n\n:::diagram\n\nA -> B\nB ->\n:::', { renderers }); } catch (e) { err = e; }
  assert.deepEqual(err.problems.map(p => p.line), [6]);
});

test('::price-table view=bands takes no dates; a stay still needs both', () => {
  assert.equal(md('::price-table{from=kernels-booking view=bands}'),
    '<sg-price-table from="kernels-booking" view="bands">\n<p class="folio-fallback">The rate card, season by season, is worked out from the booking kernels when this document opens.</p>\n</sg-price-table>');
  assert.deepEqual(problems('::price-table{from=kernels-booking}').map(p => p.message),
    ['::price-table: needs arrival, like ::price-table{arrival=2026-11-16}, or view=bands for the whole rate card', '::price-table: needs departure, like ::price-table{departure=2026-11-16}, or view=bands for the whole rate card']);
  assert.match(problems('::price-table{from=kernels-booking view=bands arrival=2026-11-16}')[0].message, /takes no arrival or departure/);
});

test('::signature for, and the option to sign for as native radios', () => {
  const doc = '**Option 1, the launch.** The site. ₹1.\n\n**Option 2, the launch & the engine.** More.\n\n::signature{name=Maria for="Casa Exemplo" option required}';
  const html = md(doc);
  assert.match(html, /<p class="folio-signature__for" id="folio-signature-1-for">Maria, for Casa Exemplo<\/p>/);
  assert.match(html, /<div class="folio-signature">\n<fieldset class="folio-signature__options">\n<legend>The option you choose<\/legend>/);
  assert.match(html, /<input type="radio" id="folio-signature-1-option-1" name="option" value="1" required><label for="folio-signature-1-option-1">Option 1, the launch<\/label>/);
  assert.match(html, /value="2" required><label for="folio-signature-1-option-2">Option 2, the launch &amp; the engine<\/label>/);
  assert.ok(html.indexOf('</fieldset>') < html.indexOf('<sg-signature>'), 'the radios sit before the signature, whose first input is the name');
  assert.match(md('::signature{options="Keep it small|Go big"}'), /value="2"><label for="folio-signature-1-option-2">Go big<\/label>/);
  assert.deepEqual(problems('Intro\n\n::signature{option}').map(p => p.line), [3]);
});

test(':::timeline without its renderer reads the numbered form too', () => {
  const html = md(':::timeline\n1. **You choose.** Sign below.\n2. **We build.** On your domain.\n:::');
  assert.match(html, /<li><strong class="folio-timeline__step">You choose\.<\/strong> <span class="folio-timeline__what">Sign below\.<\/span><\/li>/);
});

test(':::timeline without its renderer refuses a mix of numbered and dated lines', () => {
  assert.deepEqual(problems('Plan\n\n:::timeline\n1. **You choose.** Sign.\n- 2026-12: New tiles\n:::').map(p => p.line), [3]);
  assert.match(problems(':::timeline\n1. **A.** a\n- 2026-12: b\n:::')[0].message, /mixes numbered steps/);
});

test(':::diagram is checked by its own grammar with or without a build, at document line numbers', async () => {
  const src = '# T\n\nIntro\n\n:::diagram{title=Flow}\n\nGuest -> Site: books\nSite ->\nA -> B -> C\n:::\n';
  const lines = e => e.problems.map(p => [p.line, p.message]);
  let plain;
  try { render(src); } catch (e) { plain = e; }
  assert.deepEqual(lines(plain), [
    [8, ':::diagram: An arrow needs a name at each end, like Guest -> Portal.'],
    [9, ':::diagram: Write one connection per line: A -> B, then B -> C on the next line.'],
  ], 'unbuilt Markdown reports the bad lines, not only a missing arrow');
  const { renderersFor } = await import('../build/renderers.mjs');
  const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const { renderers } = await renderersFor(root, false);
  let built;
  try { render(src, { renderers }); } catch (e) { built = e; }
  assert.deepEqual(lines(built), lines(plain), 'the build reports the same lines, once each');
});
