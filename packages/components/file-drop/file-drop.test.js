import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, parseSize, formatSize, accepts, describeAccept, sift } from './file-drop.core.js';

const f = (name, type = '', size = 100) => ({ name, type, size });

test('runs in Node with no DOM', () => {
  assert.equal(typeof document, 'undefined');
});

test('sizes are read the way people write them', () => {
  assert.equal(parseSize('10 MB'), 10 * 1024 * 1024);
  assert.equal(parseSize('500kb'), 500 * 1024);
  assert.equal(parseSize('1.5 GB'), Math.round(1.5 * 1024 ** 3));
  assert.equal(parseSize(2048), 2048);
  assert.equal(parseSize(null), Infinity);
  assert.equal(parseSize('lots'), Infinity);
});

test('sizes are said the way people say them', () => {
  assert.equal(formatSize(1), '1 byte');
  assert.equal(formatSize(900), '900 bytes');
  assert.equal(formatSize(850 * 1024), '850 KB');
  assert.equal(formatSize(2.4 * 1024 * 1024), '2.4 MB');
  assert.equal(formatSize(1024 ** 3 * 3), '3 GB');
});

test('accept is read as the browser reads it', () => {
  assert.ok(accepts(f('Plan.PDF'), '.pdf'));
  assert.ok(accepts(f('photo.jpeg', 'image/jpeg'), 'image/*'));
  assert.ok(accepts(f('photo', 'image/jpeg'), 'image/jpeg'));
  assert.ok(!accepts(f('setup.exe', 'application/x-msdownload'), '.pdf,image/*'));
  assert.ok(accepts(f('anything.bin'), ''));
  assert.ok(!accepts(f('notes.txt', 'text/plain'), 'image/*'));
});

test('accept in words', () => {
  assert.equal(describeAccept('.pdf,image/jpeg'), 'a PDF or JPG');
  assert.equal(describeAccept('image/*'), 'an image');
  assert.equal(describeAccept('image/*,.pdf'), 'a PDF or an image');
  assert.equal(describeAccept('.docx,.pdf,.jpg'), 'a Word file, PDF or JPG');
  assert.equal(describeAccept('.xlsx'), 'an Excel file');
  assert.equal(describeAccept(''), 'a file');
});

test('sift keeps what may stay and says why the rest was turned away', () => {
  const files = [f('a.pdf', 'application/pdf', 10), f('b.exe', '', 10), f('c.pdf', 'application/pdf', 20e6), f('d.jpg', 'image/jpeg', 10)];
  const r = sift(files, { accept: '.pdf,image/jpeg', maxSize: parseSize('10 MB'), multiple: true });
  assert.deepEqual(r.kept, [0, 3]);
  assert.deepEqual(r.messages, ['b.exe isn’t a PDF or JPG, so it wasn’t added.', 'c.pdf is over 10 MB, so it wasn’t added. Choose a smaller file.']);
});

test('a single-file box keeps the first file that may stay', () => {
  const r = sift([f('x.exe'), f('a.jpg', 'image/jpeg'), f('b.jpg', 'image/jpeg')], { accept: 'image/*' });
  assert.deepEqual(r.kept, [1]);
  assert.equal(r.messages.at(-1), STRINGS.count());
});

test('nothing turned away, nothing said', () => {
  assert.deepEqual(sift([f('a.pdf')], { accept: '.pdf' }), { kept: [0], messages: [] });
  assert.deepEqual(sift([], {}), { kept: [], messages: [] });
});

test('words', () => {
  assert.equal(STRINGS.chosen(0), 'No file chosen yet');
  assert.equal(STRINGS.chosen(1), '1 file chosen');
  assert.equal(STRINGS.chosen(3), '3 files chosen');
  assert.equal(STRINGS.cue(true), 'Drop files here, or choose them');
  assert.equal(STRINGS.cue(false), 'Drop a file here, or choose one');
  assert.equal(STRINGS.remove('plan.pdf'), 'Remove plan.pdf');
  const all = [STRINGS.type('a', 'b'), STRINGS.size('a', 'b'), STRINGS.count(), STRINGS.removed('a')].join(' ');
  assert.ok(!all.includes('—'));
});
