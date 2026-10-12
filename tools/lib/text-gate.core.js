// The text gate's judging, pure: no fonts, no files, no DOM, no Pretext. It is handed
//   - a manifest of text-in-shape uses (text-gate.manifest.js), each of which can lay its copy into the real
//     shape the scene draws, by calling the real setBlocks / layIntoShape / labelBox on the layout it is given;
//   - `measure(font, text)`, a width in CSS px from an independent shaper, to re-measure each laid line whole;
//   - `epsilon`, the slack in CSS px (it comes from tools/text-gate.calibrate.mjs, see packages/type/fixtures/calibration.json).
// and says, for every use x language x viewport, whether the words FIT, FALL BACK to the flat reading, or ESCAPE.
//
//   fits         the surface holds the words: every line inside its band, every size legible.
//   falls-back   the scene would show its flat reading instead (no legible size holds the words). A designed outcome;
//                it is a failure only where the manifest says the surface must HOLD them (`expect: 'holds'`).
//   escapes      a line is wider than the band it sits in (beyond epsilon), a word was broken, or words were lost.
//                The scene would show it. Always a failure.
//   not-gated    the manifest says why this cell cannot be judged from arithmetic (a browser fact, or the surface is flat there).
//
// Alongside, the accessibility leg: no size under the surface's own legible minimum (or 14 CSS px at phone width),
// line height at least 1.15 x the size, and every laid line has a finite calm box (calmOf).

/** Line height must be at least this many times the font size. */
export const MIN_LEADING = 1.15;
/** The smallest body size on a phone-width screen, CSS px. */
export const PHONE_MIN_PX = 14;

const collapse = s => s.replace(/\s+/g, ' ').trim();
const fmt = n => (Math.round(n * 10) / 10).toString();

/**
 * Judge one laid result. Returns { escapes: string[], a11y: string[] } (empty arrays mean clean).
 * @param {object} p
 * @param {{ lines: object[], blocks: object[] }} p.laid
 * @param {(line: object) => ({ x: number, w: number } | null)} p.bandAt  the room where this line sits, logical units
 * @param {(line: object) => string} p.fontOf  the canvas font string this line was measured in
 * @param {number} p.scale  CSS px per logical unit
 * @param {number} p.epsilon  CSS px
 * @param {(font: string, text: string) => number} p.measure  independent width, CSS px
 * @param {string[]|null} p.source  the blocks' source text, to prove no words were lost (null: skip)
 * @param {(tag: string) => number|null} p.minPx  the legible minimum for a block's tag, CSS px
 * @param {boolean} p.phone
 * @param {(lines: object[]) => object[]} p.calmOf
 */
export function judgeLaid({ laid, bandAt, fontOf, scale, epsilon, measure, source, minPx, phone, calmOf, exactWidth = true }) {
  const escapes = [], a11y = [];
  const epsL = epsilon / scale;
  laid.lines.forEach((l, i) => {
    const band = bandAt(l);
    const where = `"${collapse(l.text).slice(0, 28)}"`;
    if (!band) { escapes.push(`line ${i + 1} ${where} sits where the shape has no room`); return; }
    // the line, re-measured whole by the shaper (Pretext summed it segment by segment), against the band
    const whole = measure(fontOf(l), l.text.replace(/\s+$/u, '')) / scale;
    if (whole > band.w + epsL) escapes.push(`line ${i + 1} ${where} is ${fmt((whole - band.w) * scale)} px wider than its band (${fmt(whole * scale)} of ${fmt(band.w * scale)} px)`);
    if (l.x < band.x - epsL || l.x + l.w > band.x + band.w + epsL) escapes.push(`line ${i + 1} ${where} box [${fmt(l.x)}, ${fmt(l.x + l.w)}] leaves its band [${fmt(band.x)}, ${fmt(band.x + band.w)}] (in scene units)`);
  });
  if (source) {
    laid.blocks.forEach((b, i) => {
      const got = collapse(laid.lines.filter(l => l.block === i).map(l => l.text).join(''));
      if (got !== collapse(source[i] ?? '')) escapes.push(`block ${i + 1} (${b.tag}) lost words: laid ${got.length} of ${collapse(source[i] ?? '').length} characters`);
    });
  }
  for (const b of laid.blocks) {
    const min = minPx(b.tag);
    if (min != null && b.px < min - 1e-6) a11y.push(`${b.tag} is ${fmt(b.px)} px, under its minimum ${fmt(min)} px`);
    if (phone && b.px < PHONE_MIN_PX - 1e-6) a11y.push(`${b.tag} is ${fmt(b.px)} px on a phone, under ${PHONE_MIN_PX} px`);
    if (b.lineHeight < b.px * MIN_LEADING - 1e-6) a11y.push(`${b.tag} line height ${fmt(b.lineHeight)} px is under ${MIN_LEADING} x its ${fmt(b.px)} px size`);
  }
  if (exactWidth) {
    // the width the oracle reported is what centring and the calm boxes use: it must be the width the shaper gives the whole line
    laid.lines.forEach((l, i) => {
      const whole = measure(fontOf(l), l.text.replace(/\s+$/u, ''));
      if (Math.abs(l.w * scale - whole) > epsilon) a11y.push(`line ${i + 1} "${collapse(l.text).slice(0, 28)}" reports ${fmt(l.w * scale)} px wide but measures ${fmt(whole)} px, so its centring and calm box are off`);
    });
  }
  const calm = calmOf(laid.lines);
  if (calm.length !== laid.lines.length || calm.some(r => ![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w < 0 || r.h <= 0)) a11y.push('a laid line has no calm box, so the scene cannot keep its people clear of it');
  return { escapes, a11y };
}

/** Is a cell's outcome what the manifest expects? */
export function judgeExpectation(result, expect) {
  if (result === 'escapes') return false;
  if (result === 'falls-back') return expect !== 'holds';
  return true; // fits (and not-gated)
}

/**
 * Run one cell: one use, in one language, at one viewport.
 * @returns {{ id, lang, viewport, result, expected, ok, px, lines, notes: string[], issues: string[] }}
 */
export function gateCell(use, { lang, vp, entry, layout, measure, epsilon, calmOf, ctx }) {
  const base = { id: use.id, lang, viewport: vp.name, px: null, lines: null, notes: [], issues: [] };
  const ruled = use.viewports[vp.name];
  if (typeof ruled === 'string') return { ...base, result: 'not-gated', expected: '-', ok: true, notes: [ruled] };
  const rule = ruled.byLang?.[lang];
  const expected = rule?.expect ?? rule ?? ruled.expect;
  const waiver = rule?.waiver ?? null, waiverFor = rule?.onlyFor ?? null;

  // a use may have several variants (seeds, poses, scales): the cell is its worst one
  const variants = use.variants ? use.variants(vp) : [{ id: '' }];
  let worst = null;
  for (const variant of variants) {
    const run = use.run({ layout, entry, lang, vp, variant, ...ctx });
    const cell = judgeRun(use, run, { vp, measure, epsilon, calmOf, source: entry.blocks?.[lang]?.map(b => b.text) ?? null });
    cell.variant = variant.id;
    const rank = r => (r.escapes.length ? 3 : r.a11y.length ? 2 : !r.laid ? 1 : 0);
    if (!worst || rank(cell) > rank(worst)) worst = cell;
  }
  const w = worst;
  const result = w.escapes.length ? 'escapes' : w.laid ? 'fits' : 'falls-back';
  const issues = [...w.escapes, ...w.a11y];
  const notes = [...(w.notes ?? [])];
  if (!w.laid && w.reason) notes.push(w.reason);
  if (w.variant) notes.push(`worst of ${variants.length} variants: ${w.variant}`);
  let ok = judgeExpectation(result, expected) && !w.a11y.length;
  if (waiver) {
    // a waiver is a known finding written down: the cell may fall back, loudly, until it is fixed, and only for the reason it names
    // (onlyFor); once the cell holds the words the waiver must go
    if (result === 'fits') { ok = false; issues.push('stale waiver: this cell now holds the words, so remove the waiver from the manifest'); }
    else if (waiverFor && w.reasonKind !== waiverFor) { ok = false; issues.push(`the waiver covers only "${waiverFor}", but this cell falls back for "${w.reasonKind ?? result}"; fix the new cause, or widen the waiver in the manifest and say why`); }
    else notes.unshift(`WAIVED: ${waiver}`);
  }
  const warnings = [];
  const texts = entry.blocks?.[lang]?.map(b => b.text) ?? entry.labels?.[lang] ?? [];
  // the repo ships a face for every script it sets: a character no face in the stack covers is a regression (a stack that lost its Kannada face),
  // not an unknowable system font, so the widths of this cell are not to be trusted and it fails
  const bad = use.stack && ctx.uncovered ? ctx.uncovered(use.stack, use.weight ?? 400, texts) : [];
  if (bad.length) { ok = false; issues.push(`no face in the ${use.stack} stack covers ${bad.length} character${bad.length === 1 ? '' : 's'} of the ${lang} copy (${bad.slice(0, 8).join(' ')}${bad.length > 8 ? ' ...' : ''}): they would be drawn from a system font and measured wrongly; put a face that covers them back in the stack, or take them out of the copy`); }
  if (use.softMin && w.laid && w.laid.blocks.some(b => b.px < use.softMin - 1e-6)) warnings.push(`smallest text is ${+Math.min(...w.laid.blocks.map(b => b.px)).toFixed(2)} px, under the ${use.softMin} px the other surfaces keep; this scene declares no minimum of its own, so raise the size or give it one ("legible") in the manifest`);
  return {
    ...base, result, expected, ok, px: w.laid ? w.laid.blocks.map(b => b.px) : null, lines: w.laid ? w.laid.lines.length : null,
    notes, issues, warnings, waived: !!waiver,
  };
}

function judgeRun(use, run, { vp, measure, epsilon, calmOf, source }) {
  if (!run.laid) {
    // setBlocks gave the words back: the flat reading. A surface that shows what it laid even when it did not fit
    // (use.onUnfit === 'escapes') has no such door, so an unfit lay IS an escape.
    if (use.onUnfit === 'escapes') return { laid: null, escapes: [run.reason ?? 'the words do not fit the shape'], a11y: [] };
    return { laid: null, escapes: [], a11y: [], reason: run.reason, reasonKind: run.reasonKind };
  }
  const { escapes, a11y } = judgeLaid({
    laid: run.laid, bandAt: run.bandAt, fontOf: run.fontOf, scale: run.scale, epsilon, measure, source: run.checkSource === false ? null : source, exactWidth: run.exactWidth !== false,
    minPx: tag => (use.legible ? use.legible(vp, tag) : null), phone: vp.phone && !use.flatOnPhone, calmOf,
  });
  return { laid: run.laid, escapes, a11y, notes: run.notes };
}

/**
 * Run the manifest.
 * @param {object} o
 * @param {Array} o.manifest uses
 * @param {Record<string, object>} o.copy gate-copy.js COPY
 * @param {Record<string, object>} [o.overrides] OVERFLOW-style replacements: { useCopyKey: { lang, blocks } }
 * @param {string[]} o.langs
 * @param {Array<{name: string, vw: number, rootPx: number, hostW: number, phone: boolean}>} o.viewports
 * @param {{ id?: string }} [o.only]
 */
export function runGate({ manifest, copy, overrides = {}, langs, viewports, layout, measure, epsilon, calmOf, ctx = {}, only }) {
  const rows = [];
  for (const use of manifest) {
    if (only?.id && use.id !== only.id) continue;
    const base = copy[use.copy];
    if (!base) throw new Error(`manifest use ${use.id}: no copy "${use.copy}" in gate-copy.js`);
    for (const lang of langs) {
      let entry = base;
      const ov = overrides[use.copy];
      if (ov && ov.lang === lang) entry = { ...base, blocks: { ...base.blocks, [lang]: ov.blocks } };
      for (const vp of viewports) {
        if (!(vp.name in use.viewports)) continue;
        rows.push(gateCell(use, { lang, vp, entry, layout, measure, epsilon, calmOf, ctx }));
      }
    }
  }
  return rows;
}

/** The rows that fail the gate. */
export const failures = rows => rows.filter(r => !r.ok);

/** A plain-text table of the rows, with the reason under every row that is not simply fitting. */
export function formatTable(rows) {
  const head = ['use', 'lang', 'viewport', 'result', 'expect', 'px', 'lines'];
  const cells = rows.map(r => [r.id, r.lang, r.viewport, r.result + (r.ok ? '' : '  FAIL'), r.expected, r.px ? [...new Set(r.px)].map(p => +p.toFixed(2)).join('/') : '-', r.lines ?? '-']);
  const widths = head.map((h, i) => Math.max(h.length, ...cells.map(c => String(c[i]).length)));
  const line = c => c.map((v, i) => String(v).padEnd(widths[i])).join('  ').trimEnd();
  const out = [line(head), line(widths.map(w => '-'.repeat(w)))];
  rows.forEach((r, i) => {
    out.push(line(cells[i]));
    if (!r.ok || r.result !== 'fits') for (const n of [...r.issues, ...r.notes]) out.push(`    ${r.ok ? '' : '! '}${n}`);
    for (const w of r.warnings ?? []) out.push(`    warn: ${w}`);
  });
  return out.join('\n');
}
