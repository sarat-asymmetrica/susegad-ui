// The bake gate: every bake surface's pure reflow half, run headless. No browser, no oracle, no slot.
//
//   node tools/bake-gate.mjs                    all legs; exits 1 on any failure
//   node tools/bake-gate.mjs --leg colour       one leg: text, colour, motion, sound, image
//   node tools/bake-gate.mjs --json             the legs as JSON
//   node tools/bake-gate.mjs --break kn         a committed mutant: the long Kannada notice swapped into the Tinto board
//   node tools/bake-gate.mjs --break floor      a committed mutant: a recolor whose floor repair is gone and whose own violation list says nothing is wrong
//   (a --break run is expected to exit 1; running without the flag is green. tools/lib/bake-gate.test.mjs holds both.)
//
// The legs (decision 0030: a prepared cache is CI-runnable by construction):
//   text    the text tier's own gate (tools/lib/text-gate.*), called not copied: every scene's copy laid into its real shape in
//           en-IN, gom-Deva, gom-Latn and kn. This leg is the i18n leg: a Devanagari or Kannada overflow fails here, and so
//           fails `node tools/checks.mjs`.
//   colour  every shipped palette and the casa-photo cache: floors as baked and across a recolor sweep, ramps even, stops flagged
//   motion  every shipped easing baked: 0 to 1, the still is the end, monotone where it must be, springs' overshoot bounded
//   sound   baked fixtures (synthetic bins and a synthesised buffer): drive and still stay in 0..1 for every option and time
//   image   a hook. packages/image/bake-gate.leg.js, when it exists, default-exports async ({ root }) => the same
//           { leg, ok, checks, failures, warnings, notes } shape (boxes from cached dimensions never overflow their column).
//           Until packages/image/ exists the leg is PENDING: not a pass, counted apart ("4 of 4 legs pass, 1 pending"), exit 0.
//           Once packages/image/ exists without the leg file, the gate fails.
//
// What each leg is judged against is outside the code it checks: colour against a floor spec written in the gate, motion against
// the source easing before it is baked and an absolute overshoot cap, sound against the direction of the unit (silence 0, full 1).
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/hb-canvas.mjs';
import { colourLeg, motionLeg, soundLeg, imageLeg, normaliseLeg } from './lib/bake-gate.core.js';
import { bake, recolor } from '../packages/tokens/bake.js';
import { palettes, motion, registers, springOvershoot } from '../packages/tokens/tokens.js';
import { easeOutCubic, easeInCubic } from '../packages/transitions/kantar/kantar.core.js';
import { bakeFrames, bakeBuffer } from '../packages/sound/bake/bake.core.js';

const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const legArg = arg('leg'), breakArg = arg('break');
const LEGS = ['text', 'colour', 'motion', 'sound', 'image'];
if (legArg && !LEGS.includes(legArg)) { console.error(`--leg must be one of ${LEGS.join(', ')}`); process.exit(2); }
if (breakArg && !['kn', 'floor'].includes(breakArg)) { console.error('--break must be kn or floor'); process.exit(2); }
// checks.mjs runs tools/text-gate.mjs first and sets SG_TEXT_GATE_RAN=1 for the bake gate when it passed, so the text leg (the
// slowest, 1 to 7 s) is not laid out twice in one run. A direct run, and --leg text, always run it.
const textRan = process.env.SG_TEXT_GATE_RAN === '1' && !legArg;
const want = leg => (!legArg || legArg === leg) && !(leg === 'text' && textRan);

// ── inputs, built from what ships ───────────────────────────────────────────

const colourCaches = () => [
  ...Object.keys(palettes).map(name => ({ name, cache: bake(name) })),
  { name: 'casa-photo', cache: bake(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/tokens/palettes/casa-photo.json'), 'utf8'))) },
];

const easings = () => [
  ...['out', 'in-out', 'ink'].map(k => ({ name: `token ease ${k}`, easing: motion.easings[k], kind: 'monotone' })),
  { name: 'kantar easeOutCubic', easing: easeOutCubic, kind: 'monotone' },
  { name: 'kantar easeInCubic', easing: easeInCubic, kind: 'monotone' },
  { name: 'token ease spring (linear())', easing: motion.easings.spring, kind: 'spring', maxOvershoot: springOvershoot(0.72) + 0.005 },
  ...Object.entries(registers).filter(([, r]) => r.spring).flatMap(([name, r]) => [
    { name: `${name} spring (closed form)`, easing: { spring: r.spring }, kind: 'spring', maxOvershoot: springOvershoot(r.spring) + 0.005 },
    { name: `${name} spring (linear())`, easing: r.easeSpring, kind: 'spring', maxOvershoot: springOvershoot(r.spring) + 0.005 },
  ]),
];

const soundFixtures = () => {
  const SR = 48000, BINS = 512;
  const lcg = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const frames = (n, f) => Array.from({ length: n }, (_, i) => Uint8Array.from({ length: BINS }, (_, k) => f(i, k)));
  const sine = Float32Array.from({ length: SR }, (_, i) => (i < SR / 2 ? Math.sin((2 * Math.PI * 880 * i) / SR) : 0));
  return [
    { name: 'silence', cache: bakeFrames(frames(30, () => 0), { hopMs: 50 }), expect: { all: 0 } },
    { name: 'full scale', cache: bakeFrames(frames(30, () => 255), { hopMs: 50 }), expect: { all: 1 } },
    { name: 'tone burst', cache: bakeFrames(frames(40, (i, k) => (i >= 20 && k >= 30 && k <= 34 ? 230 : 0)), { hopMs: 50 }), expect: { louderAfterMs: 20 * 50 } },
    { name: 'noise (seeded)', cache: bakeFrames(frames(40, () => Math.floor(lcg() * 256)), { hopMs: 50 }) },
    { name: 'synthesised buffer', cache: bakeBuffer({ sampleRate: SR, getChannelData: () => sine }, { hopMs: 50 }) },
  ];
};

// ── the legs ────────────────────────────────────────────────────────────────

async function textLeg() {
  const { runTextGate, LANGS, OVERFLOW } = await import('./lib/text-gate.run.mjs');
  const overrides = breakArg === 'kn' ? { 'tinto.board': OVERFLOW['tinto.board'] } : {};
  const { rows, failed } = await runTextGate({ langs: LANGS, overrides });
  const per = LANGS.map(l => { const r = rows.filter(x => x.lang === l); return `${l} ${r.length - r.filter(x => !x.ok).length}/${r.length}`; });
  const failures = failed.map(r => `${r.id} ${r.lang} ${r.viewport}: ${r.result}${r.notes?.length ? ` (${r.notes.join(' ')})` : ''}`);
  return { leg: 'text', ok: !failed.length, checks: rows.length, failures, warnings: [], notes: [`cells passing per language: ${per.join(', ')} (Devanagari = gom-Deva, Kannada = kn)`] };
}

// --break floor: the recolor with its floor repair gone, and a violation list that says nothing is wrong. That is the code fault
// (a theme that drops its floor and stops noticing), put into the function the leg calls, not an option switched on the input.
const noFloorRecolor = (cache, o = {}) => ({ ...recolor(cache, { ...o, floors: false }), violations: [] });

const runners = {
  text: textLeg,
  colour: async () => colourLeg({ caches: colourCaches(), ...(breakArg === 'floor' ? { recolorFn: noFloorRecolor } : {}) }),
  motion: async () => motionLeg({ easings: easings() }),
  sound: async () => soundLeg({ fixtures: soundFixtures() }),
  image: () => imageLeg({ root: REPO_ROOT }),
};

const t0 = performance.now();
if (textRan) console.log('text leg skipped: tools/text-gate.mjs already ran it earlier in this run');
const out = [];
for (const leg of LEGS) {
  if (!want(leg)) continue;
  const t = performance.now();
  const r = normaliseLeg(leg, await runners[leg]());
  r.seconds = +((performance.now() - t) / 1000).toFixed(2);
  out.push(r);
}
const total = ((performance.now() - t0) / 1000).toFixed(1);
const failed = out.filter(r => r.status === 'fail'), pending = out.filter(r => r.status === 'pending'), passed = out.filter(r => r.status === 'pass');
const warned = out.reduce((n, r) => n + r.warnings.length, 0);
const exit = failed.length ? 1 : 0;
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(exit); }
// one line a person can act on, per leg that fails
const HINTS = {
  text: 'the row: node tools/text-gate.mjs --use <id> --lang <lang>; shorten the copy or give the shape more room',
  colour: 'the repair is recolor() in packages/tokens/bake.js; the floors this leg holds it to are FLOOR_SPEC in tools/lib/bake-gate.core.js',
  motion: 'the easings are in packages/tokens/tokens.js and the kantar core; fix the curve, not the cap (OVERSHOOT_CAP, MAX_STEP in tools/lib/bake-gate.core.js)',
  sound: 'drive() and still() are in packages/sound/bake/bake.core.js; silence must read 0, full scale 1, and louder input never reads lower',
  image: 'add packages/image/bake-gate.leg.js',
};
for (const r of out) {
  const tag = r.status === 'pass' ? 'pass' : r.status === 'pending' ? 'PEND' : 'FAIL';
  console.log(`${tag}  ${r.leg.padEnd(7)} ${String(r.checks).padStart(5)} checks  ${String(r.seconds).padStart(5)} s  ${r.notes.join('; ')}`);
  for (const f of r.failures.slice(0, 12)) console.log(`      ! ${f}`);
  if (r.failures.length > 12) console.log(`      ! and ${r.failures.length - 12} more`);
  for (const w of r.warnings) console.log(`      warn: ${w}`);
  if (r.status === 'fail') console.log(`      hint: ${HINTS[r.leg]}`);
}
// the last line is the one checks.mjs shows: it carries the failures, the pending legs and the warnings
console.log(`
bake gate: ${passed.length} of ${passed.length + failed.length} legs pass${failed.length ? `, ${failed.length} FAIL (${failed.map(r => r.leg).join(', ')})` : ''}${pending.length ? `, ${pending.length} pending (${pending.map(r => r.leg).join(', ')})` : ''}${warned ? `, ${warned} warning${warned === 1 ? '' : 's'}` : ''}${breakArg ? ` (--break ${breakArg})` : ''}; ${total} s`);
process.exit(exit);
