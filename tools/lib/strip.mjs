// The maths and layout behind tools/strip.mjs and tools/onion.mjs. Pure and dependency-free, so the
// tools run it inside the browser on canvas ImageData and node:test runs it on plain arrays. Tested in
// strip.test.mjs. The pixel maths (luminance, per-step change, the median, the onion blends) moved to
// pixels.mjs and is re-exported here, so the tools' one import path still serves it.
//
// Nothing here touches a page. The tools capture frames; this file says when they were taken, how
// they are laid out, what changed between them, and what that means in words.

export { meanLuminance, analyseFrames, medianFrame, onionAlphas, onionBlend, onionDiff } from './pixels.mjs';

/** The harness clock ticks 1/60 s per frame, so a time lands only on a whole frame. */
export const FPS = 60;
export const frameOf = t => Math.round(t * FPS);
export const timeOf = k => k / FPS;

/** `-n 12` is what the request and the README write; the shared parser knows only `--n`. */
export function shortFlags(argv) {
  return argv.map(a => (a === '-n' ? '--n' : /^-n=/.test(a) ? `-${a}` : a));
}

/**
 * n times from `from` to `to`, both included (n = 1 gives `from`).
 * The spacing must be at least one clock frame, or two cells would show the same frame.
 */
export function evenTimes(from, to, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`-n must be a whole number, 1 or more (got ${n})`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0) throw new Error('--from and --to must be seconds, from 0 up');
  if (n > 1 && to <= from) throw new Error(`--to (${to}) must be after --from (${from})`);
  const times = n === 1 ? [from] : Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
  const frames = times.map(frameOf);
  for (let i = 1; i < frames.length; i++) {
    if (frames[i] <= frames[i - 1]) {
      throw new Error(`${n} frames over ${from} to ${to} s are closer than one clock frame (1/${FPS} s); lower -n or widen the span`);
    }
  }
  return times;
}

/** Columns for a strip of n cells: a row of up to four, then a grid that stays readable. */
export function columnsFor(n, cols) {
  if (cols) return Math.max(1, Math.min(n, Math.floor(cols)));
  return n <= 4 ? n : n <= 6 ? 3 : n <= 16 ? 4 : 6;
}

/**
 * Where everything goes on a strip sheet. Sizes in px; the browser side draws exactly this.
 * @param {{ n: number, frameW: number, frameH: number, cellW?: number, cols?: number, gap?: number,
 *   pad?: number, lineH?: number, labelH?: number, headerLines?: number }} o
 */
export function layoutStrip({ n, frameW, frameH, cellW = 320, cols, gap = 10, pad = 16, lineH = 18, labelH = 22, headerLines = 2 }) {
  if (!(frameW > 0 && frameH > 0)) throw new Error('frame size must be positive');
  const c = columnsFor(n, cols), rows = Math.ceil(n / c);
  const w = Math.round(cellW), h = Math.max(1, Math.round((frameH * w) / frameW));
  const headerH = pad + headerLines * lineH + 10;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const x = pad + (i % c) * (w + gap);
    const top = headerH + Math.floor(i / c) * (labelH + h + gap);
    cells.push({ i, label: { x, y: top, w, h: labelH }, image: { x, y: top + labelH, w, h } });
  }
  return {
    width: pad * 2 + c * w + (c - 1) * gap,
    height: headerH + rows * (labelH + h + gap) - gap + pad,
    header: { x: pad, y: pad, lineH, lines: headerLines },
    cols: c, rows, cell: { w, h }, cells,
  };
}

/** Where an onion sheet's one image goes, under its header. */
export function layoutOnion({ frameW, frameH, pad = 16, lineH = 18, headerLines = 3 }) {
  const headerH = pad + headerLines * lineH + 10;
  return {
    width: frameW + pad * 2, height: headerH + frameH + pad,
    header: { x: pad, y: pad, lineH, lines: headerLines },
    image: { x: pad, y: headerH, w: frameW, h: frameH },
  };
}

const fmtS = t => `${t.toFixed(2)} s`;
const fmtRange = (a, b) => `${a.toFixed(2)} to ${b.toFixed(2)} s`;

/** A share as a percent that never rounds a real change to nothing. */
export function pct(r) {
  if (r == null) return 'n/a';
  if (r === 0) return '0%';
  if (r < 0.0005) return '<0.05%';
  return `${(r * 100).toFixed(r < 0.1 ? 2 : 1)}%`;
}

/**
 * The header of a sheet, one string per line.
 * @param {{ scene?: string, url?: string, register?: string, theme?: string, seed?: string|number,
 *   params?: Record<string,string>, clock: 'frozen'|'real', from: number, to: number, n: number,
 *   size?: { w: number, h: number }, kind?: 'strip'|'onion', times?: number[], diff?: boolean }} m
 */
export function headerLines(m) {
  const what = m.scene ? m.scene : m.url;
  const params = Object.entries(m.params || {}).map(([k, v]) => `${k}=${v}`);
  const l1 = [what, m.register ?? 'warm', m.theme ?? 'light', `seed ${m.seed ?? 'default'}`, ...params].join(' · ');
  const clock = m.clock === 'frozen'
    ? `frozen clock (virtual ${FPS} Hz, same seed gives the same frames)`
    : 'real clock (times measured, not repeatable)';
  const l2 = `${fmtRange(m.from, m.to)} · ${m.n} frame${m.n === 1 ? '' : 's'}${m.size ? ` · ${m.size.w} x ${m.size.h} px each` : ''} · ${clock}`;
  if (m.kind !== 'onion') return [l1, l2];
  const l3 = m.diff
    ? `only what changed between frames: older steps fainter, newest solid (frames at ${m.times.map(t => t.toFixed(2)).join(', ')} s)`
    : `frames blended over their still background: older fainter, newest solid (at ${m.times.map(t => t.toFixed(2)).join(', ')} s)`;
  return [l1, l2, l3];
}

/** The label above a strip cell: its time, and how much of the picture moved since the cell before. */
export function cellLabel(cell) {
  const t = fmtS(cell.t);
  return cell.changed == null ? `${t} · first frame` : `${t} · ${pct(cell.changed)} changed`;
}

// ── facts ─────────────────────────────────────────────────────────────────

export const FACT_DEFAULTS = {
  still: 1.5,       // seconds of no change, while playing, before it is called frozen
  eps: 0.0002,      // a step that changes no more than this share of pixels counts as no change
  jumpMin: 0.05,    // a step must change at least this share to be a jump
  jumpFactor: 4,    // ...and this many times what the steps around it change
  jumpFloor: 0.005, // ...where "around it" is never counted lower than this share
};

const median = a => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length ? (s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2) : 0;
};

/**
 * What the strip says about motion, from the numbers alone.
 *
 * A step is the change from one cell to the next. A **frozen span** is a run of steps that change
 * (almost) nothing while `playing` is true at every cell of the run and it lasts longer than
 * `still` seconds. A run that is quiet while not playing is a **rest**, listed but not flagged:
 * a paused scene is meant to hold still. A **jump** is a step that changes far more than the
 * steps round it (two either side), the usual sign of a stage cut or a pop.
 * Everything is sampled at the strip's spacing: a freeze or jump shorter than one step can hide
 * between two cells, and `resolution` says how long that is.
 *
 * @param {{ t: number, playing: boolean|null, changed: number|null, bbox: null|{x:number,y:number,w:number,h:number} }[]} cells
 */
export function motionFacts(cells, opts = {}) {
  const o = { ...FACT_DEFAULTS, ...opts };
  const steps = [];
  for (let i = 1; i < cells.length; i++) {
    steps.push({ i, from: cells[i - 1].t, to: cells[i].t, dt: cells[i].t - cells[i - 1].t, changed: cells[i].changed, bbox: cells[i].bbox });
  }
  const quiet = s => s.changed <= o.eps;

  const frozen = [], rests = [];
  for (let k = 0; k < steps.length;) {
    if (!quiet(steps[k])) { k++; continue; }
    let e = k;
    while (e + 1 < steps.length && quiet(steps[e + 1])) e++;
    const a = cells[steps[k].i - 1], b = cells[steps[e].i];
    const span = { from: a.t, to: b.t, duration: b.t - a.t, steps: e - k + 1 };
    if (span.duration > o.still) {
      const run = cells.slice(steps[k].i - 1, steps[e].i + 1);
      if (run.every(c => c.playing === true)) frozen.push(span);
      else rests.push({ ...span, playing: run.some(c => c.playing === false) ? false : null });
    }
    k = e + 1;
  }

  const jumps = [];
  steps.forEach((s, k) => {
    const around = steps.filter((_, j) => j !== k && Math.abs(j - k) <= 2).map(x => x.changed);
    const base = around.length ? median(around) : 0;
    if (s.changed >= o.jumpMin && s.changed >= o.jumpFactor * Math.max(base, o.jumpFloor)) {
      jumps.push({ from: s.from, to: s.to, changed: s.changed, around: base, bbox: s.bbox });
    }
  });

  const moving = steps.filter(s => !quiet(s));
  const boxes = moving.map(s => s.bbox).filter(Boolean);
  const union = boxes.length ? {
    x: Math.min(...boxes.map(b => b.x)), y: Math.min(...boxes.map(b => b.y)),
    w: Math.max(...boxes.map(b => b.x + b.w)) - Math.min(...boxes.map(b => b.x)),
    h: Math.max(...boxes.map(b => b.y + b.h)) - Math.min(...boxes.map(b => b.y)),
  } : null;

  return {
    thresholds: o,
    resolution: steps.length ? Math.max(...steps.map(s => s.dt)) : 0,
    active: moving.length ? { from: moving[0].from, to: moving[moving.length - 1].to } : null,
    union, steps, frozen, rests, jumps,
  };
}

/** The facts as plain lines an agent can quote. */
export function factsText(f, size) {
  const at = size ? ` (of ${size.w} x ${size.h})` : '';
  const box = b => `x ${b.x} to ${b.x + b.w}, y ${b.y} to ${b.y + b.h}`;
  const out = [];
  out.push(`sampled every ${f.resolution.toFixed(2)} s at most; a freeze or jump shorter than that can hide between two cells`);
  if (!f.active) out.push('no motion: nothing changed between any two cells');
  else {
    out.push(`motion from ${fmtRange(f.active.from, f.active.to)}${f.union ? `, inside ${box(f.union)}${at}` : ''}`);
  }
  for (const s of f.steps) {
    out.push(`  ${fmtRange(s.from, s.to)}: ${pct(s.changed)} changed${s.bbox ? `, ${box(s.bbox)}` : ''}`);
  }
  if (!f.frozen.length) out.push(`frozen spans: none (no stretch over ${f.thresholds.still} s of no change while playing)`);
  for (const s of f.frozen) out.push(`FROZEN ${fmtRange(s.from, s.to)}: ${s.duration.toFixed(2)} s with no change while playing`);
  for (const s of f.rests) out.push(`at rest ${fmtRange(s.from, s.to)}: no change, and not playing${s.playing === null ? ' (unknown)' : ''}, so not flagged`);
  if (!f.jumps.length) out.push('jumps: none (no step changes far more than its neighbours)');
  for (const j of f.jumps) {
    out.push(`JUMP ${fmtRange(j.from, j.to)}: ${pct(j.changed)} changed against ${pct(j.around)} around it${j.bbox ? `, ${box(j.bbox)}` : ''}`);
  }
  return out;
}
