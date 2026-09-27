// Drift check for the booking kernels. The library's kernels are the source of
// truth; drift.fixture.json records what they answer for 60 stays (the ordinary,
// turnover mornings, taken nights, minimum stays, band edges, the window, the
// longest stay, malformed dates, and a seeded spread across the year).
//
// Checking your own copy (a server's, say):
//   1. Copy this file and drift.fixture.json next to your tests. They come with
//      the kernels when you run `susegad add kernels-booking`.
//   2. Point KERNELS below at your copy's index.js, relative to this file, and
//      make sure it exports RATES, quote, validateRange and occupiedNights.
//   3. Run it with `node --test`. Every case deep-equal means your copy has not
//      drifted. A failure names the stay and the function that answered differently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const KERNELS = './index.js'; // your copy's index.js, relative to this file
const { RATES, quote, validateRange, occupiedNights } = await import(new URL(KERNELS, import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('./drift.fixture.json', import.meta.url), 'utf8'));
const ctx = { occupied: occupiedNights(fixture.blocks), today: fixture.today, window: RATES.window };

test('the rate card matches', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RATES)), fixture.rates);
});

test(`quote and validateRange agree on all ${fixture.cases.length} stays`, () => {
  assert.ok(fixture.cases.length >= 60);
  for (const c of fixture.cases) {
    const at = `${c.arrival} to ${c.departure}`;
    assert.deepEqual(JSON.parse(JSON.stringify(quote(c.arrival, c.departure))), c.quote, `quote, ${at}`);
    let v;
    try { v = validateRange(c.arrival, c.departure, ctx); } catch (e) { v = { threw: String(e.message) }; }
    assert.deepEqual(JSON.parse(JSON.stringify(v)), c.validateRange, `validateRange, ${at}`);
  }
});

test('the fixture covers what matters: refusals as well as quotes', () => {
  const reasons = fixture.cases.flatMap(c => [...c.quote.reasons, ...(c.validateRange.reasons ?? [])]).join('\n');
  for (const re of [/already taken/, /3-night minimum/, /Christmas band has a 4-night minimum/, /notice/, /opens for stays/, /open until/, /capped at 21 nights/, /not valid/]) {
    assert.match(reasons, re);
  }
});
