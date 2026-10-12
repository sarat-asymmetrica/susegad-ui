// The drawn bubble, shared by warm and playful. It draws the outline (an
// aria-hidden SVG inside the paragraph) and sets the words in one of three ways,
// always the page's own paragraph, always real text:
//
//   live   words laid into the zone line by line through the type tier's lazy
//          door (Pretext), one span per line inside the paragraph. Only at
//          warm or playful with motion, and only for plain-text paragraphs.
//   hug    the still, with no type tier: two floats whose shape-outside is the
//          zone, so CSS text hugs it. Reduced motion, and any paragraph that
//          holds markup (a link, an em) that spans would lose.
//   flow   the fallback when the words do not fit the zone at the legible
//          floor: a rounded box that grows with plain CSS text. Never clipped.
//
// `data-text` on the element says which one is on screen.

import { bubbleModel, hugShapes, linesHold, arrive } from '../bubble.core.js';
import { hashSeed } from '../../../engine/src/rng.js';

const NS = 'http://www.w3.org/2000/svg';
const SVG = (name, cls) => { const e = document.createElementNS(NS, name); if (cls) e.setAttribute('class', cls); return e; };
const MIN_PX = 14;

export function mountBody(host, ctx, look) {
  const fig = host.native, p = fig?.querySelector('p');
  if (!p) return { update() {}, restyle() {}, destroy() {} };

  // the drawing: shadow, body, trail, all aria-hidden inside the paragraph
  const svg = SVG('svg', 'sg-bubble-art'), shadow = SVG('path', 'sg-bubble-shadow'), body = SVG('path', 'sg-bubble-fill'), trail = SVG('g', 'sg-bubble-trail');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.append(...(look.shadow ? [shadow] : []), body, trail);
  p.prepend(svg);
  // one probe, as wide as the tail is long: a change of text size moves it, and it says how long the tail is in px
  const probe = Object.assign(document.createElement('span'), { className: 'sg-bubble-probe' });
  probe.setAttribute('aria-hidden', 'true');
  fig.append(probe);
  // a meter the width of some letters and spaces, inside the paragraph, so letter or word spacing and line height the page adds (WCAG 1.4.12), however it is added and whichever layout is on screen, move it and call for a fresh layout
  const meter = Object.assign(document.createElement('span'), { className: 'sg-bubble-meter' });
  meter.setAttribute('aria-hidden', 'true');
  p.append(meter);
  // arriving bubbles stay unseen until the layout is done and the arrival starts: no frame of the plain callout, no frame of the finished bubble before it fades in
  const reveal = () => { p.style.opacity = ''; host.removeAttribute('data-wait'); };
  if (ctx.motion === 'ambient' || ctx.motion === 'full') p.style.opacity = '0';

  let g2 = null, spacing = '', st = null, ops = null, loading = null, gen = 0, raf = 0, key = '', stash = [], mode = '', anim = null, arrived = false, tip = { x: 0, y: 0 }, laid = { fig: -1, probe: -1, meter: '' };
  const wingL = Object.assign(document.createElement('i'), { className: 'sg-bubble-wing' }), wingR = wingL.cloneNode();
  wingL.setAttribute('aria-hidden', 'true');
  wingR.setAttribute('aria-hidden', 'true');
  const own = n => n === svg || n === wingL || n === wingR || n === meter || n.dataset?.line !== undefined;

  /** The page's own words, as nodes: what the paragraph held before we put spans in it. */
  const words = () => (stash.length ? stash : [...p.childNodes].filter(n => !own(n)));
  const plainText = () => words().map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
  const hasMarkup = () => words().some(n => n.nodeType === 1);

  /** Back to the page's paragraph as it was: words in, spans and floats out, our sizes gone. */
  function restore() {
    if (stash.length) { p.replaceChildren(svg, meter, ...stash); stash = []; }
    p.querySelectorAll(':scope > [data-line]').forEach(s => s.remove());
    wingL.remove(); wingR.remove();
    for (const k of ['width', 'height', 'padding', 'paddingBlock', 'paddingInline', 'paddingBlockStart', 'fontSize', 'overflowWrap', 'textWrap']) p.style[k] = '';
  }

  function paint(model) {
    svg.setAttribute('viewBox', `0 0 ${model.w} ${model.h}`);
    body.setAttribute('d', model.outline);
    shadow.setAttribute('d', model.outline);
    trail.replaceChildren(...model.trail.map(c => { const e = SVG('circle'); e.setAttribute('cx', c.cx); e.setAttribute('cy', c.cy); e.setAttribute('r', c.r); return e; }));
    tip = model.tip;
  }

  const tilt = () => ((hashSeed(st.seed) % 2001) / 1000 - 1) * look.tilt;
  const spacingOf = cs => `${cs.letterSpacing}|${cs.wordSpacing}`;
  const fontOf = cs => ({ family: cs.fontFamily, weight: parseInt(cs.fontWeight, 10) || 400 });

  async function layout() {
    raf = 0;
    const my = ++gen, s = st;
    if (!s) return;
    mo.disconnect(); // our own edits are not the page's
    try {
      const text = plainText();
      if (!text) { restore(); mode = ''; host.removeAttribute('data-text'); reveal(); return; }
      // measure the room as the page gives it: the paragraph unconstrained, its tail margin already in the figure
      restore();
      p.style.rotate = '';
      const avail = p.offsetWidth;
      if (avail < 80) { reveal(); return; } // not laid out yet (hidden, or no width): the resize observer calls again
      const cs = getComputedStyle(p), maxPx = Math.max(MIN_PX, Math.round(parseFloat(cs.fontSize))), minPx = Math.min(maxPx, MIN_PX);
      const base = { kind: s.kind, tail: s.tail, seed: s.seed, wobble: look.wobble(s.kind), edge: look.edge(s.kind), tailLen: probe.getBoundingClientRect().width || 28, minPx, maxPx };
      const { family, weight } = fontOf(cs);
      let done = null;
      spacing = spacingOf(cs);
      try { await document.fonts?.load?.(`${weight} ${maxPx}px ${family}`); } catch { /* measure with what there is */ }
      if (my !== gen) return;
      // a hand that lays lines by arithmetic cannot know letter or word spacing the page adds (WCAG 1.4.12): the browser lays those
      if (ctx.motion === 'still' || hasMarkup() || spacing !== 'normal|0px') done = hug(base, avail, minPx, maxPx);
      else {
        try { ops ??= await (loading ??= import('./bubble.live.js')); } catch { ops = null; }
        if (my !== gen) return;
        const got = ops && ops.laidBubble({ ...base, w: avail, h: avail / 1.7 }, text, { family, weight, register: look.register });
        done = got ? live(got, optical(text, got, weight, family)) : null;
      }
      done ??= flow(base, avail);
      mode = done.mode;
      p.style.rotate = look.tilt ? `${tilt().toFixed(2)}deg` : '';
      host.dataset.text = done.mode;
      laid = { fig: fig.getBoundingClientRect().width, probe: probe.getBoundingClientRect().width, meter: meterSize() };
      ctx.emit('sg-bubble-laid', { mode: done.mode, px: done.px, w: done.w, h: done.h, lines: done.lines });
      arrival();
    } finally {
      if (my === gen) { mo.takeRecords(); mo.observe(p, { childList: true, characterData: true, subtree: true }); }
    }
  }

  /** live: the words as spans, laid by the type tier, in the paragraph's own box. */
  /**
   * How far to move laid lines down so the ink, not the line box, is centred: a hand face has more room above its letters than below
   * (or the reverse), and a short word shows it. Measured from the words themselves on a canvas, at the size laid; 0 where the engine can't say.
   */
  function optical(text, got, weight, family) {
    try {
      g2 ??= document.createElement('canvas').getContext('2d');
      g2.font = `${weight} ${got.px}px ${family}`;
      const m = g2.measureText(text), ink = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2, line = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      const d = ink - line;
      return Number.isFinite(d) ? Math.max(-0.25 * got.lineHeight, Math.min(0.25 * got.lineHeight, d)) : 0;
    } catch { return 0; }
  }

  function live(got, nudge = 0) {
    stash = words();
    p.replaceChildren(svg, meter);
    Object.assign(p.style, { width: `${got.w}px`, height: `${got.h}px` });
    paint(got.model);
    const spans = got.lines.map((l, i) => {
      const e = document.createElement('span');
      e.dataset.line = '';
      e.textContent = i < got.lines.length - 1 && !/\s$/.test(l.text) ? `${l.text} ` : l.text; // a space between lines, so the text reads and copies as written
      Object.assign(e.style, { left: `${l.x.toFixed(2)}px`, top: `${(l.y + nudge).toFixed(2)}px`, fontSize: `${got.px}px`, lineHeight: `${got.lineHeight}px` });
      return e;
    });
    p.append(...spans);
    spanRo.disconnect();
    spans.forEach(e => spanRo.observe(e)); // text spacing the page adds later widens a line: it comes back through here
    return { mode: 'laid', px: got.px, w: got.w, h: got.h, lines: got.lines.length };
  }

  /** Every line of text in the paragraph as a line box in the paragraph's own box: { x0, x1, y0, y1 } (the line box's height, not the glyphs' taller content area). */
  function lineBoxes() {
    const r = document.createRange(), box = p.getBoundingClientRect(), out = [];
    const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      if (!n.data.trim() || svg.contains(n)) continue;
      r.selectNodeContents(n);
      const lh = parseFloat(getComputedStyle(n.parentElement).lineHeight) || 20;
      for (const q of r.getClientRects()) { if (q.width < 1) continue; const mid = (q.top + q.bottom) / 2 - box.top; out.push({ x0: q.left - box.left, x1: q.right - box.left, y0: mid - lh / 2, y1: mid + lh / 2 }); }
    }
    return out;
  }
  const inkBox = () => { const l = lineBoxes(); return { top: Math.min(...l.map(b => b.y0)), bottom: Math.max(...l.map(b => b.y1)), lines: l.length, boxes: l }; };

  /** hug: size the paragraph, give the floats the zone's shape, and see where the CSS text lands. */
  function hug(base, avail, minPx, maxPx) {
    const apply = (w, h, px, dy) => {
      const model = bubbleModel({ ...base, w, h }), shape = hugShapes(model.zone, w, h, 96, 6 * px);
      p.style.fontSize = `${px}px`;
      p.style.textWrap = 'wrap'; // greedy: `pretty` may move the first word alone to the row above to keep a last line long
      p.style.overflowWrap = 'normal'; // a word wider than the gap drops to a row that holds it; it is never cut
      Object.assign(p.style, { width: `${w}px`, height: `${h}px`, paddingBlockStart: `${dy}px` });
      for (const [e, side] of [[wingL, shape.left], [wingR, shape.right]]) Object.assign(e.style, { width: `${w / 2}px`, height: `${h}px`, shapeOutside: side, marginBlockStart: `${-dy}px` });
      if (!wingL.isConnected) p.prepend(wingL, wingR);
      return { model, shape };
    };
    // a first row of one short word (CSS fills the first row that opens, a quarter of a line at a time) is not a bubble: the live layout would never set it
    const stubbed = (boxes, px) => {
      if (boxes.length < 2) return false; // one line is its own last row
      const top = Math.min(...boxes.map(b => b.y0));
      return Math.max(...boxes.filter(b => b.y0 < top + 2).map(b => b.x1 - b.x0)) < 2 * px;
    };
    const inside = (a, w, h, px = parseFloat(p.style.fontSize)) => { // every line inside the zone's rows: top and bottom of the ink, less the pad
      const ink = inkBox(), z = a.shape, pad = a.model.pad;
      // inside the zone's rows, and every line inside the zone's room at its row, whichever way this engine broke it
      return ink.lines > 0 && ink.top >= z.top + pad - 1 && ink.bottom <= z.bottom - pad + 1 && linesHold(a.model.zone, ink.boxes) && !stubbed(ink.boxes, px) ? ink : null;
    };
    const attempt = (w, h, px) => {
      let a = apply(w, h, px, 0), ink = inside(a, w, h);
      if (!ink) return null;
      let dy = 0; // centre down the room that is left; moving down a shape that widens re-wraps, so settle
      for (let k = 0; k < 4; k++) {
        const next = (dy + Math.max(0, a.shape.bottom - a.model.pad - ink.bottom)) / 2;
        if (Math.abs(next - dy) < 0.5) break;
        const moved = apply(w, h, px, next), inkM = inside(moved, w, h);
        if (!inkM) { apply(w, h, px, dy); break; }
        a = moved; ink = inkM; dy = next;
      }
      return { ...a, w, h, px, dy, lines: ink.lines };
    };
    const hMax = Math.max(avail / 1.7, avail * 0.9);
    for (let px = maxPx; px >= minPx; px -= 2) {
      let best = null;
      for (let h = avail / 1.7; h <= hMax * 1.0001 && !best; h *= 1.08) best = attempt(avail, Math.round(h), px);
      if (!best) continue;
      if (px === maxPx) for (let k = 0; k < 12 && best.w * 0.9 >= 120; k++) { // at the size asked for: shrink the bubble while that holds (never under 120 px wide)
        const smaller = attempt(Math.round(best.w * 0.9), Math.round(best.h * 0.9), px);
        if (!smaller) break;
        best = smaller;
      }
      // put the DOM back exactly as the winner had it (a failed try leaves its own sizes behind), and see that it still holds
      const a = apply(best.w, best.h, px, best.dy);
      if (!inside(a, best.w, best.h)) continue;
      paint(a.model);
      return { mode: 'hug', px, w: best.w, h: best.h, lines: best.lines };
    }
    return null;
  }

  /** flow: plain CSS text in a rounded bubble that grows with it. */
  function flow(base, avail) {
    restore();
    Object.assign(p.style, { paddingInline: '1.35em', paddingBlock: '1em', width: `${avail}px`, height: 'auto' });
    const w = p.offsetWidth, h = p.offsetHeight;
    paint(bubbleModel({ ...base, w, h, plain: true }));
    return { mode: 'flow', px: parseFloat(getComputedStyle(p).fontSize), w, h, lines: 0 };
  }

  const meterSize = () => { const r = meter.getBoundingClientRect(); return `${r.width.toFixed(1)}x${r.height.toFixed(1)}`; };

  function arrival() {
    if (arrived || !st.visible) return;
    const a = arrive(ctx.motion, look.register, tip);
    arrived = true;
    if (!a) { reveal(); return; }
    p.style.transformOrigin = a.origin;
    anim = p.animate(a.frames, a.timing); // fill backwards holds the first frame, so letting go of the inline opacity shows no flash
    reveal();
    anim.finished.then(x => x.cancel(), () => {});
  }

  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => layout()); };
  const again = () => { key = ''; schedule(); };
  // the width the figure has and the length of a tail are what a layout answers to; its own height is not
  const ro = new ResizeObserver(() => {
    if (Math.abs(fig.getBoundingClientRect().width - laid.fig) > 0.5 || Math.abs(probe.getBoundingClientRect().width - laid.probe) > 0.5 || meterSize() !== laid.meter) again();
  });
  ro.observe(fig);
  ro.observe(probe);
  ro.observe(meter);
  const spanRo = new ResizeObserver(() => { if (spacingOf(getComputedStyle(p)) !== spacing) again(); });
  const mo = new MutationObserver(() => { stash = []; again(); }); // the page changed its words
  const fontsDone = () => again();
  document.fonts?.addEventListener?.('loadingdone', fontsDone);

  return {
    update(s) {
      const k = `${s.kind}|${s.tail}|${s.seed}|${ctx.motion}|${ctx.register}`;
      st = s;
      if (k !== key) { key = k; schedule(); } else if (mode) arrival();
    },
    restyle() {},
    destroy() {
      cancelAnimationFrame(raf); gen++;
      ro.disconnect(); spanRo.disconnect(); mo.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', fontsDone);
      anim?.cancel();
      restore();
      p.style.rotate = p.style.transformOrigin = '';
      host.removeAttribute('data-text');
      reveal();
      svg.remove(); probe.remove(); meter.remove();
    },
  };
}
