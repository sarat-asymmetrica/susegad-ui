// Playful: a cutting-chai glass that fills with tea as the value rises, steam
// curling off the top. The tea level is the value and moves only when it moves
// (with a small slosh). Without a value, a thin stream pours into an empty
// glass: something is happening, and nothing claims how much.

const NS = 'http://www.w3.org/2000/svg';

/** Pure: the glass in an 80 x 100 box. `levelY(f)` is the tea surface for fraction f. */
export const GLASS = { cx: 40, top: 22, bottom: 94, rt: 25, rb: 19 };
export const halfWidth = y => GLASS.rt + (GLASS.rb - GLASS.rt) * ((y - GLASS.top) / (GLASS.bottom - GLASS.top));
// An empty glass is empty: at 0 the tea (and its foam) sits below the glass, out of sight.
export const levelY = f => (f <= 0 ? GLASS.bottom + 4 : GLASS.bottom - 4 - f * (GLASS.bottom - 4 - (GLASS.top + 7)));

/**
 * Pure: the keyframes of a slosh from fraction `from` to `to`, as [y, offset]
 * pairs. The level eases to the value, dips a little below it and settles.
 * A larger y is lower tea, so no frame ever shows more than `to`.
 */
export function sloshFrames(from, to) {
  const target = levelY(to), dip = Math.min(2.2, Math.abs(levelY(from) - target) * 0.25);
  return [[levelY(from), 0], [target, 0.62], [target + dip, 0.8], [target + dip * 0.3, 0.92], [target, 1]];
}

/** Pure: a steam wisp, a gentle S rising from the rim, as an SVG path. */
export function wisp(i) {
  const x0 = GLASS.cx - 9 + i * 9, pts = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16, y = GLASS.top - 3 - t * 34;
    pts.push(`${(x0 + Math.sin(t * 5.2 + i * 1.7) * (2 + t * 5)).toFixed(2)} ${y.toFixed(2)}`);
  }
  return 'M' + pts.join('L');
}

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function mount(host, ctx) {
  const { cx, top, bottom, rt, rb } = GLASS;
  const svg = el('svg', { class: 'sg-progress__art', viewBox: '0 -16 80 118', 'aria-hidden': 'true', focusable: 'false' });
  const id = Math.random().toString(36).slice(2, 8);
  const inside = `M${cx - rt + 1.5} ${top}L${cx + rt - 1.5} ${top}L${cx + rb - 1.5} ${bottom - 3}Q${cx} ${bottom + 1} ${cx - rb + 1.5} ${bottom - 3}Z`;
  el('path', { d: inside }, el('clipPath', { id: `sg-chai-${id}` }, el('defs', {}, svg)));

  // tea: one tall body that slides up and down inside the glass, with its milky surface on top
  const tea = el('g', { 'clip-path': `url(#sg-chai-${id})` }, svg);
  const body = el('g', {}, tea);
  el('rect', { x: cx - rt, y: 0, width: rt * 2, height: 120, fill: 'var(--sg-chai, #c28550)' }, body);
  el('ellipse', { cx, cy: 0, rx: rt, ry: 2.6, fill: 'var(--sg-chai-foam, #ead0a4)' }, body);
  // glass tint and flutes
  el('path', { d: inside, fill: 'color-mix(in oklab, var(--sg-pool, #6fa3ad) 14%, transparent)' }, svg);
  for (let k = 1; k <= 6; k++) {
    const u = k / 7 - 0.5, y0 = bottom - 6, y1 = top + 24;
    el('path', { d: `M${cx + u * 2 * (halfWidth(y0) - 2)} ${y0}L${cx + u * 2 * (halfWidth(y1) - 2)} ${y1}`, stroke: 'var(--sg-ink, CanvasText)', 'stroke-opacity': '0.22', 'stroke-width': '0.9', fill: 'none' }, svg);
  }
  const ink = { fill: 'none', stroke: 'var(--sg-ink, CanvasText)', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  el('path', { d: `M${cx - rt} ${top}L${cx - rb} ${bottom - 3}Q${cx} ${bottom + 2.5} ${cx + rb} ${bottom - 3}L${cx + rt} ${top}`, ...ink }, svg);
  el('ellipse', { cx, cy: top, rx: rt, ry: 3.4, ...ink, 'stroke-width': '1.5' }, svg);
  el('path', { d: `M${cx - rt + 6} ${top + 8}L${cx - rb + 5} ${bottom - 12}`, stroke: '#fffaf0', 'stroke-opacity': '0.7', 'stroke-width': '2.2', 'stroke-linecap': 'round' }, svg);

  // steam and the pouring stream
  const steam = [0, 1, 2].map(i => el('path', { d: wisp(i), fill: 'none', stroke: 'var(--sg-ink-soft, GrayText)', 'stroke-width': '1.6', 'stroke-linecap': 'round', pathLength: '100', 'stroke-dasharray': '38 100', opacity: '0' }, svg));
  const pour = el('path', { d: `M${cx + 3} -14L${cx + 3} ${bottom - 6}`, stroke: 'var(--sg-chai, #c28550)', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-dasharray': '7 5', opacity: '0' }, svg);
  host.prepend(svg);

  let shown = null, loops = [];
  const moving = () => ctx.motion === 'ambient' || ctx.motion === 'full';
  const stop = () => { loops.forEach(a => a.cancel()); loops = []; };
  const setLevel = f => { body.style.transform = `translateY(${levelY(f)}px)`; };

  let mode = '';
  function alive(s) {
    const wantSteam = s.fraction === null || s.fraction > 0.04, wantPour = s.fraction === null;
    const next = `${wantSteam}|${wantPour}|${moving()}`;
    if (next === mode) { loops.forEach(a => (ctx.visible ? a.play() : a.pause())); return; }
    mode = next;
    stop();
    // At rest the steam is drawn whole and faint; moving, a window of it travels up each wisp.
    steam.forEach((p, i) => {
      p.setAttribute('opacity', wantSteam && !moving() ? String(0.42 - i * 0.08) : '0');
      p.setAttribute('stroke-dasharray', moving() ? '38 100' : 'none');
    });
    pour.setAttribute('opacity', wantPour ? '0.9' : '0');
    if (!moving()) return;
    if (wantSteam) loops.push(...steam.map((p, i) => p.animate(
      [{ strokeDashoffset: 38, opacity: 0 }, { opacity: 0.75, offset: 0.35 }, { strokeDashoffset: -100, opacity: 0 }],
      { duration: 3200, delay: i * 1050, iterations: Infinity, easing: 'ease-out' },
    )));
    if (wantPour) loops.push(pour.animate([{ strokeDashoffset: 12 }, { strokeDashoffset: 0 }], { duration: 260, iterations: Infinity }));
    loops.forEach(a => (ctx.visible ? a.play() : a.pause()));
  }

  return {
    update(s) {
      const f = s.fraction ?? 0;
      if (shown !== null && f !== shown && moving() && ctx.visible) {
        // the tea moves to the new value and sloshes a little, always below it: it never shows more than the value
        body.animate(sloshFrames(shown, f).map(([y, offset]) => ({ transform: `translateY(${y}px)`, offset })), { duration: 560, easing: 'ease-out' });
      }
      setLevel(f);
      shown = f;
      alive(s);
    },
    destroy() { stop(); svg.remove(); },
  };
}
