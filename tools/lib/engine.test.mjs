import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { contextOptions, dropBenignErrors, ENGINE_NAMES, engineName, grantsPermission, pickEngine, unsupportedIn } from './engine.mjs';

test('defaults to chromium with no name and no SG_ENGINE', () => {
  const before = process.env.SG_ENGINE;
  delete process.env.SG_ENGINE;
  try {
    assert.equal(pickEngine(), chromium);
  } finally {
    if (before !== undefined) process.env.SG_ENGINE = before;
  }
});

test('picks the named engine, case-insensitively, trimmed', () => {
  assert.equal(pickEngine('webkit'), webkit);
  assert.equal(pickEngine('Firefox'), firefox);
  assert.equal(pickEngine(' chromium '), chromium);
});

test('SG_ENGINE is used when no name is passed', () => {
  const before = process.env.SG_ENGINE;
  process.env.SG_ENGINE = 'webkit';
  try {
    assert.equal(pickEngine(), webkit);
  } finally {
    if (before === undefined) delete process.env.SG_ENGINE; else process.env.SG_ENGINE = before;
  }
});

// This is the check that must fail first: an unrecognised engine name is a
// loud, named error, not a silent fall-through to chromium.
test('an unknown engine name throws, naming the three real choices', () => {
  assert.throws(() => pickEngine('safari'), /Unknown engine "safari"\. Use chromium, firefox or webkit\./);
});

test('ENGINE_NAMES lists exactly the three supported engines', () => {
  assert.deepEqual(ENGINE_NAMES, ['chromium', 'firefox', 'webkit']);
});

test('engineName normalises the same way pickEngine does, but returns the string', () => {
  assert.equal(engineName('WebKit'), 'webkit');
  assert.equal(engineName(), 'chromium');
  assert.throws(() => engineName('safari'), /Unknown engine "safari"/);
});

// This is the check that must fail first: the real bug rung 4 shipped with was
// passing every context option straight to newContext(), which WebKit and
// Firefox throw on for clipboard-read/clipboard-write, crashing the check
// before a single assertion ran. contextOptions must remove exactly those,
// and only for the engines that reject them.
test('contextOptions strips Chromium-only permissions for firefox and webkit, keeps them for chromium', () => {
  const opts = { viewport: { width: 1, height: 1 }, permissions: ['clipboard-read', 'clipboard-write'] };
  assert.deepEqual(contextOptions('chromium', opts).permissions, ['clipboard-read', 'clipboard-write']);
  assert.equal('permissions' in contextOptions('firefox', opts), false);
  assert.equal('permissions' in contextOptions('webkit', opts), false);
});

test('contextOptions keeps a non-Chromium-only permission for every engine', () => {
  const opts = { permissions: ['geolocation'] };
  assert.deepEqual(contextOptions('firefox', opts).permissions, ['geolocation']);
});

test('contextOptions drops isMobile for firefox only', () => {
  const opts = { isMobile: true, hasTouch: true };
  assert.equal('isMobile' in contextOptions('firefox', opts), false);
  assert.equal(contextOptions('firefox', opts).hasTouch, true, 'unrelated options are untouched');
  assert.equal(contextOptions('chromium', opts).isMobile, true);
  assert.equal(contextOptions('webkit', opts).isMobile, true);
});

test('contextOptions never mutates the object it was given', () => {
  const opts = { permissions: ['clipboard-write'], isMobile: true };
  contextOptions('firefox', opts);
  assert.deepEqual(opts, { permissions: ['clipboard-write'], isMobile: true });
});

test('grantsPermission: false only for a Chromium-only permission on a non-Chromium engine', () => {
  assert.equal(grantsPermission('chromium', 'clipboard-write'), true);
  assert.equal(grantsPermission('firefox', 'clipboard-write'), false);
  assert.equal(grantsPermission('webkit', 'clipboard-read'), false);
  assert.equal(grantsPermission('firefox', 'geolocation'), true);
});

// This is the check that must fail first: before this filter existed, a
// check comparing errors.length === 0 counted WebKit's benign ResizeObserver
// notice as a real failure (confirmed empirically 2026-09-28: the same page
// at the same viewport produces no console message in Chromium at all, and
// a real pageerror in WebKit -- see engine.mjs's own comment on this list).
test('dropBenignErrors removes only the known-benign ResizeObserver notice, keeps everything else', () => {
  assert.deepEqual(
    dropBenignErrors(['ResizeObserver loop completed with undelivered notifications.', 'TypeError: real bug', 'ResizeObserver loop completed with undelivered notifications.']),
    ['TypeError: real bug'],
  );
  assert.deepEqual(dropBenignErrors([]), []);
  assert.deepEqual(dropBenignErrors(['a real error']), ['a real error']);
  // near-miss text (a genuine error that merely mentions the phrase) is not swallowed
  assert.deepEqual(
    dropBenignErrors(['Uncaught: ResizeObserver loop completed with undelivered notifications. Also something broke.']),
    ['Uncaught: ResizeObserver loop completed with undelivered notifications. Also something broke.'],
  );
});

test('unsupportedIn prints one line naming the engine and reason, and returns true so a check can skip', () => {
  const lines = [];
  const orig = console.log;
  console.log = s => lines.push(s);
  try {
    const skipped = unsupportedIn('webkit', 'MediaRecorder', 'no WebM encoder');
    assert.equal(skipped, true);
  } finally {
    console.log = orig;
  }
  assert.match(lines[0], /skip.*MediaRecorder is not measurable in webkit.*no WebM encoder/);
});
