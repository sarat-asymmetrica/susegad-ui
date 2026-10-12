import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { capture } from './capture.js';
import { drive, bakeFrames } from './bake.core.js';

const here = dirname(fileURLToPath(import.meta.url));
const instant = () => Promise.resolve();

/**
 * A fake analyser: it answers reads from a script, and records any property
 * touched on its context beyond state and sampleRate (resume, createGain, ...),
 * so a test can say what capture did and did not do.
 */
function fakeAnalyser({ state = 'running', frameAt = () => new Uint8Array(512), sampleRate = 48000 } = {}) {
  const calls = [];
  let reads = 0;
  const context = new Proxy({ state, sampleRate }, {
    get(t, k) { if (k in t) return t[k]; calls.push(`context.${String(k)}`); return () => { calls.push(`context.${String(k)}()`); }; },
  });
  return {
    context, calls,
    get reads() { return reads; },
    frequencyBinCount: 512,
    getByteFrequencyData(arr) { arr.set(frameAt(reads++)); },
  };
}

test('capture reads an analyser N times into a cache and calls nothing else', async () => {
  const lit = f => { const a = new Uint8Array(512); if (f >= 5) a.fill(220, 40, 44); return a; };
  const an = fakeAnalyser({ frameAt: lit });
  const waits = [];
  const c = await capture(an, { frames: 10, hopMs: 30, wait: ms => { waits.push(ms); return instant(); }, label: 'ch1' });
  assert.equal(an.reads, 10);
  assert.deepEqual(waits, Array(9).fill(30), 'it waits between readings, not after the last');
  assert.deepEqual(an.calls, [], 'it touched nothing on the context but state and sampleRate');
  assert.equal(c.frames, 10);
  assert.equal(c.hopMs, 30);
  assert.equal(c.label, 'ch1');
  assert.ok(drive(c, 0) === 0 && drive(c, 250) > 0, 'the cache holds the burst');
});

test('a suspended context is not resumed, not read: capture returns null', async () => {
  for (const state of ['suspended', 'closed']) {
    const an = fakeAnalyser({ state });
    assert.equal(await capture(an, { wait: instant }), null);
    assert.equal(an.reads, 0);
    assert.deepEqual(an.calls, []);
  }
  assert.equal(await capture(null), null);
});

test('capture never builds, resumes or starts anything: its source mentions none of it', () => {
  const src = readFileSync(join(here, 'capture.js'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const word of ['new AudioContext', 'resume(', '.start(', 'createOscillator', 'createBufferSource', '.connect(', 'localStorage', 'soundOn']) {
    assert.ok(!src.includes(word), `capture.js mentions ${word}`);
  }
  assert.ok(src.includes('getByteFrequencyData'));
});

// ── round 2: the gaps Rasika found ──────────────────────────────────────────

test("capture bakes at the analyser's own sample rate, so bins land in the right bands", async () => {
  const lit = () => { const a = new Uint8Array(512); a[60] = 255; return a; };
  const at = async sampleRate => capture(fakeAnalyser({ sampleRate, frameAt: lit }), { frames: 2, wait: instant });
  const c441 = await at(44100), c48 = await at(48000);
  assert.equal(c441.sampleRate, 44100);
  assert.equal(c48.sampleRate, 48000);
  const rows = [lit(), lit()];
  assert.deepEqual(c441.data, bakeFrames(rows, { sampleRate: 44100 }).data);
  assert.notDeepEqual(c441.data, bakeFrames(rows, { sampleRate: 48000 }).data, 'bin 60 is a different frequency at 44.1 kHz');
});
