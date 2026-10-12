// Doodle: the SVG builder the three skins share. It draws the motif (or a band of them) as inline SVG, one
// <path> per stroke, with pathLength 1 so one dash pattern makes a reveal at any size. Everything is set
// through attributes and the element's CSS properties: no <style> element and no style attribute in what it
// builds, so a strict Content-Security-Policy (style-src 'self') is fine with it.
//
// Warm and playful: the strokes draw themselves once, when the doodle first scrolls into view (Web Animations
// on stroke-dashoffset), then boil: every ~0.2 s the paths take the next frame of a slight wobble, from one
// shared timer that runs only while some doodle is on screen. Playful adds a wiggle on touch. Quiet is still,
// and so is everything under reduced motion: the finished drawing at once.
import {
  VIEW, MOTIFS, motif, boilFrames, BOIL_ORDER, BOIL_MS, revealPlan, HIDDEN, DASH, wiggleFrames, WIGGLE_MS,
  fitCells, layBand, cellTransform,
} from '../doodle.core.js';

const NS = 'http://www.w3.org/2000/svg';

// ── one timer for every boiling doodle ───────────────────────────────────

const boilers = new Set();
let timer = 0, beat = 0;
function run() {
  if (timer || !boilers.size || document.hidden) return;
  timer = setTimeout(function step() {
    timer = 0;
    if (!boilers.size || document.hidden) return;
    beat = (beat + 1) % BOIL_ORDER.length;
    for (const apply of boilers) apply(BOIL_ORDER[beat]);
    timer = setTimeout(step, BOIL_MS);
  }, BOIL_MS);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { clearTimeout(timer); timer = 0; run(); });

const frameCache = new Map();
const framesOf = d => { let f = frameCache.get(d); if (!f) frameCache.set(d, f = boilFrames(d)); return f; };

const signature = s => [s.band, s.band ? s.seed : s.motif, s.band ? s.only.join() : ''].join('|');

const el = (doc, tag, attrs = {}) => {
  const n = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

/**
 * @param {HTMLElement} host
 * @param {object} ctx the component context (motion, visible, emit)
 * @param {{ look: 'quiet'|'warm'|'playful' }} how
 */
export function mountDoodle(host, ctx, { look }) {
  const doc = host.ownerDocument, win = doc.defaultView;
  let svg = null, lines = [], cells = [], sig = '', state = {};
  let anims = [], wiggles = new Set(), boiling = null, drawing = false, ro = null, listening = false;
  // our own view of whether the doodle is on screen: unknown until the observer has spoken once, so a doodle
  // below the fold never draws just because a skin loaded quickly
  let seen = typeof IntersectionObserver === 'undefined' ? true : null;
  const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(list => { seen = list[list.length - 1].isIntersecting; sync(); });
  io?.observe(host);

  const animates = () => look !== 'quiet' && ctx.motion !== 'still';
  const drawn = () => host.dataset.drawn === 'true';

  /** The cell size the page asked for, in CSS pixels: --sg-doodle-size may be rem, em, vw or a calc. */
  function wanted() {
    const probe = doc.createElement('i');
    probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.pointerEvents = 'none';
    probe.style.width = win.getComputedStyle(host).getPropertyValue('--sg-doodle-size').trim() || '4rem';
    host.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w || 64;
  }

  function stop() {
    for (const a of anims) a.cancel();
    anims = [];
    drawing = false;
  }

  function setHidden(hidden) {
    for (const { path } of lines) {
      if (hidden) { path.setAttribute('stroke-dasharray', DASH); path.setAttribute('stroke-dashoffset', String(HIDDEN)); }
      else { path.removeAttribute('stroke-dasharray'); path.removeAttribute('stroke-dashoffset'); }
    }
  }

  function build() {
    stop();
    boiling = null; boilers.delete(apply);
    svg?.remove();
    lines = []; cells = [];
    const band = state.band;
    let list, count = 1;
    if (band) {
      const fit = fitCells(host.clientWidth, wanted());
      if (!fit.count) { svg = null; return; }
      count = fit.count;
      host.style.setProperty('--sg-doodle-count', String(count));
      list = layBand(state.seed, count, state.only);
    } else {
      host.style.removeProperty('--sg-doodle-count');
      list = [{ motif: state.motif ?? MOTIFS[0] }];
    }
    svg = el(doc, 'svg', { viewBox: `0 0 ${count * VIEW} ${VIEW}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
    svg.classList.add('sg-doodle-svg');
    list.forEach((cell, i) => {
      const outer = band ? el(doc, 'g', { transform: cellTransform(cell, i) }) : svg;
      const g = el(doc, 'g', { 'data-cell': i, 'data-motif': cell.motif ?? MOTIFS[0] });
      g.classList.add('sg-doodle-cell');
      g.append(el(doc, 'rect', { x: 0, y: 0, width: VIEW, height: VIEW, fill: 'none', 'pointer-events': 'all' }));
      const plan = revealPlan(motif(cell.motif), look === 'playful' ? 'playful' : 'warm', band ? i : 0);
      motif(cell.motif).forEach((d, s) => {
        const path = el(doc, 'path', { d, pathLength: 1, fill: 'none', stroke: 'currentColor', 'stroke-width': look === 'quiet' ? 1.1 : look === 'playful' ? 3.1 : 2.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        path.classList.add('sg-doodle-line');
        g.append(path);
        lines.push({ path, d, frames: null, plan: plan[s] });
      });
      cells.push(g);
      outer.append(g);
      if (band) svg.append(outer);
    });
    if (!band) svg.append(...cells);
    host.append(svg);
    host.dataset.motif = band ? 'band' : (state.motif ?? '');
    host.dataset.cells = String(count);
    sig = signature(state);
    setHidden(animates() && !drawn());
  }

  // ── drawing itself, once ─────────────────────────────────────────────

  function reveal() {
    if (drawing || drawn() || !lines.length) return;
    drawing = true;
    host.dataset.state = 'drawing';
    const finished = [];
    for (const { path, plan } of lines) {
      const a = path.animate(
        [{ strokeDashoffset: HIDDEN }, { strokeDashoffset: 0 }],
        { delay: plan.delay, duration: plan.duration, easing: 'cubic-bezier(.35,.05,.25,1)', fill: 'both' },
      );
      anims.push(a);
      finished.push(a.finished.catch(() => 'cancelled'));
    }
    Promise.all(finished).then(r => {
      if (r.includes('cancelled') || !drawing) return;
      finish(true);
      boil(animates() && !!seen);
    });
  }

  /** The line is whole: drop the dash, cancel the animations, and say so once. */
  function finish(announce) {
    stop();
    setHidden(false);
    const already = drawn();
    host.dataset.drawn = 'true';
    host.dataset.state = 'drawn';
    if (announce && !already) ctx.emit('sg-doodle-drawn', { cells: cells.length });
  }

  // ── the boil ──────────────────────────────────────────────────────────

  function apply(frame) {
    for (const l of lines) l.path.setAttribute('d', (l.frames ??= framesOf(l.d))[frame]);
  }
  function boil(on) {
    if (on === !!boiling) return;
    if (on) { boiling = true; boilers.add(apply); run(); }
    else { boiling = null; boilers.delete(apply); for (const l of lines) l.path.setAttribute('d', l.d); }
  }

  // ── a wiggle when touched (playful) ───────────────────────────────────

  function wiggle(cell) {
    if (!cell || wiggles.has(cell)) return;
    wiggles.add(cell);
    const a = cell.animate(wiggleFrames(+cell.dataset.cell), { duration: WIGGLE_MS, easing: 'ease-in-out' });
    const done = () => { wiggles.delete(cell); a.cancel(); };
    a.finished.then(done, () => wiggles.delete(cell));
  }
  const cellOf = ev => ev.target?.closest?.('.sg-doodle-cell');
  const onOver = ev => { if (ev.pointerType !== 'touch') wiggle(cellOf(ev)); };
  const onDown = ev => wiggle(cellOf(ev));
  function listen(on) {
    if (on === listening) return;
    listening = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    host[f]('pointerover', onOver); host[f]('pointerdown', onDown);
  }

  function sync() {
    host.dataset.motion = ctx.motion;
    if (!svg) return;
    if (!animates()) {
      boil(false);
      finish(false);
      listen(false);
      return;
    }
    if (!drawn() && seen) reveal();
    boil(drawn() && !drawing && !!seen);
    listen(look === 'playful' && ctx.motion === 'full');
  }

  /** A resize that changes the cell count rebuilds the band, finished: nothing draws twice. */
  function rebuild() {
    if (!state.band || !host.clientWidth) return;
    if (svg && fitCells(host.clientWidth, wanted()).count === cells.length) return;
    if (drawing) finish(false);
    build();
    sync();
  }

  return {
    update(next) {
      state = next;
      if (!svg || signature(next) !== sig) {
        if (drawing) finish(false);
        build();
      }
      if (next.band && !ro) { ro = new ResizeObserver(rebuild); ro.observe(host); }
      else if (!next.band && ro) { ro.disconnect(); ro = null; }
      sync();
    },
    restyle() { sync(); },
    destroy() {
      stop();
      boil(false);
      listen(false);
      io?.disconnect();
      ro?.disconnect();
      svg?.remove();
      host.style.removeProperty('--sg-doodle-count');
      delete host.dataset.motion; delete host.dataset.cells; delete host.dataset.motif; delete host.dataset.state;
    },
  };
}
