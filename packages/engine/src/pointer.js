// pointer.js: pointer position in logical units. Canvas edge.

/**
 * Pointer position in the stage's logical units, plus down/inside flags.
 * `last` is the performance.now() of the latest move. `on(type, fn)` adds a
 * canvas listener that destroy() also removes.
 * @param {import('./stage.js').Stage} st
 */
export function pointer(st) {
  const p = { x: st.W / 2, y: st.H / 2, inside: false, down: false, last: 0 };
  const handlers = [];
  const on = (type, fn) => { st.canvas.addEventListener(type, fn); handlers.push([type, fn]); };
  const update = e => { const [x, y] = st.toLogical(e.clientX, e.clientY); p.x = x; p.y = y; p.last = performance.now(); };
  on('pointermove', e => { update(e); p.inside = true; });
  on('pointerdown', e => { update(e); p.down = true; p.inside = true; });
  on('pointerup', () => { p.down = false; });
  on('pointerleave', () => { p.inside = false; p.down = false; });
  p.on = on;
  p.destroy = () => handlers.forEach(([t, f]) => st.canvas.removeEventListener(t, f));
  return p;
}
