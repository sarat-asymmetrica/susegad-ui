// fontReady waits for the faces still loading when one face of the stack has already failed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontReady } from './index.js';

const withFonts = async (fonts, fn) => {
  globalThis.document = { fonts };
  try { return await fn(); } finally { delete globalThis.document; }
};

test('fontReady resolves at once when every face loads', async () => {
  await withFonts({ load: async () => [], ready: new Promise(() => {}) }, () => fontReady('400 20px Kalam', 'x'));
});

test('a face with no source here rejects load() early: fontReady still waits for the face that is on its way', async () => {
  let arrived = false, release;
  const ready = new Promise(r => { release = () => { arrived = true; r(); }; });
  const fonts = { load: async () => { throw new Error('NetworkError: Kalam Fallback has no local Segoe Print'); }, ready };
  let done = false;
  const waiting = withFonts(fonts, () => fontReady('400 20px Kalam', 'ಕನ್ನಡ')).then(() => { done = true; });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(done, false, 'not returned while the Kannada face is still in flight');
  release();
  await waiting;
  assert.equal(arrived, true);
});

test('with no font loading API, or one that throws both ways, fontReady returns and the caller measures the fallback', async () => {
  await withFonts(undefined, () => fontReady('400 20px Kalam'));
  await withFonts({ load: async () => { throw new Error('x'); }, get ready() { throw new Error('y'); } }, () => fontReady('400 20px Kalam', 'x'));
});

test('a fonts.ready that never settles does not hold fontReady for ever: it returns at the ceiling', async () => {
  const fonts = { load: async () => { throw new Error('NetworkError'); }, ready: new Promise(() => {}) };
  const t0 = Date.now();
  await withFonts(fonts, () => fontReady('400 20px Kalam', 'ಕನ್ನಡ', { waitMs: 60 }));
  const took = Date.now() - t0;
  assert.ok(took >= 50 && took < 1500, `returned after ${took} ms`);
});
