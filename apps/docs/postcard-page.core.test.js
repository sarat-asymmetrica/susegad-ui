// The /postcard page's pure part: what it says is Kathakar's words, the numbers come from the registry, and the scene row is the recipe's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTCARD, sceneCounts, postcardDescription, postcardMain } from './postcard-page.core.js';
import { SCENES, DEFAULT_SCENE } from '../../packages/recipes/picture-postcard/scenes.js';
import { GOA_OCT_2026 } from '../../packages/recipes/picture-postcard/events/goa-oct-2026.js';
import { CONCLAVE_2026 } from '../../packages/recipes/picture-postcard/events/conclave-2026.js';
import { NAME_MAX } from '../../packages/recipes/picture-postcard/postcard.core.js';

const posters = Object.fromEntries(SCENES.map(s => [`scene-${s.name}`, { w: 688, h: 459 }]));
const main = (counts = { total: 33, goan: 28 }) => postcardMain({ scenes: SCENES, posters, counts, nameMax: NAME_MAX, defaultScene: DEFAULT_SCENE });

test('sceneCounts: reads the scenes and the Goan ones from the registry items, whatever they are', () => {
  const items = [
    { type: 'scene', motif: { origin: 'goa' } }, { type: 'scene', motif: { origin: 'goa' } }, { type: 'scene', motif: { origin: 'deccan' } }, { type: 'scene' },
    { type: 'component', motif: { origin: 'goa' } }, { type: 'recipe' },
  ];
  assert.deepEqual(sceneCounts(items), { total: 4, goan: 2 });
  assert.deepEqual(sceneCounts([]), { total: 0, goan: 0 });
});

test('the page says the counts it is given and types none of its own', () => {
  const html = main({ total: 7, goan: 3 });
  assert.match(html, /with 7 scenes drawn in code, 3 of them from Goa\./);
  assert.ok(!/\b(33|32|28)\b/.test(html), 'no scene count is typed into the page');
  assert.match(main({ total: 40, goan: 31 }), /with 40 scenes drawn in code, 31 of them from Goa\./);
});

test('the name field is empty with a placeholder, labelled, hinted and told its limit from the recipe', () => {
  const html = main();
  assert.match(html, /<label for="name">Your name<\/label>/);
  assert.match(html, /<input id="name"[^>]*placeholder="Asha Naik"[^>]*maxlength="60"[^>]*autocomplete="name"[^>]*aria-describedby="name-hint"/);
  assert.ok(!/<input id="name"[^>]*\bvalue=/.test(html), 'no value is filled in for the visitor');
  assert.match(html, /id="name-hint"[^>]*>Any name, in any script, up to 60 letters\. The card changes as you type\./);
  assert.equal(NAME_MAX, 60);
});

test('the scene row is one radio for each of the recipe\'s scenes, the default checked, and an Another scene button', () => {
  const html = main();
  const radios = [...html.matchAll(/<input type="radio" name="scene-pick" value="(\w+)"( checked)?>/g)];
  assert.deepEqual(radios.map(r => r[1]), SCENES.map(s => s.name));
  assert.deepEqual(radios.filter(r => r[2]).map(r => r[1]), [DEFAULT_SCENE]);
  for (const s of SCENES) assert.ok(html.includes(`<span class="pc-thumb-name">${s.label}</span>`), s.label);
  assert.match(html, /<button type="button" id="another-scene"[^>]*aria-label="Show another scene">Another scene<\/button>/);
  assert.match(html, /<legend>Choose a scene<\/legend>/);
  assert.match(html, /<input type="hidden" id="scene" name="scene" value="ferry">/);
});

test('the four buttons are named for the file they make, the progress bar and Cancel have their names, the GIF buttons point at the still-scene note', () => {
  const html = main();
  for (const b of ['Save picture', 'Save GIF', 'Share picture', 'Share GIF']) assert.ok(html.includes(`>${b}</button>`), b);
  assert.match(html, /<progress id="progress"[^>]*aria-label="Making the GIF">/);
  assert.match(html, /id="cancel"[^>]*aria-label="Cancel making the GIF">Cancel<\/button>/);
  assert.equal((html.match(/aria-describedby="gif-note"/g) ?? []).length, 2);
  assert.match(html, /<p id="status" class="pc-status" role="status"><\/p>/);
});

test('the privacy line, the share note and the make-your-own line are Kathakar\'s words, and the address is a link', () => {
  const html = main();
  assert.ok(html.includes('Your name stays on your device. The card is made right here in your browser, and nothing is sent or stored anywhere else.'));
  assert.ok(html.includes('Once you share a card, the people you send it to can see the name on it.'));
  assert.match(html, /Know someone who would like one\? They can make theirs at <a href="postcard">susegad\.asymmetrica\.ai\/postcard<\/a>/);
  assert.ok(html.includes('Postcards are drawn in your browser, so this page needs JavaScript. Please switch it on and come back.'));
});

test('the page never writes an em dash, and its description names the stamp from the event', () => {
  assert.ok(!/[—]/.test(JSON.stringify(POSTCARD)));
  const d = postcardDescription(GOA_OCT_2026);
  assert.equal(d, 'Make a free postcard of Goa with your name on it, stamped Goa. It is drawn in your browser, so your name stays on your device.');
  assert.ok(d.length <= 160);
  assert.match(postcardDescription(CONCLAVE_2026), /stamped Conclave 2026./, 'the Conclave config stays as an example');
  assert.match(postcardDescription({ stamp: 'Goa Fest' }), /stamped Goa Fest\./);
});

test('a scene with no poster still gets its place in the row', () => {
  const html = postcardMain({ scenes: SCENES, posters: {}, counts: { total: 1, goan: 1 }, nameMax: 60, defaultScene: 'ferry' });
  assert.equal([...html.matchAll(/type="radio"/g)].length, SCENES.length);
});

test('press and hold: the page carries a picture slot, empty and hidden, with a live line beside it, until a save fills them', () => {
  const html = main();
  assert.match(html, /<div id="hold" class="pc-hold">\s*<p id="hold-line" class="pc-note" role="status"><\/p>\s*<img id="hold-img"[^>]*alt=""[^>]*hidden[^>]*aria-describedby="hold-line">/);
  assert.ok(html.indexOf('id="status"') < html.indexOf('id="hold"') && html.indexOf('id="hold"') < html.indexOf('</form>'), 'in the form, after the status line');
});
