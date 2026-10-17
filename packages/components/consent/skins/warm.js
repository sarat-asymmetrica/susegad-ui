// Consent, warm skin: the notice boxed in pencil, as if ruled on paper. Four strokes, one a side, each
// crossing the next a little at the corner, and a seed (from the element's id) wobbles them so no two
// notices are drawn alike. They are drawn once, when the notice first comes into view; under reduced
// motion they are simply there. The heading is set in the hand (consent.css).

const SVG = 'http://www.w3.org/2000/svg';

const rng = seed => {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5);
};

/**
 * The four sides of a pencil box `w` by `h`, as SVG path data: top, right, bottom, left, each a gentle curve
 * that starts a few units outside its corner and ends a few outside the next, so the corners cross. A seed
 * wobbles every point. Pure.
 */
export function framePaths(w, h, seed = 1) {
  const r = rng(seed), j = k => r() * k;
  const over = 3 + j(2), a = 1.4;
  const side = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, nx = -dy, ny = dx, len = Math.hypot(dx, dy) || 1;
    const bow = j(a * 2);
    const c = t => [x0 + dx * t + (nx / len) * (bow + j(0.6)), y0 + dy * t + (ny / len) * (bow + j(0.6))];
    const [p, q] = [c(0.33), c(0.7)];
    return `M${(x0 + j(1)).toFixed(1)} ${(y0 + j(1)).toFixed(1)} C${p[0].toFixed(1)} ${p[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)} ${(x1 + j(1)).toFixed(1)} ${(y1 + j(1)).toFixed(1)}`;
  };
  return [
    side(-over, 1, w + over, 0.5 + j(1)),
    side(w - 0.5, -over, w, h + over),
    side(w + over, h - 1, -over, h - 0.5 + j(1)),
    side(0.5, h + over, 0, -over),
  ];
}

export function mount(el, ctx) {
  let svg = null, box = null, seed = null, drawn = false, size = '';
  const draw = () => {
    box ??= el.querySelector(':scope > .sg-consent-deco') ?? el.insertBefore(Object.assign(document.createElement('div'), { className: 'sg-consent-deco' }), el.firstChild);
    box.setAttribute('aria-hidden', 'true');
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    size = `${w}x${h}`;
    svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-consent-frame');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('focusable', 'false');
    for (const d of framePaths(w, h, seed)) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    box.replaceChildren(svg);
    drawn = false;
  };
  const play = () => {
    if (drawn || !svg || !ctx.visible || ctx.motion === 'still') { if (ctx.motion === 'still') drawn = true; return; }
    drawn = true;
    svg.querySelectorAll('path').forEach((p, i) => {
      const len = p.getTotalLength?.() || 300;
      p.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
        { duration: 360, delay: i * 130, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'backwards' });
    });
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { const was = drawn; if (seed != null && `${Math.round(el.offsetWidth)}x${Math.round(el.offsetHeight)}` !== size) { draw(); drawn = was; } }) : null;
  ro?.observe(el);
  return {
    update(s) {
      if (s.seed !== seed || !svg) { seed = s.seed; draw(); }
      play();
    },
    destroy() { ro?.disconnect(); box?.replaceChildren(); },
  };
}
