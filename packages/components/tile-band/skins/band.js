// Tile band: the canvas manager the three skins share. It sizes a canvas to the band's box, fits whole
// square tiles into it, paints them once and keeps them, and paints again only when something that
// changes the picture changes (the length, the wanted tile size, the pixel ratio, the register's look,
// the colours, the seed, the tones, the direction). There is no frame loop. The one thing that ever
// asks for frames is a tile being turned (playful only): a rAF runs for the half second of the turn
// and stops, and an idle band records zero frames.
import { readColors } from '../../../core/colors.js';
import { fitTiles, layBand, tileAt, turned, turnAngle, lift, TURN_MS, TURN_COOLDOWN_MS } from '../tile-band.core.js';
import { drawTile } from './paint.js';

const GLAZE = { ground: 'var(--sg-glaze, #FBF8EE)', blue: 'var(--sg-cobalt, #1B4A9B)', ink: 'var(--sg-cobalt, #1B4A9B)', wash: 'var(--sg-wash, #C4D3EF)', lemon: 'var(--sg-lemon, #F2C94C)', leaf: 'var(--sg-leaf, #4F8A3A)' };
// a hairline has to be seen on the page, so it follows the theme; a glazed tile keeps its own colours
const LINE = { ink: 'light-dark(var(--sg-cobalt, #1B4A9B), var(--sg-cobalt-bright, #8FB2F2))' };

/**
 * @param {HTMLElement} host
 * @param {object} ctx the component context (motion, visible)
 * @param {{ look: 'line'|'glaze', turns: boolean }} how
 */
export function mountBand(host, ctx, { look, turns }) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.className = 'sg-tile-band-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const g = canvas.getContext('2d');
  let key = '', s = null, state = {}, raf = 0, last = -1;
  const turning = new Map(), restedAt = new Map();

  /** The tile size the page asked for, in CSS pixels: --sg-tile-size may be rem, em, vw or a calc. */
  function wanted() {
    const probe = doc.createElement('i');
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${win.getComputedStyle(host).getPropertyValue('--sg-tile-size').trim() || '4rem'}`;
    host.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w || 64;
  }

  function paint(force = false) {
    const vertical = state.vertical, length = vertical ? host.clientHeight : host.clientWidth, want = wanted(), dpr = win.devicePixelRatio || 1;
    const { count, size } = fitTiles(length, want);
    const k = [length, want, dpr, look, state.tones, state.seed, vertical].join('|');
    if (!count || (k === key && !force)) return;
    key = k;
    finish();
    host.style.setProperty('--sg-tile-fit', `${size}px`); // the tiles stay square: the band's thickness is the tile
    const S = Math.round(size * dpr), along = Math.round(length * dpr);
    canvas.width = vertical ? S : along; canvas.height = vertical ? along : S;
    const colors = readColors(host, look === 'glaze' ? GLAZE : { ...GLAZE, ...LINE });
    const tiles = layBand(state.seed, count);
    const cell = i => { const a = Math.round(i * size * dpr), b = Math.round((i + 1) * size * dpr); return { x: vertical ? 0 : a, y: vertical ? a : 0, size: Math.max(1, Math.min(b - a, S)) }; };
    s = { tiles, count, size, vertical, dpr, colors, cell };
    tiles.forEach((t, i) => drawTile(g, t, { ...cell(i), look, colors, tones: state.tones, vertical, dpr }));
    host.dataset.painted = String(count);
  }

  // ── turning a tile (playful) ────────────────────────────────────────────
  function frame(now) {
    raf = 0;
    for (const [i, a] of turning) {
      const p = (now - a.t0) / TURN_MS, c = s.cell(i);
      g.clearRect(c.x, c.y, c.size, c.size);
      if (p >= 1) { s.tiles[i] = turned(a.from); turning.delete(i); restedAt.set(i, now); drawTile(g, s.tiles[i], { ...c, look, colors: s.colors, tones: state.tones, vertical: s.vertical, dpr: s.dpr }); }
      else drawTile(g, a.from, { ...c, look, colors: s.colors, tones: state.tones, vertical: s.vertical, dpr: s.dpr, angle: turnAngle(p) * (a.span / 90), lift: lift(p) });
    }
    if (turning.size) raf = win.requestAnimationFrame(frame);
  }
  function turn(i) {
    const now = win.performance.now();
    if (!s || i < 0 || turning.has(i) || now - (restedAt.get(i) ?? -1e9) < TURN_COOLDOWN_MS) return;
    turning.set(i, { t0: now, from: s.tiles[i], span: s.tiles[i].motif === 'vine' ? 180 : 90 });
    if (!raf) raf = win.requestAnimationFrame(frame);
  }
  /** Settle every tile at once: the turn is over, nothing is left half done. */
  function finish() {
    win.cancelAnimationFrame(raf); raf = 0;
    for (const [i, a] of turning) { s.tiles[i] = turned(a.from); const c = s.cell(i); g.clearRect(c.x, c.y, c.size, c.size); drawTile(g, s.tiles[i], { ...c, look, colors: s.colors, tones: state.tones, vertical: s.vertical, dpr: s.dpr }); }
    turning.clear();
  }
  const at = ev => { const r = canvas.getBoundingClientRect(); return tileAt(ev.clientX - r.left, ev.clientY - r.top, s?.size ?? 0, s?.count ?? 0, s?.vertical); };
  const onMove = ev => { if (ev.pointerType === 'touch') return; const i = at(ev); if (i !== last) { last = i; turn(i); } };
  const onDown = ev => turn(at(ev));
  const onLeave = () => { last = -1; };
  const listen = on => {
    const f = on ? 'addEventListener' : 'removeEventListener';
    canvas[f]('pointermove', onMove); canvas[f]('pointerdown', onDown); canvas[f]('pointerleave', onLeave);
  };
  let listening = false;

  const ro = new ResizeObserver(() => paint());
  ro.observe(host);
  const dprQuery = win.matchMedia?.(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
  const onDpr = () => paint();
  dprQuery?.addEventListener?.('change', onDpr);

  return {
    update(next) {
      state = next;
      host.dataset.motion = ctx.motion;
      const want = turns && ctx.motion !== 'still';
      if (want !== listening) { listening = want; listen(want); }
      if (!next.visible) finish();
      paint();
    },
    restyle() { paint(true); },
    destroy() {
      win.cancelAnimationFrame(raf); ro.disconnect(); dprQuery?.removeEventListener?.('change', onDpr);
      if (listening) listen(false);
      canvas.remove();
      host.style.removeProperty('--sg-tile-fit');
      delete host.dataset.painted; delete host.dataset.motion;
    },
  };
}
