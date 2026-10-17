// Ticket, warm skin: a paper ticket ruled in pencil. Four strokes box it in, each crossing the next a little at
// the corner, and a dashed pencil line is where it would tear, between the facts and the QR stub. A seed (from
// the element's id) wobbles every stroke, so no two tickets are drawn alike. The strokes are drawn once, when the
// card is first shown; under reduced motion they are simply there.

const SVG = 'http://www.w3.org/2000/svg';
const rng = seed => { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5); };

/**
 * The four sides of a pencil box `w` by `h`, as SVG path data: top, right, bottom, left, each a gentle curve that
 * starts a few units outside its corner and ends a few outside the next, so the corners cross. Pure.
 */
export function framePaths(w, h, seed = 1) {
  const r = rng(seed), j = k => r() * k, over = 3 + j(2);
  const side = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, bow = j(2.8);
    const c = t => [x0 + dx * t + nx * (bow + j(0.6)), y0 + dy * t + ny * (bow + j(0.6))];
    const [p, q] = [c(0.33), c(0.7)];
    return `M${(x0 + j(1)).toFixed(1)} ${(y0 + j(1)).toFixed(1)} C${p[0].toFixed(1)} ${p[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)} ${(x1 + j(1)).toFixed(1)} ${(y1 + j(1)).toFixed(1)}`;
  };
  return [side(-over, 1, w + over, 0.5 + j(1)), side(w - 0.5, -over, w, h + over), side(w + over, h - 1, -over, h - 0.5 + j(1)), side(0.5, h + over, 0, -over)];
}

/** The tear line: a slightly wandering line across the card at `at` (from the left when `vertical`, else from the top). Pure. */
export function tearPath(w, h, at, vertical, seed = 1) {
  const r = rng(seed + 7), wob = () => (r() * 2).toFixed(1);
  return vertical ? `M${at} 10 Q${+at + +wob()} ${h / 2} ${at} ${h - 10}` : `M10 ${at} Q${w / 2} ${+at + +wob()} ${w - 10} ${at}`;
}

/** Where an element's top-left corner is inside the card, from layout (offsets), so a card that is mid-settle still measures true. */
function within(card, el) {
  let x = 0, y = 0;
  for (let n = el; n && n !== card; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}

export function mount(el, ctx) {
  let svg = null, seed = null, size = '', drawn = false;
  const box = () => el.deco;
  const geometry = () => {
    const card = el.querySelector('.sg-ticket-card'), stub = el.querySelector('.sg-ticket-stub'), facts = el.querySelector('.sg-ticket-facts');
    if (!card || !stub || !facts) return null;
    const s = within(card, stub), f = within(card, facts), vertical = s.x > f.x + 4;
    return { w: Math.round(card.offsetWidth), h: Math.round(card.offsetHeight), vertical, at: vertical ? s.x - 1 : s.y - 1 };
  };
  const draw = () => {
    const g = geometry(), b = box();
    if (!g || !b || !g.w || !g.h) return;
    size = `${g.w}x${g.h}x${g.at}`;
    svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-ticket-pencil');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('focusable', 'false');
    for (const d of framePaths(g.w, g.h, seed)) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); svg.append(p); }
    const tear = document.createElementNS(SVG, 'path');
    tear.setAttribute('class', 'tear');
    tear.setAttribute('d', tearPath(g.w, g.h, g.at, g.vertical, seed));
    svg.append(tear);
    b.replaceChildren(svg);
    drawn = false;
  };
  const stale = () => { const g = geometry(); return !g || `${g.w}x${g.h}x${g.at}` !== size; };
  const play = () => {
    if (drawn || !svg || !ctx.visible) return;
    drawn = true;
    if (ctx.motion === 'still') return;
    svg.querySelectorAll('path:not(.tear)').forEach((p, i) => {
      const len = p.getTotalLength?.() || 300;
      p.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }], { duration: 360, delay: i * 120, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'backwards' });
    });
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (seed != null && el.ticket && stale()) { const was = drawn; draw(); drawn = was; } }) : null;
  ro?.observe(el);
  return {
    update(s) {
      if (!s.has) { box()?.replaceChildren(); svg = null; return; }
      if (s.seed !== seed || !svg || stale()) { seed = s.seed; draw(); }
      play();
    },
    destroy() { ro?.disconnect(); box()?.replaceChildren(); },
  };
}
