import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import kantar from './index.js';
import {
  model,
  W,
  H,
  SCENES,
  SONGS,
  PHASES,
  ACT_DURATION,
  SHOW_DURATION,
  RISE_TIME,
  showAt,
  nextPhase,
  heroAt,
  heroNext,
  HERO_LINE,
} from './model.js';
import { meta } from './meta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('kantar scene is registered under name kantar', () => {
  assert.equal(kantar.name, 'kantar');
  assert.equal(kantar.meta.id, 'kantar');
  assert.equal(kantar.meta.word, 'Kantar');
  assert.equal(kantar.meta.W, 1200);
  assert.equal(kantar.meta.H, 800);
  assert.ok(kantar.params.progress);
  assert.ok(kantar.params.set);
  assert.ok(kantar.params.spot);
});

test('model: deterministic across all registers and seeds', () => {
  for (const register of ['quiet', 'warm', 'playful']) {
    for (const time of [0, 1.2, 5.0, 12.4, 25.0]) {
      const a = model({ time, seed: 42, register });
      const b = model({ time, seed: 42, register });
      assert.deepEqual(a, b, `deterministic at t=${time} in ${register}`);
    }
  }
});

test('model quiet: curtain is up, set is lit and still, settled is true', () => {
  for (const time of [0, 1, 10, 50]) {
    const m = model({ time, register: 'quiet' });
    assert.equal(m.curtain, 0, 'curtain must be fully up (0)');
    assert.equal(m.settled, true, 'quiet must always be settled');
    assert.equal(m.spot, 0, 'spotlight must be off');
    assert.equal(m.song, -1, 'no song in quiet');
    assert.equal(m.flicker, 0, 'no flicker in quiet');
    assert.equal(m.breathe, 0, 'no breathing in quiet');
  }
});

test('model warm: curtain rises once under 2s, then settles', () => {
  // At t=0: curtain is down (1.0), not settled
  const m0 = model({ time: 0, register: 'warm' });
  assert.equal(m0.curtain, 1.0, 'starts with curtain closed');
  assert.equal(m0.settled, false, 'not settled at start');
  assert.equal(m0.phase, 'curtain-rise');

  // At t=0.9s: curtain is midway rising (between 0 and 1)
  const mMid = model({ time: 0.9, register: 'warm' });
  assert.ok(mMid.curtain > 0 && mMid.curtain < 1.0, 'curtain is rising');
  assert.equal(mMid.settled, false, 'not settled mid-rise');

  // At t=RISE_TIME (1.8s) and after: curtain is fully up (0) and settled
  const mEnd = model({ time: RISE_TIME, register: 'warm' });
  assert.equal(mEnd.curtain, 0, 'curtain fully up');
  assert.equal(mEnd.settled, true, 'settled after rise');

  const mLater1 = model({ time: 3.0, register: 'warm' });
  const mLater2 = model({ time: 6.0, register: 'warm' });
  assert.equal(mLater1.curtain, 0);
  assert.equal(mLater1.settled, true);
  assert.equal(mLater2.curtain, 0);
  assert.equal(mLater2.settled, true);

  // Check fail-first rule: after first rise, no state change between two moments 3s apart
  assert.equal(mLater1.curtain, mLater2.curtain);
  assert.equal(mLater1.set, mLater2.set);
  assert.equal(mLater1.spot, mLater2.spot);
  assert.equal(mLater1.flicker, mLater2.flicker);
  assert.equal(mLater1.settled, mLater2.settled);
});

test('model playful: full timeline with 4 phases and continuous looping', () => {
  // Phase 1: scene (0 <= u < 7.0)
  const mScene = model({ time: 3.0, register: 'playful' });
  assert.equal(mScene.phase, 'scene');
  assert.equal(mScene.curtain, 0);
  assert.equal(mScene.spot, 0);
  assert.equal(mScene.song, -1);
  assert.equal(mScene.settled, false);

  // Phase 2: curtain drop (7.0 <= u < 8.6)
  const mDrop = model({ time: 7.8, register: 'playful' });
  assert.equal(mDrop.phase, 'curtain-drop');
  assert.ok(mDrop.curtain > 0 && mDrop.curtain < 1.0);
  assert.equal(mDrop.settled, false);

  // Phase 3: song & singer (8.6 <= u < 15.0)
  const mSong = model({ time: 11.0, register: 'playful' });
  assert.equal(mSong.phase, 'song');
  assert.equal(mSong.curtain, 1.0);
  assert.ok(mSong.song >= 0 && mSong.song <= 1.0);
  assert.ok(mSong.spot > 0, 'spotlight active during song');
  assert.ok(mSong.singer, 'singer visible in spot');
  assert.ok(mSong.landed >= 0, 'curtain landed timer active');
  assert.equal(mSong.settled, false);

  // Phase 4: curtain rise (15.0 <= u < 16.8)
  const mRise = model({ time: 16.0, register: 'playful' });
  assert.equal(mRise.phase, 'curtain-rise');
  assert.ok(mRise.curtain > 0 && mRise.curtain < 1.0);
  assert.equal(mRise.settled, false);
});

test('set changes behind the curtain while the song is sung', () => {
  // Before curtain drop, scene 0 is visible
  const sBefore = showAt(4.0);
  assert.equal(sBefore.set, 0);

  // During song, set changes behind curtain to scene 1
  const sDuringSong = showAt(PHASES.scene + PHASES.down + 1.0);
  assert.equal(sDuringSong.set, 1);

  // Next act begins on scene 1
  const sNextAct = showAt(ACT_DURATION + 2.0);
  assert.equal(sNextAct.set, 1);
});

test('nextPhase calculates skip timestamps correctly', () => {
  assert.equal(nextPhase(2.0), PHASES.scene);
  assert.equal(nextPhase(7.2), PHASES.scene + PHASES.down);
  assert.equal(nextPhase(9.0), PHASES.scene + PHASES.down + PHASES.song);
  assert.equal(nextPhase(15.5), ACT_DURATION);
});

test('parameters: progress, set, spot override timeline values', () => {
  // progress parameter overrides curtain
  const mProg = model({ time: 0, register: 'warm', params: { progress: 0.35 } });
  assert.equal(mProg.curtain, 0.35);

  const mClampedProg = model({ time: 0, params: { progress: 1.5 } });
  assert.equal(mClampedProg.curtain, 1.0);

  // set parameter overrides backdrop
  const mSet = model({ time: 0, params: { set: 2 } });
  assert.equal(mSet.set, 2);
  assert.equal(mSet.sceneId, 'balcao');

  // spot parameter overrides spotlight
  const mSpot = model({ time: 0, params: { spot: 0.85 } });
  assert.equal(mSpot.spot, 0.85);
  assert.equal(mSpot.singer, true);
});

test('meta sparks: all sparks use real scene params, registers, or techniques', () => {
  assert.ok(Array.isArray(meta.sparks), 'meta.sparks must be an array');
  assert.equal(meta.sparks.length, 3, 'must provide exactly 3 sparks');

  const validTargets = new Set([
    ...Object.keys(kantar.params),
    'quiet',
    'warm',
    'playful',
    ...meta.techniques,
  ]);

  for (const spark of meta.sparks) {
    assert.ok(spark.prompt, 'spark must have prompt');
    assert.ok(spark.uses, 'spark must have uses');
    assert.ok(validTargets.has(spark.uses), `spark uses "${spark.uses}" must match real param or technique`);
  }
});

test('CRITICAL RULE: no em dashes in any kantar files or metadata', () => {
  const emDash = '\u2014'; // '—'

  // Check metadata strings
  assert.ok(!meta.gloss.includes(emDash), 'no em dash in meta.gloss');
  assert.ok(!meta.caption.includes(emDash), 'no em dash in meta.caption');
  assert.ok(!meta.prompt.includes(emDash), 'no em dash in meta.prompt');
  for (const [phrase, , explanation] of meta.map) {
    assert.ok(!phrase.includes(emDash), `no em dash in map phrase: ${phrase}`);
    assert.ok(!explanation.includes(emDash), `no em dash in map explanation: ${explanation}`);
  }
  for (const spark of meta.sparks) {
    assert.ok(!spark.prompt.includes(emDash), `no em dash in spark: ${spark.prompt}`);
  }

  // Check scene titles and song lines
  for (const s of SCENES) {
    assert.ok(!s.title.includes(emDash), `no em dash in scene title: ${s.title}`);
  }
  for (const song of SONGS) {
    assert.ok(!song.includes(emDash), `no em dash in song line: ${song}`);
  }

  // Check all file contents in packages/scenes/kantar/
  const fileNames = [
    'model.js',
    'render.js',
    'meta.js',
    'index.js',
    'kantar.prompt.md',
    'demo.html',
    'registry.json',
  ];

  for (const file of fileNames) {
    const content = readFileSync(resolve(__dirname, file), 'utf8');
    assert.ok(!content.includes(emDash), `file ${file} must contain zero em dashes`);
  }
});

// ── hero: the show runs only when asked ───────────────────────────────────
// The home page's masthead is this scene. It must never loop a show on its
// own: it rises once, rests, and plays one act per click.

const HERO_ACT = PHASES.down + PHASES.song + PHASES.up;

test('hero playful: rises once on load, then rests however long it is left alone', () => {
  const rising = model({ time: 0.9, register: 'playful', params: { hero: true } });
  assert.ok(rising.curtain > 0 && rising.curtain < 1, 'mid-rise at 0.9 s');
  assert.equal(rising.settled, false);
  for (const time of [RISE_TIME, 7, 20, 60, 300, 3600]) {
    const m = model({ time, register: 'playful', params: { hero: true } });
    assert.equal(m.curtain, 0, `curtain up at ${time} s`);
    assert.equal(m.settled, true, `settled at ${time} s`);
    assert.equal(m.song, -1);
    assert.equal(m.spot, 0);
    assert.equal(m.set, 0, 'still the first set');
  }
});

test('hero playful: the plain playful show still loops (hero is opt-in)', () => {
  const m = model({ time: 11, register: 'playful' });
  assert.equal(m.phase, 'song');
  assert.equal(m.settled, false);
});

test('hero playful: a click strikes one act, drops, sings, rises on the next set, and rests', () => {
  const cue = 10, params = { hero: true, cue, acts: 1 };
  const at = dt => model({ time: cue + dt, register: 'playful', params });
  assert.equal(at(0).curtain, 0, 'the act begins with the curtain up');
  assert.ok(at(PHASES.down / 2).curtain > 0 && at(PHASES.down / 2).curtain < 1, 'dropping');
  assert.equal(at(PHASES.down + 1).phase, 'song');
  assert.equal(at(PHASES.down + 1).curtain, 1);
  assert.ok(at(PHASES.down + 1).spot > 0 && at(PHASES.down + 1).singer);
  assert.equal(at(PHASES.down + 1).set, 1, 'the set is changed behind the curtain');
  assert.ok(at(PHASES.down + PHASES.song + PHASES.up / 2).curtain < 1, 'rising');
  for (const dt of [HERO_ACT, HERO_ACT + 5, HERO_ACT + 500]) {
    const m = at(dt);
    assert.equal(m.curtain, 0, `rests after the act (+${dt})`);
    assert.equal(m.settled, true);
    assert.equal(m.set, 1);
  }
});

test('hero playful: the third click wraps round the three sets', () => {
  const m = model({ time: 100, register: 'playful', params: { hero: true, cue: 50, acts: 3 } });
  assert.equal(m.set, 0);
  assert.equal(m.settled, true);
});

test('hero: quiet and warm are unchanged by the flag', () => {
  for (const register of ['quiet', 'warm']) {
    for (const time of [0, 1, 5, 40]) {
      const a = model({ time, register });
      const b = model({ time, register, params: { hero: true } });
      assert.deepEqual({ ...a, params: 0 }, { ...b, params: 0 }, `${register} at ${time}`);
    }
  }
});

test('hero: the line sung is our own line, not the placeholder songs', () => {
  assert.equal(HERO_LINE, 'Susegad: the unhurried contentment of a Goan afternoon.');
  const m = model({ time: 100 + PHASES.down + 2, register: 'playful', params: { hero: true, cue: 100, acts: 2 } });
  assert.equal(m.song >= 0, true);
  assert.equal(m.songText, HERO_LINE);
  for (const other of SONGS.slice(1)) assert.notEqual(m.songText, other);
});

test('hero: heroAt and heroNext are pure and agree', () => {
  assert.deepEqual(heroAt(3, 0, null), heroAt(3, 0, null));
  assert.equal(heroNext(0), PHASES.down, 'from the start, the next mark is the end of the drop');
  assert.equal(heroNext(PHASES.down + 1), PHASES.down + PHASES.song);
  assert.equal(heroNext(PHASES.down + PHASES.song + 0.5), HERO_ACT);
  assert.equal(heroNext(HERO_ACT + 3), null, 'nothing left to skip once at rest');
});
