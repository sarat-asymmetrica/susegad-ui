import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadTransport } from './transport.js';
import { createUploadSession, vet, formatBytes, barFor, STRINGS, MAX_BYTES } from './upload.core.js';

const MB = 1024 * 1024;
const photo = (name, size, type = 'image/jpeg') => ({ name, size, type });

test('transport: same seed, same upload; bytes only ever grow, and never past the file', () => {
  const run = () => {
    const t = createUploadTransport({ seed: 4 });
    t.start(photo('beach.jpg', 2.4 * MB), 0);
    return t.poll(1e9);
  };
  const a = run();
  assert.deepEqual(a, run());
  let prev = 0, prevAt = 0;
  for (const e of a) {
    assert.ok(e.loaded >= prev && e.loaded <= e.total); assert.ok(e.at >= prevAt);
    prev = e.loaded; prevAt = e.at;
  }
  assert.equal(a.at(-1).type, 'done');
  assert.ok(a.at(-1).at > a.at(-2).at, 'the server checks the file after the last byte');
});

test('transport: each event is delivered once, in time order', () => {
  const t = createUploadTransport({ seed: 1 });
  t.start(photo('a.jpg', 300_000), 0); t.start(photo('b.pdf', 900_000, 'application/pdf'), 50);
  const seen = [];
  for (let now = 0; now < 20_000; now += 97) seen.push(...t.poll(now));
  assert.deepEqual(seen, [...seen].sort((x, y) => x.at - y.at || x.id - y.id));
  assert.equal(seen.filter(e => e.type === 'done').length, 2);
  assert.equal(t.busy(), false);
});

test('vet: too large and wrong kinds are refused in plain words', () => {
  const v = vet([photo('ok.jpg', 1 * MB), photo('huge.jpg', 14.2 * MB), photo('notes.txt', 200, 'text/plain')]);
  assert.deepEqual(v.ok.map(f => f.name), ['ok.jpg']);
  assert.match(v.note, /huge\.jpg is 14\.2 MB, over the 10\.0 MB limit/);
  assert.match(v.note, /notes\.txt isn't a photo or a PDF/);
  assert.match(vet([photo('a.jpg', 11 * MB), photo('b.jpg', 12 * MB)]).note, /^2 files are over the 10\.0 MB limit/);
  assert.equal(vet([photo('ok.jpg', MAX_BYTES)]).note, '', 'exactly at the limit is fine');
});

test('the bar never runs ahead of the bytes, and ends only when the server says done', () => {
  const t = createUploadTransport({ seed: 2 });
  const s = createUploadSession({ transport: t });
  s.add([photo('beach.jpg', 1.5 * MB)], 0);
  const events = createUploadTransport({ seed: 2 });
  events.start(photo('beach.jpg', 1.5 * MB), 0);
  const truth = events.poll(1e9);
  let lastByteAt = truth.filter(e => e.type === 'progress').at(-1).at, doneAt = truth.at(-1).at;
  for (let now = 0; now <= doneAt + 100; now += 37) {
    s.tick(now);
    const row = s.view().rows[0];
    const reported = truth.filter(e => e.at <= now).at(-1);
    assert.ok(row.value <= (reported?.loaded ?? 0) || row.status === 'done', `at ${now} the bar shows only reported bytes`);
    if (now < doneAt) assert.ok(row.value < row.max, `at ${now}, before the server's done, the bar is not full`);
    if (now >= lastByteAt && now < doneAt) assert.equal(row.status, 'checking');
  }
  assert.equal(s.view().rows[0].status, 'done');
  assert.equal(s.view().rows[0].value, s.view().rows[0].max);
});

test('a dropped upload says so, can be tried again, and the stamp waits for every file', () => {
  const t = createUploadTransport({ seed: 3, fails: (f, attempt) => (f.name === 'menu.pdf' && attempt === 1 ? 0.5 : null) });
  const s = createUploadSession({ transport: t });
  s.add([photo('room.jpg', 800_000), photo('menu.pdf', 1.2 * MB, 'application/pdf')], 0);
  const effects = s.tick(60_000);
  const failed = effects.find(e => e.tone === 'error');
  assert.equal(failed.message, STRINGS.toastFailed('menu.pdf'));
  assert.equal(s.view().stamp.show, false, 'no stamp while a file is missing');
  assert.ok(s.view().rows[1].label.endsWith("didn't upload"));
  assert.ok(!effects.some(e => e.tone === 'success'), 'no success toast while a file failed');
  s.retry(failed.retry, 60_000);
  const after = s.tick(200_000);
  assert.equal(after.find(e => e.tone === 'success').message, STRINGS.toastDone(2, 'menu.pdf'));
  assert.deepEqual(s.view().stamp, { show: true, detail: `2 files, ${formatBytes(800_000 + 1.2 * MB)}` });
  assert.equal(s.tick(300_000).length, 0, 'said once, not again');
});

test('bytes read the way people read them', () => {
  assert.equal(formatBytes(12), '12 bytes');
  assert.equal(formatBytes(1), '1 byte');
  assert.equal(formatBytes(640 * 1024), '640 KB');
  assert.equal(formatBytes(2.4 * MB), '2.4 MB');
  assert.equal(barFor({ size: 10, loaded: 10, status: 'checking' }).value, 10);
  assert.equal(barFor({ size: 10, loaded: 10, status: 'checking' }).max, 11);
});

test('copy: no em dashes, sentence case', () => {
  const texts = [STRINGS.field, STRINGS.choose, STRINGS.empty.heading, STRINGS.empty.text, STRINGS.retry, STRINGS.stamp,
    STRINGS.hint('10 MB'), STRINGS.tooLarge('a.jpg', '11 MB', '10 MB'), STRINGS.toastFailed('a.jpg'), STRINGS.toastDone(2)];
  for (const t of texts) assert.ok(!t.includes('\u2014'), t);
});
