import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitsOf, waLink, mailtoLink, readWaLink, STRINGS } from './reach.core.js';
import { palettes, resolveRoles, contrast, toRgb, oklchToHex } from '../../tokens/tokens.js';

test('digitsOf keeps only digits', () => {
  assert.equal(digitsOf('+91 98765-43210'), '919876543210');
  assert.equal(digitsOf(null), '');
});

test('waLink: digits only, a prefilled message encoded, and it reads back the same', () => {
  const href = waLink('+91 98765 43210', 'Hello! A project & a question?');
  assert.equal(href, 'https://wa.me/919876543210?text=Hello!%20A%20project%20%26%20a%20question%3F');
  assert.deepEqual(readWaLink(href), { digits: '919876543210', text: 'Hello! A project & a question?' });
  assert.equal(waLink('0044 20 7946 0958'), 'https://wa.me/442079460958', 'leading zeros of an international prefix go');
  assert.throws(() => waLink('98765'), /full international number/);
});

test('mailtoLink encodes spaces as %20, never +', () => {
  assert.equal(mailtoLink('hello@example.com', { subject: 'A project', body: 'Hi there' }), 'mailto:hello@example.com?subject=A%20project&body=Hi%20there');
  assert.equal(mailtoLink('hello@example.com'), 'mailto:hello@example.com');
  assert.throws(() => mailtoLink('not an email'));
});

test('the words say what happened and, if it failed, what to do', () => {
  assert.match(STRINGS.copiedLine('+91 1'), /^Copied \+91 1\./);
  assert.match(STRINGS.failedLine('+91 1'), /Couldn't copy\. The number is \+91 1; select it/);
});

// The inland letter keeps daylight colours at night (color-scheme: light inside):
// its paper is the palette's info hue at L 0.91, C 0.032 (reach.css), with the
// older 13% mix as the fallback. Check the words on both.
const mix = (a, b, t) => {
  let dh = (b.h - a.h) % 360; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  return oklchToHex({ l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: a.h + dh * t });
};
for (const name of Object.keys(palettes)) {
  test(`AA: ${name}: the inland letter's words read at 4.5:1, in either theme (it is always light)`, () => {
    const r = resolveRoles(name, 'light');
    for (const paper of [toRgb(oklchToHex({ l: 0.91, c: 0.032, h: r.info.h })), toRgb(mix(r['surface-raised'], r.info, 0.13))]) {
      for (const role of ['text', 'text-soft', 'accent-text']) assert.ok(contrast(toRgb(r[role].hex), paper) >= 4.5, `${role}: ${contrast(toRgb(r[role].hex), paper).toFixed(2)}`);
      assert.ok(contrast(toRgb(r.focus.hex), paper) >= 3, 'focus ring');
    }
  });
}
