// Calibrate the text gate's measuring (tools/lib/hb-canvas.mjs, HarfBuzz) against a real browser.
//
//   node tools/text-gate.calibrate.mjs           measure, print, and write packages/type/fixtures/calibration.json
//   node tools/text-gate.calibrate.mjs --dry     measure and print only
//
// It opens the served repo in headless Chromium (taking a browser slot through the normal session helper),
// loads the real faces from packages/tokens/fonts.css, and measures every string in the gate's copy
// (packages/type/fixtures/gate-copy.js, all four languages) and every word of it, at a few sizes, with
// the same OffscreenCanvas measureText that Pretext uses. The same strings go through the HarfBuzz stand-in.
// The deviation per script is the gate's epsilon: tools/lib/text-gate.core.js reads the committed JSON.
//
// Two font strings per use are measured, because they differ for Kannada:
//   stack  the full token stack ("'Kalam', 'Noto Sans Kannada', ..."): what the gate models and what a scene should ask for;
//   bare   just "Kalam", which is what the scenes write today. Chromium draws Kannada in that from a SYSTEM face, not
//          from the repo's Noto Sans Kannada; the gate cannot model a machine's own fonts, so this is reported as a finding only.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { session, openTarget } from './lib/browser.mjs';
import { createShaper, REPO_ROOT, parseStacks, packageVersion } from './lib/hb-canvas.mjs';
import { COPY } from '../packages/type/fixtures/gate-copy.js';

export const OUT = path.join(REPO_ROOT, 'packages', 'type', 'fixtures', 'calibration.json');
const SIZES = [14, 18, 24, 32];
// Typographic marks the gate copy does not yet use but a translator will (curly quotes, dashes, the ellipsis, the bullet): measured with the
// gate corpus, because a face that has the unicode-range but not the glyph is where a stand-in and a browser can part (glyph 0 is .notdef).
const TYPOGRAPHY = {
  'en-IN': ['“Come for the rain” — Mukta’s ‘quiet’ – poi…', 'Open 7 to 1 • Closed Sundays…'],
  'gom-Deva': ['“पावसाखातीर येयात” — ‘सुको’ – आनी…', '7 ते 1 • आयतारा बंद…'],
  'gom-Latn': ['“Pavsakhatir yeyat” — ‘suko’ – ani…', 'Ugddem 7 te 1 • Aytara bond…'],
  kn: ['“ಮಳೆಗಾಲಕ್ಕೆ ಬನ್ನಿ” — ‘ಒಣ’ – ಮತ್ತು…', '7ರಿಂದ 1 • ಭಾನುವಾರ ಮುಚ್ಚಿದೆ…'],
};
// Held out: strings that are NOT in the gate copy, at fractional sizes the scenes really lay at (Rasika's probe, kept as a standing check).
const HELD_SIZES = [10.08, 15.19, 17.5, 22.03, 31.4];
const Z = '‌';
const HELD_OUT = [
  'AVAWA To Ty Yo fi fl ffi ffl Fjord', 'The quick brown fox jumps over the lazy dog, 10.08 px & 0123456789', 'Poi at 6 and 4, Rs. 1,250/- (incl. GST)',
  'कोंकणी भास करपी लोकां खातीर सोपें', 'क्षत्रिय ज्ञान श्रीमान् द्वारका स्त्री प्रक्रिया', 'आमगेले गांव, पावस सुरू जाल्यार हिरवेंगार दिसता',
  'ಕೊಂಕಣಿ ಭಾಷೆ ಮಾತನಾಡುವ ಜನರಿಗಾಗಿ', 'ಕ್ಷತ್ರಿಯ ಜ್ಞಾನ ಶ್ರೀಮಾನ್ ದ್ವಾರಕಾ ಸ್ತ್ರೀ ಪ್ರಕ್ರಿಯೆ', `ಜೂನ್${Z}ನಿಂದ ಸೆಪ್ಟೆಂಬರ್${Z}ವರೆಗೆ ಮಳೆ`,
  'Konkani ಕೊಂಕಣಿ कोंकणी mixed 2026', 'Under the banyan: “quiet” — and ‘cool’ … •',
];
const dry = process.argv.includes('--dry');

/** Every string the gate lays, by language, as { text, role } (role: 'hand' = Kalam 400, 'plain' = Mukta 500 plaque labels). */
export function corpus() {
  const out = {};
  const put = (lang, text, role) => { (out[lang] ??= []).push({ text, role }); };
  for (const [lang, list] of Object.entries(TYPOGRAPHY)) for (const t of list) { put(lang, t, 'hand'); put(lang, t, 'plain'); }
  for (const entry of Object.values(COPY)) {
    for (const [lang, blocks] of Object.entries(entry.blocks ?? {})) for (const b of blocks) put(lang, b.text, 'hand');
    for (const [lang, labels] of Object.entries(entry.labels ?? {})) for (const t of labels) put(lang, t, 'plain');
    for (const [lang, ds] of Object.entries(entry.details ?? {})) for (const t of ds) put(lang, t, 'plain');
  }
  return out;
}

const wordsOf = text => [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)].map(s => s.segment).filter(s => s.trim());
const scriptOf = text => (/[ಀ-೿]/.test(text) ? 'kannada' : /[ऀ-ॿ]/.test(text) ? 'devanagari' : 'latin');
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)] : 0; };

/** max / p95 / mean of |dev| in px and in relative terms, over a list of { abs, rel }. */
function summary(rows) {
  if (!rows.length) return null;
  const abs = rows.map(r => Math.abs(r.abs)), rel = rows.map(r => Math.abs(r.rel));
  const r2 = n => +n.toFixed(3);
  return {
    n: rows.length, maxAbsPx: r2(Math.max(...abs)), p95AbsPx: r2(q(abs, 0.95)), maxRel: +Math.max(...rel).toFixed(5), p95Rel: +q(rel, 0.95).toFixed(5),
    meanSigned: r2(rows.reduce((a, r) => a + r.abs, 0) / rows.length), // positive: HarfBuzz is wider than Chromium
  };
}

async function main() {
  const shaper = await createShaper({ root: REPO_ROOT, stack: 'token' });
  const stacks = parseStacks(fs.readFileSync(path.join(REPO_ROOT, 'packages/tokens/tokens.css'), 'utf8'));
  const quote = f => (/\s/.test(f) ? `'${f}'` : f);
  const stackFont = { hand: stacks['sg-font-hand'].map(quote).join(', '), plain: stacks['sg-font-body'].map(quote).join(', ') };
  const bareFont = { hand: 'Kalam', plain: 'Mukta' };
  const weight = { hand: 400, plain: 500 };

  const items = []; // { lang, script, kind, role, px, text, fonts: {stack, bare} }
  const seen = new Set();
  for (const [lang, list] of Object.entries(corpus())) {
    for (const { text, role } of list) {
      const pieces = [['string', text], ...wordsOf(text).map(w => ['word', w])];
      for (const [kind, t] of pieces) for (const px of SIZES) {
        const key = `${role}|${px}|${t}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ lang, script: scriptOf(t), kind, role, px, text: t, set: 'gate', stack: `${weight[role]} ${px}px ${stackFont[role]}`, bare: `${weight[role]} ${px}px ${bareFont[role]}` });
      }
    }
  }

  for (const text of HELD_OUT) for (const px of HELD_SIZES) for (const role of ['hand', 'plain']) {
    items.push({ lang: '-', script: scriptOf(text), kind: 'string', role, px, text, set: 'held', stack: `${weight[role]} ${px}px ${stackFont[role]}`, bare: `${weight[role]} ${px}px ${bareFont[role]}` });
  }
  const s = await session();
  let chromium, fontInfo;
  try {
    const { page } = await openTarget(s, { url: '/tools/harness/blank.html' });
    await page.addStyleTag({ url: '/packages/tokens/fonts.css' });
    // load every face the gate can use, so canvas text has them (canvas never triggers a download itself)
    fontInfo = await page.evaluate(async fams => {
      const loaded = [];
      for (const f of fams) { const r = await document.fonts.load(f.spec, f.sample); loaded.push(`${f.spec}: ${r.length}`); }
      await document.fonts.ready;
      return [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight} ${f.unicodeRange.slice(0, 18)}`);
    }, [
      { spec: '400 20px Kalam', sample: 'Hello' }, { spec: '400 20px Kalam', sample: 'कोंकणी' }, { spec: '300 20px Kalam', sample: 'Hello' },
      { spec: '400 20px Mukta', sample: 'Hello' }, { spec: '500 20px Mukta', sample: 'Hello' }, { spec: '600 20px Mukta', sample: 'Hello' },
      { spec: '500 20px Mukta', sample: 'कोंकणी' }, { spec: '400 20px "Noto Sans Kannada"', sample: 'ಕನ್ನಡ' }, { spec: '600 20px "Noto Sans Kannada"', sample: 'ಕನ್ನಡ' },
    ]);
    const measured = await page.evaluate(list => {
      const ctx = new OffscreenCanvas(1, 1).getContext('2d');
      return list.map(i => { ctx.font = i.stack; const a = ctx.measureText(i.text).width; ctx.font = i.bare; return [a, ctx.measureText(i.text).width]; });
    }, items.map(({ stack, bare, text }) => ({ stack, bare, text })));
    chromium = s.version;
    items.forEach((it, i) => { it.chrome = measured[i][0]; it.chromeBare = measured[i][1]; });
  } finally { await s.done(); }

  for (const it of items) it.hb = shaper.measure(it.stack, it.text);

  const result = { stack: {}, bareKalamVsStack: {}, heldOut: {} };
  const gateItems = items.filter(i => i.set !== 'held');
  for (const kind of ['string', 'word']) {
    for (const script of ['latin', 'devanagari', 'kannada']) {
      const rows = gateItems.filter(i => i.kind === kind && i.script === script).map(i => ({ abs: i.hb - i.chrome, rel: (i.hb - i.chrome) / i.chrome }));
      const s_ = summary(rows);
      if (s_) (result.stack[kind] ??= {})[script] = s_;
    }
  }
  // held out: strings not in the gate copy, at fractional sizes; in the same shape as `stack.string`
  for (const script of ['latin', 'devanagari', 'kannada']) {
    const rows = items.filter(i => i.set === 'held' && i.script === script).map(i => ({ abs: i.hb - i.chrome, rel: (i.hb - i.chrome) / i.chrome }));
    const s_ = summary(rows);
    if (s_) result.heldOut[script] = s_;
  }
  // what the scenes write today ('Kalam' alone): how far is Chromium's own answer from the stack answer?
  for (const script of ['latin', 'devanagari', 'kannada']) {
    const rows = gateItems.filter(i => i.kind === 'string' && i.script === script && i.role === 'hand').map(i => ({ abs: i.chromeBare - i.chrome, rel: (i.chromeBare - i.chrome) / i.chrome }));
    const s_ = summary(rows);
    if (s_) result.bareKalamVsStack[script] = s_;
  }

  // the worst string rows, so a reader can see what the maxima are
  const worst = [...gateItems].filter(i => i.kind === 'string').map(i => ({ lang: i.lang, script: i.script, role: i.role, px: i.px, text: i.text.slice(0, 40), chrome: +i.chrome.toFixed(2), hb: +i.hb.toFixed(2), diff: +(i.hb - i.chrome).toFixed(2) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8);

  const files = [...new Set(shaper.faces.map(f => f.file))].sort().map(f => ({ file: path.relative(REPO_ROOT, f).replaceAll('\\', '/'), bytes: fs.statSync(f).size, sha1: crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12) }));
  const out = {
    about: 'HarfBuzz stand-in (tools/lib/hb-canvas.mjs) against headless Chromium canvas measureText. Written by tools/text-gate.calibrate.mjs; deviation = HarfBuzz minus Chromium; "string" rows are whole copy strings (what a line is made of), "word" rows are single words (what Pretext measures).',
    date: new Date().toLocaleDateString('sv-SE'), chromium, platform: `${process.platform} ${process.arch}`, harfbuzzjs: packageVersion('harfbuzzjs'), wawoff2: packageVersion('wawoff2'),
    sizesPx: SIZES, heldOutSizesPx: HELD_SIZES, samples: gateItems.length, heldOutSamples: items.length - gateItems.length, languages: Object.keys(corpus()), fonts: files, fontsLoadedInChromium: fontInfo,
    stack: result.stack, heldOut: result.heldOut, bareKalamVsStack: result.bareKalamVsStack, worstStrings: worst,
  };
  console.log(JSON.stringify({ ...out, fonts: `${files.length} files`, fontsLoadedInChromium: `${fontInfo.length} faces`, worstStrings: undefined }, null, 2));
  console.log('\nworst strings (HarfBuzz - Chromium, px):');
  for (const w of worst) console.log(`  ${w.lang.padEnd(8)} ${w.script.padEnd(10)} ${String(w.px).padStart(2)}px  chrome ${String(w.chrome).padStart(8)}  hb ${String(w.hb).padStart(8)}  ${w.diff > 0 ? '+' : ''}${w.diff}  ${w.text}`);
  if (shaper.unmodelled.size) console.log('\nunmodelled characters:', [...shaper.unmodelled.keys()].join(' '));
  if (!dry) { fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n'); console.log(`\nwrote ${path.relative(REPO_ROOT, OUT)}`); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
