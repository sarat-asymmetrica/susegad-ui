import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeText, unfilled, unfilledIn, levelOf, consentInner, renderConsent, PARTS, VALUES } from './consent.core.js';
import { BY_LANG } from './consent.strings.js';
import { framePaths } from './skins/warm.js';
import { ticketPath } from './skins/playful.js';

const EVENT = { fields: 'your name and your email address', purpose: 'confirm your place and send you the ticket and any change to this event', period: '30 days after the event' };
const FULL = { ...EVENT, contact: 'hello@conclave.example.in', site: 'Mandovi Conclave', complain: 'If you are not satisfied, write to the organisers at the same address.' };

test('the notice says what is collected, why, for how long, whom to ask and how to withdraw', () => {
  const t = noticeText('en', FULL);
  assert.equal(t.heading, 'What we do with your details');
  assert.equal(t.collect, 'We ask for your name and your email address.');
  assert.equal(t.why, 'We use them to confirm your place and send you the ticket and any change to this event, and for nothing else.');
  assert.equal(t.howLong, 'We keep them until 30 days after the event, then we delete them.');
  assert.equal(t.ask, 'To ask what we hold, to correct it, or to have it deleted, write to hello@conclave.example.in.');
  assert.match(t.withdraw, /^You can take back your consent at any time by writing to the same address\./);
  assert.equal(t.complain, 'If you are not satisfied, write to the organisers at the same address.');
  assert.equal(t.checkbox, 'I have read this, and I agree that Mandovi Conclave may use my details in this way.');
  assert.equal(t.needed, 'Please tick the box if you are happy to go on. We cannot use your details without it.');
});

test('the six lines come in the order a person needs them', () => {
  assert.deepEqual(PARTS, ['collect', 'why', 'howLong', 'ask', 'withdraw', 'complain']);
  const html = consentInner({ values: FULL, id: 'c' });
  const at = PARTS.map(p => html.indexOf(`data-part="${p}"`));
  assert.ok(at.every((n, i) => n > 0 && (i === 0 || n > at[i - 1])), at.join());
  assert.ok(html.indexOf('data-part="complain"') < html.indexOf('type="checkbox"'), 'the box comes after the words');
});

test('a value the site has not given is a visible placeholder, never a blank', () => {
  const t = noticeText('en', {});
  assert.match(t.collect, /\[fields: what the form asks for\]/);
  assert.match(t.why, /\[purpose: why you need them\]/);
  assert.match(t.howLong, /\[period: how long you keep them\]/);
  assert.match(t.ask, /\[contact: the site fills in a real address\]/);
  assert.match(t.checkbox, /\[site name\]/);
  assert.equal(t.complain, '[complaint line: the site fills this in, naming where a visitor can complain if they are not satisfied]');
  assert.equal(unfilledIn('en', {}).length, 6);
  assert.equal(unfilledIn('en', EVENT).length, 3, 'contact, site and complain are still the site’s to give');
  assert.equal(unfilledIn('en', FULL).length, 0);
  assert.equal(unfilledIn('en', { ...FULL, contact: '   ' }).length, 1, 'only spaces is still blank');
});

test('unfilled finds each [placeholder] whole, in Devanagari and Romi too', () => {
  assert.deepEqual(unfilled('write to [contact: x] or [site name]'), ['[contact: x]', '[site name]']);
  assert.deepEqual(unfilled('[तक्रारीची वळ: साय्ट आपूण भरता]'), ['[तक्रारीची वळ: साय्ट आपूण भरता]']);
  assert.deepEqual(unfilled('nothing here'), []);
  assert.deepEqual(unfilled(undefined), []);
});

test('Konkani: the deck’s sentences, in both scripts, with the site’s values in them', () => {
  const deva = noticeText('gom-Deva', { fields: 'A', purpose: 'B', period: 'C', contact: 'D', site: 'E' });
  assert.equal(deva.heading, 'तुमच्या तपशीलांचें आमी कितें करतात');
  assert.equal(deva.collect, 'आमी A विचारतात.');
  assert.equal(deva.why, 'तीं आमी B खातीर वापरतात, आनी हेर कशाखातीरूय ना.');
  assert.equal(deva.howLong, 'तीं C मेरेन दवरतात, मागीर काडून उडयतात.');
  assert.match(deva.ask, /D वयर बरयात\.$/);
  assert.equal(deva.complain, '[complaint line: the site fills this in, naming where a visitor can complain if they are not satisfied]', 'a placeholder is English in every language');
  assert.match(deva.checkbox, /^म्हज्या तपशीलांचो E /);
  const latn = noticeText('gom-Latn', { fields: 'A', purpose: 'B', period: 'C', contact: 'D', site: 'E' });
  assert.equal(latn.collect, 'Ami A vichartat.');
  assert.equal(latn.howLong, 'Tim C meren dovortat, magir kadun udoitat.');
  assert.match(latn.needed, /^Pudem vachpak khuxi asalear/);
  assert.ok(!/[ऀ-ॿ]/.test(Object.values(latn).join('')), 'Romi never borrows Devanagari');
});

test('every key has its Konkani, and the placeholders for a builder stay English', () => {
  const keys = Object.keys(BY_LANG.en).filter(k => k !== 'blank' && k !== 'complain');
  for (const tag of ['gom-Deva', 'gom-Latn']) assert.deepEqual(Object.keys(BY_LANG[tag]).sort(), keys.sort(), tag);
  assert.deepEqual(Object.keys(BY_LANG.en.blank), VALUES);
});

test('the visitor’s words name no law and no body (ruling of 8 October 2026)', () => {
  const all = ['en', 'gom-Deva', 'gom-Latn'].flatMap(l => Object.values(noticeText(l, FULL)));
  for (const w of all) assert.ok(!/\b(Act|Board|DPDP|Data Protection|Government|Ministry)\b/i.test(w), w);
});

test('plain words: no urgency, no exclamation, no em dash, sentence case', () => {
  const english = Object.values(noticeText('en', FULL)).join(' ');
  assert.ok(!/[!—]/.test(english));
  assert.ok(!/\b(personal data|data principal|exercise your rights|hereby|pursuant)\b/i.test(english));
});

test('the markup: a native required checkbox, never ticked, inside its label, with a note that says what is missing', () => {
  const html = renderConsent({ lang: 'en', values: FULL, id: 'reg' });
  assert.match(html, /^<sg-consent id="reg" role="group" aria-labelledby="reg-h">/);
  assert.match(html, /<h3 class="sg-consent-heading" id="reg-h">What we do with your details<\/h3>/);
  const input = html.match(/<input[^>]*>/)[0];
  assert.match(input, /type="checkbox"/);
  assert.match(input, /name="consent"/);
  assert.match(input, / required/);
  assert.ok(!/checked/.test(html.replace(/sg-check/g, '')), 'never pre-ticked');
  assert.match(html, /<label><input [^>]*> <span class="sg-consent-words">I have read this, and I agree that Mandovi Conclave may use my details in this way\.<\/span><\/label>/);
  // the words are one flex item beside the box, so a placeholder inside them cannot become a column of its own
  assert.equal((consentInner({ id: 'z' }).match(/<label>.*<\/label>/)[0].match(/<span class="sg-consent-words">/g) ?? []).length, 1);
  assert.match(html, /<sg-field-note for="reg-box" validate data-value-missing="Please tick the box if you are happy to go on\. We cannot use your details without it\."><\/sg-field-note>/);
  assert.match(input, /id="reg-box"/);
});

test('words from the site are escaped, so a name with an ampersand or a tag cannot break the page', () => {
  const html = consentInner({ values: { ...FULL, site: 'Tom & Jerry <b>"Co"</b>', fields: '<script>x</script>' }, id: 'x' });
  assert.ok(!/<script>|<b>/.test(html));
  assert.match(html, /Tom &amp; Jerry &lt;b&gt;&quot;Co&quot;&lt;\/b&gt;/);
});

test('a placeholder is marked as English, so a screen reader does not read it in Konkani’s voice', () => {
  const html = consentInner({ lang: 'gom-Latn', values: {}, id: 'x' });
  assert.match(html, /<span class="sg-consent-blank" lang="en">\[contact: the site fills in a real address\]<\/span>/);
  assert.match(html, /<span class="sg-consent-blank" lang="en">\[complaint line: the site fills this in[^\]]*\]<\/span>/, 'the complaint placeholder too: every placeholder is English');
  assert.equal((html.match(/class="sg-consent-blank"/g) ?? []).length, (html.match(/class="sg-consent-blank" lang="en"/g) ?? []).length, 'every placeholder is marked lang=en');
});

test('heading level stays between 2 and 6', () => {
  assert.deepEqual([undefined, 'x', 1, 2, 4, 6, 7, '5'].map(levelOf), [3, 3, 3, 2, 4, 6, 3, 5]);
  assert.match(consentInner({ level: 2, id: 'a' }), /<h2 class="sg-consent-heading" id="a-h">/);
});

test('ids are unique when none is given', () => {
  const a = renderConsent(), b = renderConsent();
  assert.notEqual(a.match(/id="([^"]+)"/)[1], b.match(/id="([^"]+)"/)[1]);
});

// ── the shapes the skins draw ──
test('the pencil box is four strokes that run past their corners, the same for a seed and different for another', () => {
  const a = framePaths(400, 300, 5), b = framePaths(400, 300, 5), c = framePaths(400, 300, 6);
  assert.equal(a.length, 4);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const start = d => d.match(/^M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
  assert.ok(start(a[0])[0] < 0, 'the top stroke starts left of the box');
  assert.ok(start(a[3])[1] > 300, 'the left stroke starts below the box');
});

test('the ticket has a round bite out of each side at the tear line, inside the box', () => {
  const { edge, perf, bites, y } = ticketPath(400, 300, 220);
  assert.equal(y, 220);
  assert.deepEqual(bites, [[0, 220, 7], [400, 220, 7]]);
  assert.match(edge, /^M10 0 H390 A10 10 0 0 1 400 10 V213 A7 7 0 0 0 400 227 V290 /);
  assert.match(perf, /^M13 220 H387$/);
  const low = ticketPath(400, 100, 5);
  assert.ok(low.y >= 19 && low.y <= 81, 'a tear line too close to a corner is moved in');
});
