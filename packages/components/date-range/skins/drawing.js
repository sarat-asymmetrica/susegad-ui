// The drawn calendar shared by the warm and playful skins, from the Casa
// booking page: a hand-drawn loop round your arrival and departure, an inked
// underline under the nights between, and the season ribbon above. All of it
// is decoration (aria-hidden); the grid and the season table carry the meaning.

import { ink } from '../../../engine/src/ink.js';
import { hatch, wash } from '../../../engine/src/hatch.js';
import { roughen, resample } from '../../../engine/src/geom.js';
import { rng } from '../../../engine/src/rng.js';
import { TAU, clamp, lerp, ease } from '../../../engine/src/math.js';
import { addDays, addMonths, diffDays, eachDay, toDay, ym } from '../../../kernels/booking/dates.js';
import { bandFor } from '../../../kernels/booking/rates.js';
import { seasonRuns } from '../date-range.core.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAMES = { before: 'enquiries', after: 'not open yet', launch: 'monsoon', shoulder: 'shoulder', peak: 'Christmas', late: 'late season' };
// Tokens may be light-dark(…) or oklch, which a canvas cannot always read: let the
// browser resolve each one to a colour through a probe, the way CSS would.
let probe = null;
const css = (el, name, fallback) => {
  if (!getComputedStyle(el).getPropertyValue(name).trim()) return fallback;
  if (name.startsWith('--sg-font')) return getComputedStyle(el).getPropertyValue(name).trim();
  probe ??= Object.assign(document.createElement('span'), { hidden: true });
  el.append(probe);
  probe.style.color = `var(${name})`;
  const c = getComputedStyle(probe).color;
  probe.remove();
  return toHex(c) || fallback;
};
// the engine's wash and hatch read hex, so paint the colour and read it back
let dot = null;
function toHex(color) {
  dot ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  dot.clearRect(0, 0, 1, 1);
  dot.fillStyle = '#000'; dot.fillStyle = color; dot.fillRect(0, 0, 1, 1);
  const [r, g, b] = dot.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A canvas over `parent` that tracks its box and pixel ratio; draw(g, w, h) works in CSS pixels. */
function overlay(parent, cls, draw) {
  const c = document.createElement('canvas');
  c.className = cls; c.setAttribute('aria-hidden', 'true');
  parent.append(c);
  const g = c.getContext('2d');
  const redraw = () => {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    draw(g, r.width, r.height);
  };
  const ro = new ResizeObserver(redraw);
  ro.observe(c);
  return { c, redraw, destroy() { ro.disconnect(); c.remove(); } };
}

/** A loop round a box, a little more than one turn and never quite closed. */
function handLoop(x, y, w, h, seed, maxW, grow) {
  const r = rng(seed), cx = x + w / 2, cy = y + h / 2;
  const rx = Math.min(w / 2 + 3, (cx - 2) / 1.07, (maxW - cx - 2) / 1.07), ry = h / 2 + 2;
  const start = r.range(-2.6, -1.9), turn = TAU * r.range(1.06, 1.14), pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = start + turn * (i / 64), k = 1 + grow * (i / 64);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * 0.96]);
  }
  return pts;
}
function prefix(pts, len) {
  const out = [pts[0]];
  for (let i = 1, acc = 0; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + d >= len) { const t = (len - acc) / d; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); return out; }
    acc += d; out.push(b);
  }
  return out;
}
const lengthOf = pts => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/**
 * @param {{ color: string, fallback: string, width: number, jitter: number, grow: number, ms: number, overshoot?: boolean }} o
 */
export function drawnCalendar(o) {
  return function mount(host, ctx) {
    const cal = host.calendar;
    if (!cal) return { update() {}, destroy() {} };
    let sel = { arr: null, dep: null }, p = 1, anim = 0, band = null, lastKey = '', rates = host.rates;

    // the inked selection, over the months
    const inkLayer = overlay(cal.months, 'sg-dr-ink', g => {
      const base = cal.months.getBoundingClientRect(), paths = [];
      const rect = iso => { const b = host.dayButtons.get(iso); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; };
      const seed = toDay(sel.arr || '2026-01-01');
      const a = sel.arr && rect(sel.arr);
      if (a) paths.push(handLoop(a.x, a.y, a.w, a.h, seed, base.width, o.grow));
      if (sel.arr && sel.dep) {
        let run = null;
        const flush = () => { if (run) paths.push(resample([[run.x0, run.y], [run.x1, run.y + (run.x1 - run.x0) * 0.004]], 3)); run = null; };
        for (const iso of eachDay(addDays(sel.arr, 1), sel.dep)) {
          const r = rect(iso);
          if (!r) { flush(); continue; }
          const y = r.y + r.h - 3;
          if (run && Math.abs(run.y - y) < 3 && r.x > run.x1 - 2) run.x1 = r.x + r.w - 6;
          else { flush(); run = { x0: r.x + 6, x1: r.x + r.w - 6, y }; }
        }
        flush();
        const d = rect(sel.dep);
        if (d) paths.push(handLoop(d.x, d.y, d.w, d.h, seed + 7, base.width, o.grow));
      }
      const color = css(host, o.color, o.fallback), lens = paths.map(lengthOf), total = lens.reduce((s, l) => s + l, 0);
      let left = total * p;
      paths.forEach((pts, i) => {
        if (left <= 1) return;
        const part = left >= lens[i] ? pts : prefix(pts, left);
        left -= lens[i];
        if (part.length > 1) ink(g, part, { width: o.width, color, jitter: o.jitter, freq: 0.05, pressure: 0.35, taper: 8, seed: i * 1.7 + 3 });
      });
    });

    // the season ribbon: the year ahead, above the calendar (only with prices)
    const ribbon = host.prices ? ribbonLayer(host, cal, () => band) : null;

    function inkIn() {
      cancelAnimationFrame(anim);
      if (ctx.motion === 'still') { p = 1; inkLayer.redraw(); return; }
      const t0 = performance.now(), dur = sel.dep ? o.ms : o.ms * 0.6;
      const step = now => {
        const u = clamp((now - t0) / dur);
        p = o.overshoot ? Math.min(1, ease.outBack(u) * 1.02) : ease.outCubic(u);
        inkLayer.redraw();
        if (u < 1) anim = requestAnimationFrame(step);
      };
      p = 0; anim = requestAnimationFrame(step);
    }

    const fonts = document.fonts?.load?.(`13px ${css(host, '--sg-font-hand', 'cursive')}`).then(() => ribbon?.redraw()).catch(() => {});
    void fonts;

    return {
      update(s) {
        const key = `${s.arr}|${s.dep}|${s.view}`;
        const changed = s.arr !== sel.arr || s.dep !== sel.dep;
        sel = { arr: s.arr, dep: s.dep };
        if (changed) inkIn(); else if (key !== lastKey) inkLayer.redraw();
        lastKey = key;
        const b = s.hover ? bandFor(s.hover, host.rates)?.id ?? null : null;
        if (ribbon && (b !== band || s.rates !== rates)) { band = b; ribbon.redraw(); }
        rates = s.rates;
      },
      restyle() { inkLayer.redraw(); ribbon?.redraw(); },
      destroy() { cancelAnimationFrame(anim); inkLayer.destroy(); ribbon?.destroy(); },
    };
  };
}

function ribbonLayer(host, cal, activeBand) {
  const stage = document.createElement('div');
  stage.className = 'sg-dr-ribbon';
  cal.root.prepend(stage);
  const layer = overlay(stage, 'sg-dr-ribbon-art', (g, w) => {
    // read at every draw, so a new rate card (host.rates = …) redraws the ribbon
    const today = host.today, win = host.rates.window, { start, end, days, runs } = seasonRuns(today, host.rates);
    const inkC = css(host, '--sg-ink', '#2E2419'), soft = css(host, '--sg-ink-soft', '#6A5F4E'), faint = css(host, '--sg-ink-faint', '#93897A');
    const pool = css(host, '--sg-pool', '#1F7488'), poolB = css(host, '--sg-pool-bright', '#6FB9C7'), tile = css(host, '--sg-tile', '#8F4C20');
    const teakB = css(host, '--sg-teak-bright', '#B5925F'), deep = css(host, '--sg-paper-deep', '#EAE4D6'), teak = css(host, '--sg-teak', '#7E5F32');
    const hand = css(host, '--sg-font-hand', 'cursive'), body = css(host, '--sg-font-body', 'sans-serif'), raised = css(host, '--sg-paper-raised', '#FBF9F4');
    const L = 8, R = w - 8, top = 22, bot = 56, X = d => L + (R - L) * (diffDays(start, d) / days), active = activeBand();
    // at phone width most bands are too narrow to name, so every name moves to a key under the months
    const wide = w > 520, kinds = [...new Set(runs.map(s => s.kind))], rows = wide ? 0 : Math.ceil(kinds.length / 2);
    const tall = rows ? `${bot + 30 + rows * 20}px` : '';
    if (stage.style.blockSize !== tall) stage.style.blockSize = tall;
    const paint = (shape, b, kind, on, i) => {
      if (kind === 'before' || kind === 'after') hatch(g, shape, { angle: 0.9, spacing: 6, width: 0.6, color: faint, alpha: 0.32, seed: i, seg: [3, 8], gap: 0.8, bounds: b });
      else if (kind === 'launch') {
        wash(g, shape, { color: poolB, alpha: on ? 0.34 : 0.22 });
        hatch(g, shape, { angle: 1.25, spacing: 5.5, width: 0.9, color: pool, alpha: on ? 0.85 : 0.6, seed: i + 11, seg: [3, 7], gap: 1.6, bounds: b });
      } else if (kind === 'peak') {
        wash(g, shape, { color: tile, alpha: on ? 0.22 : 0.14 });
        hatch(g, shape, { angle: -0.8, spacing: 3, width: 0.8, color: tile, alpha: 0.9, seed: i + 5, bounds: b });
        hatch(g, shape, { angle: 0.8, spacing: 3.4, width: 0.7, color: tile, alpha: 0.7, seed: i + 6, bounds: b });
      } else {
        wash(g, shape, { color: deep, alpha: 0.9 });
        hatch(g, shape, { angle: kind === 'late' ? 0.75 : -0.75, spacing: 7, width: 0.8, color: teakB, alpha: on ? 0.9 : 0.6, seed: i + 7, bounds: b });
      }
    };
    const edge = (shape, x0, y0, x1, y1, open, on, seed) => {
      if (open) ink(g, shape, { width: on ? 1.6 : 1, color: on ? inkC : soft, jitter: 0.35, closed: true, seed, pressure: 0.2 });
      else { g.setLineDash([2, 3]); g.strokeStyle = faint; g.lineWidth = 0.8; g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1); g.setLineDash([]); }
    };
    runs.forEach((s, i) => {
      const x0 = X(s.from), x1 = X(addDays(s.to, 1)), on = active && s.kind === active, dim = active && !on;
      const shape = roughen([[x0 + 1, top], [x1 - 1, top], [x1 - 1, bot], [x0 + 1, bot]], { amp: 0.8, freq: 0.08, seed: i + 3, step: 3 });
      const b = { x: x0, y: top, w: x1 - x0, h: bot - top }, open = s.kind !== 'before' && s.kind !== 'after';
      g.save();
      g.globalAlpha = dim ? 0.45 : 1;
      paint(shape, b, s.kind, on, i);
      edge(shape, x0 + 1, top, x1 - 1, bot, open, on, i * 3.3);
      const name = NAMES[s.kind] ?? s.kind;
      g.font = `400 13px ${hand}`;
      const tw = g.measureText(name).width;
      if (wide && tw + 14 < x1 - x0) {
        const tx = (x0 + x1) / 2, ty = (top + bot) / 2;
        g.fillStyle = raised; g.fillRect(tx - tw / 2 - 5, ty - 9, tw + 10, 18);
        g.fillStyle = s.kind === 'peak' ? tile : open ? inkC : soft;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, tx, ty + 1);
      }
      g.restore();
    });
    // the key: a swatch of each band and its name, two to a row
    kinds.slice(0, rows * 2).forEach((kind, k) => {
      const col = k % 2, row = Math.floor(k / 2), cw = (R - L) / 2;
      const x0 = L + col * cw, y0 = bot + 30 + row * 20, x1 = x0 + 26, y1 = y0 + 13, open = kind !== 'before' && kind !== 'after';
      const shape = roughen([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { amp: 0.5, freq: 0.1, seed: k + 21, step: 3 });
      const on = active && kind === active;
      g.save();
      g.globalAlpha = active && !on ? 0.45 : 1;
      paint(shape, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, kind, on, k + 40);
      edge(shape, x0, y0, x1, y1, open, on, k * 5.1);
      g.font = `400 13px ${hand}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = kind === 'peak' ? tile : open ? inkC : soft;
      g.fillText(NAMES[kind] ?? kind, x1 + 8, (y0 + y1) / 2 + 1);
      g.restore();
    });
    // months along the bottom, the opening flag and today
    g.fillStyle = soft; g.strokeStyle = faint; g.lineWidth = 1;
    g.font = `400 12px ${body}`; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let m = 0; m <= 13; m++) {
      const first = `${addMonths(ym(today), m)}-01`, x = X(first);
      g.beginPath(); g.moveTo(x, bot + 2); g.lineTo(x, bot + 7); g.stroke();
      if (m < 13) { const mi = +first.slice(5, 7) - 1; g.fillText(wide ? MONTHS[mi] : MONTHS[mi][0], X(addDays(first, 14)), bot + 10); }
    }
    if (win.openFrom >= start && win.openFrom <= end) {
      const x = X(win.openFrom);
      ink(g, [[x, bot], [x, 5]], { width: 1.2, color: teak, jitter: 0.3, taper: 4, seed: x });
      g.fillStyle = teak; g.beginPath(); g.moveTo(x, 5); g.lineTo(x + 9, 8.5); g.lineTo(x, 12); g.closePath(); g.fill();
      g.font = `400 13px ${hand}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('open', x + 13, 9);
    }
    const x = X(today);
    g.fillStyle = inkC; g.beginPath(); g.moveTo(x, bot + 1); g.lineTo(x - 4, bot + 8); g.lineTo(x + 4, bot + 8); g.closePath(); g.fill();
  });
  return { redraw: layer.redraw, destroy() { layer.destroy(); stage.remove(); } };
}
