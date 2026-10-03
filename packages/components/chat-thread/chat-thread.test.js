import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactHtml, renderThread, runs, clockOf, dayOf, leakIn, bubbleOutline, arrival, STRINGS } from './chat-thread.core.js';
import { palettes, resolveRoles, contrast, toRgb } from '../../tokens/tokens.js';

test('redact takes out phone numbers in the usual shapes, and keeps only the kind', () => {
  for (const n of ['+91 98765 43210', '+919876543210', '98765-43210', '9876543210', '+44 20 7946 0958']) {
    const r = redact(`call ${n} now`);
    assert.deepEqual(r, [{ text: 'call ' }, { redacted: 'phone', label: STRINGS.redacted.phone }, { text: ' now' }], n);
  }
});

test('redact leaves dates, times, prices and short numbers alone', () => {
  for (const s of ['on 2026-09-27 at 10:12', '₹25,500 for 3 nights', 'order 4412', 'room 12, 4 guests']) {
    assert.deepEqual(redact(s), [{ text: s }], s);
  }
});

test('redact takes out names as whole words, any case, and emails', () => {
  const r = redact('Ask Rohan or rohan.k@example.com; Rohanda is someone else, ROHAN too', { names: ['Rohan'] });
  assert.deepEqual(r.map(x => x.redacted ?? x.text), ['Ask ', 'name', ' or ', 'email', '; Rohanda is someone else, ', 'name', ' too']);
});

test('redactHtml never carries the original characters, and escapes what it keeps', () => {
  const html = redactHtml('<b>Call</b> +91 98765 43210, ask for Rohan', { names: ['Rohan'] });
  assert.ok(!/98765|43210|Rohan/.test(html), html);
  assert.match(html, /&lt;b&gt;Call&lt;\/b&gt; <span class="sg-redacted" data-kind="phone">number removed<\/span>/);
});

test('renderThread: a list with a name, dividers, runs, ticks and no leaks', () => {
  const html = renderThread([
    { day: '2026-03-04' },
    { from: 'them', who: 'Maya', text: 'Hi, this is Maya, 9876543210', time: '2026-03-04T10:12' },
    { from: 'them', who: 'Maya', text: 'Friday?', time: '2026-03-04T10:13' },
    { from: 'me', who: 'Studio', text: 'Yes', time: '2026-03-04T10:31', status: 'read' },
  ], { label: 'With Maya', redact: { names: ['Rohan'] } });
  assert.match(html, /<ol aria-label="With Maya">/);
  assert.match(html, /<li class="sg-chat-day"><time datetime="2026-03-04">4 March 2026<\/time><\/li>/);
  assert.equal((html.match(/data-run="continue"/g) || []).length, 1);
  assert.match(html, /data-from="me" data-status="read"/);
  assert.ok(!html.includes('9876543210'));
});

test('runs: same side and sender continue; a day divider or another speaker breaks it', () => {
  assert.deepEqual(runs([{ from: 'them', who: 'A' }, { from: 'them', who: 'A' }, { day: 'x' }, { from: 'them', who: 'A' }, { from: 'me', who: 'B' }, { from: 'them', who: 'C' }]),
    [false, true, false, false, false, false]);
});

test('clock and day read the written digits, never a time zone', () => {
  assert.equal(clockOf('2026-03-04T23:59:00Z'), '23:59');
  assert.equal(dayOf('2026-12-01'), '1 December 2026');
  assert.equal(dayOf('nonsense'), '');
});

test('leakIn spots a marker that still holds the original', () => {
  assert.equal(leakIn('number removed'), '');
  assert.match(leakIn('+91 98765'), /digits/);
  assert.match(leakIn('a@b.co'), /@/);
  assert.match(leakIn('this is the whole original sentence'), /short label/);
});

test('the bubble is deterministic, two passes, and its tail points out on the speaker\'s side', () => {
  const a = bubbleOutline(200, 60, 's', { side: 'left' });
  assert.deepEqual(a, bubbleOutline(200, 60, 's', { side: 'left' }));
  assert.equal(a.d.length, 2);
  const minX = Math.min(...a.points[0].map(p => p[0]));
  assert.ok(minX < -3, `left tail reaches out to ${minX}`);
  const b = bubbleOutline(200, 60, 's', { side: 'right' });
  assert.ok(Math.max(...b.points[0].map(p => p[0])) > 203);
  const c = bubbleOutline(200, 60, 's', { side: 'left', tail: false });
  for (const [x, y] of c.points[0]) assert.ok(x > -2 && x < 202 && y > -2 && y < 62, `${x},${y}`);
});

test('the bounce happens only at full motion, and a batch is staggered but capped', () => {
  for (const m of ['still', 'state', 'ambient']) assert.equal(arrival(m), null, m);
  const a = arrival('full', 0), z = arrival('full', 40);
  assert.equal(a.frames.at(-1).transform, 'none');
  assert.ok(z.timing.delay <= 350);
  for (const f of a.frames) assert.deepEqual(Object.keys(f).filter(k => !['opacity', 'transform', 'offset'].includes(k)), [], 'transform and opacity only');
});

// Contrast: the playful bubbles, every palette and theme.
for (const name of Object.keys(palettes)) for (const theme of ['light', 'dark']) {
  test(`AA: ${name} ${theme}: playful bubble text reads at 4.5:1`, () => {
    const r = resolveRoles(name, theme), hex = k => toRgb(r[k].hex);
    for (const ink of ['text', 'text-soft']) assert.ok(contrast(hex(ink), hex('selection')) >= 4.5, `${ink} on selection: ${contrast(hex(ink), hex('selection')).toFixed(2)}`);
    assert.ok(contrast(hex('on-accent'), hex('accent')) >= 4.5);
    assert.ok(contrast(hex('surface'), hex('text')) >= 4.5, 'redacted bar');
  });
}

test('a reaction is read as words; unknown emoji still say something', async () => {
  const { reactionLabel } = await import('./chat-thread.core.js');
  assert.equal(reactionLabel('❤️'), 'Reacted with a heart');
  assert.equal(reactionLabel(' 👍 '), 'Reacted with a thumbs up');
  assert.equal(reactionLabel('🦀'), 'Reacted with an emoji');
});

test('renderThread writes a reply that says what it is, redacted, and a reaction read once', () => {
  const html = renderThread([
    { from: 'them', who: 'Maya', text: 'Call Rohan', time: '2026-03-04T10:12' },
    { from: 'me', who: 'Studio', text: 'Will do', reply: { who: 'Maya', text: 'Call Rohan on 9876543210' }, reaction: '❤️' },
  ], { redact: { names: ['Rohan'] } });
  assert.match(html, /<blockquote class="sg-chat-reply"><span class="sg-chat-sr">Replying to: <\/span><span class="sg-chat-reply-who">Maya<\/span> <span class="sg-chat-reply-text">Call <span class="sg-redacted"/);
  assert.match(html, /<span class="sg-chat-reaction" role="img" aria-label="Reacted with a heart"><span aria-hidden="true">❤️<\/span><\/span><\/li>/);
  assert.ok(!/Rohan|9876543210/.test(html));
});
