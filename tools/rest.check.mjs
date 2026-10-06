// The rest checks, run in a browser (docs/requests/2026-10-02-lighter-gate.md, C rows 1 and 2).
//
//   node tools/rest.check.mjs
//
// Part 1 is the red proof, on the faulted fixture: sg-motion-scene plays forever and does
// not honour reduced motion, so its facts fed through the analyser MUST come out red, or
// the machinery is not trusted (a check must be able to fail before it counts).
// Part 2 is the real contract, on the clean fixture: sg-fixture-scene, warm and reduced.
//
// Pure analyser: tools/rest.core.js. Exit 1 when any part fails.
//
//   --settle S   seconds past the scene's own rest before the idle two-moment read (default 2)
//   --gap S      seconds between the two read moments (default 3)

import { session, openScene } from './lib/scene-probe.mjs';
import { stillAfterReady, restBetweenMoments } from './rest.core.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const SETTLE = (arg('settle', 2)) * 1000;
const GAP = (arg('gap', 3)) * 1000;
// The clean fixture's warm show is 8 s; 11 s past ready is the show plus a margin.
const SETTLE_MS = arg('settle-clean', 11) * 1000;

const s = await session();

// --- part 1: the red proof, on the fixture that plays forever -----------------
{
  const p = await openScene(s, 'motion', {
    element: 'sg-motion-scene', module: '/tools/fixtures/motion-scene/index.js', register: 'warm',
  });
  await p.wait(SETTLE + 1000);
  await p.snap('m0'); await p.wait(GAP); await p.snap('m1');
  const share = await p.changed('m0', 'm1');
  const record = { changedPixels: Math.round(share * 10000), total: 10000, settleMs: SETTLE, gapMs: GAP };
  const verdict = restBetweenMoments(record);
  s.check('red proof: the analyser flags the faulted scene as still moving', !verdict.pass, verdict.why);
  // reduced motion: the fixture does not honour it, so its strip facts must flag too
  const cells = [
    { at: 0, ready: false, changedShare: 0.4 },
    { at: 1, ready: true, changedShare: share },
    { at: 2, ready: true, changedShare: share },
  ];
  const red = stillAfterReady(cells);
  s.check('red proof: the analyser flags the faulted scene\'s reduced-motion cells', red.length === cells.length - 1, `${red.length} finding(s)`);
  await p.close();
}

// --- part 2: the contract, on the clean fixture -------------------------------
{
  // warm: it settles once, then the canvas is identical between two moments 3 s apart
  // The fixture's warm show runs 8 s (its model's cycle); the declared settle is the show
  // plus a margin, then the two moments are read 3 s apart.
  const p = await openScene(s, 'fixture', {
    element: 'sg-fixture-scene', module: '/tools/fixtures/fixture-scene/index.js', register: 'warm',
  });
  await p.wait(SETTLE_MS);
  await p.snap('w0'); await p.wait(GAP); await p.snap('w1');
  const share = await p.changed('w0', 'w1');
  const verdict = restBetweenMoments({ changedPixels: Math.round(share * 10000), total: 10000, settleMs: SETTLE, gapMs: GAP });
  s.check('idle rest: warm, settled, 3 s apart, zero changed pixels', verdict.pass, verdict.why);

  // reduced motion: the first frame is the finished still, and nothing moves after ready
  const r = await openScene(s, 'fixture', {
    element: 'sg-fixture-scene', module: '/tools/fixtures/fixture-scene/index.js', register: 'warm', reduced: true,
  });
  await r.snap('r0'); await r.wait(GAP); await r.snap('r1');
  const rShare = await r.changed('r0', 'r1');
  const rVerdict = restBetweenMoments({ changedPixels: Math.round(rShare * 10000), total: 10000, settleMs: 0, gapMs: GAP });
  s.check('reduced motion: the finished still, unchanged 3 s after ready', rVerdict.pass, rVerdict.why);
  const flags = stillAfterReady([
    { at: 0, ready: false, changedShare: 0.2 },
    { at: 1, ready: true, changedShare: rShare },
    { at: 2, ready: true, changedShare: 0 },
  ]);
  s.check('reduced motion: the analyser holds the strip facts (nothing after ready)', flags.length === 0, `${flags.length} finding(s)`);
  await r.close();
  await p.close();
}

await s.done();
console.log('rest checks done');
