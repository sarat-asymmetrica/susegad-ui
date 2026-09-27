// The enquiry's native rules, read from the page itself, so the test and the
// page can never disagree. Browsers compile `pattern` as ^(?:pattern)$ with
// the v flag, where a hyphen inside a class must be escaped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const attr = (id, name) => {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 's'))?.[0] ?? '';
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
};
const contact = new RegExp(`^(?:${attr('f-contact', 'pattern')})$`, 'v');

test('the contact pattern compiles as browsers compile it', () => {
  assert.ok(attr('f-contact', 'pattern'), 'the contact field has a pattern');
  assert.doesNotThrow(() => new RegExp(attr('f-contact', 'pattern'), 'v'));
});

test('phone numbers are welcome as people write them, hyphens included', () => {
  for (const ok of ['98220-12345', '+91 98220 12345', '9822012345', '98220 12345', '+91-98220-12345', '0832 225 1234']) {
    assert.ok(contact.test(ok), ok);
  }
});

test('numbers in Devanagari and Kannada numerals pass, as typed (S4)', () => {
  for (const ok of ['९८२२० १२३४५', '+९१ ९८२२० १२३४५', '೯೮೨೨೦-೧೨೩೪೫']) assert.ok(contact.test(ok), ok);
});

test('email addresses pass', () => {
  for (const ok of ['name@example.com', 'anjali.kamat@mail.co.in']) assert.ok(contact.test(ok), ok);
});

test('letters, and numbers too short to call, fail', () => {
  for (const bad of ['call me', '98220 abcde', 'ninety-eight', '12345', 'name@example', '+', '']) {
    assert.ok(!contact.test(bad), bad);
  }
});

test('the hint names both ways of writing a number', () => {
  assert.match(attr('f-contact', 'title'), /98220 12345 or 98220-12345/);
});

test('the facade drawing is baked from its strokes, and small enough to ship', async () => {
  const { facadeSvg } = await import('./facade.bake.mjs');
  const baked = readFileSync(new URL('./facade.svg', import.meta.url), 'utf8');
  assert.equal(facadeSvg(), baked, 'facade.svg is what facade.bake.mjs makes: run it after changing the strokes');
  assert.ok(baked.length < 20 * 1024, `${baked.length} bytes`);
  assert.match(html, /<div class="enquiry__facade" aria-hidden="true"><\/div>/, 'on the page, and hidden from assistive technology');
});
