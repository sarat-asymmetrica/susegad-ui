// Banner, warm skin: a sheet of paper with a pencil rule ruled under it. The rule is seeded from the
// banner's id, so each banner's line is drawn a little differently and always the same way. It is drawn
// in one stroke when the banner arrives; under reduced motion it is simply there. The strip folds away
// (height and fade, 200 ms) when dismissed.

const SVG = 'http://www.w3.org/2000/svg';

const rng = seed => {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5);
};

/**
 * Two pencil strokes along the bottom of a strip `width` wide, in a box 6 units tall: a long rule that
 * wanders a little, and a shorter one under it that starts and stops short. A seed wobbles them so no two
 * banners are ruled alike. Pure; returns SVG path data.
 */
export function rulePaths(width, seed = 1) {
  const r = rng(seed), w = Math.max(40, Math.round(width));
  const step = 48, n = Math.max(2, Math.round(w / step));
  const line = (x0, x1, y, amp) => {
    const pts = Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + r() * amp]);
    return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(2)} ` + pts.slice(1).map(([x, yy], i) => {
      const [px, py] = pts[i];
      return `Q${((px + x) / 2).toFixed(1)} ${(((py + yy) / 2) + r() * amp * 0.8).toFixed(2)} ${x.toFixed(1)} ${yy.toFixed(2)}`;
    }).join(' ');
  };
  return [line(2, w - 2, 2, 1.6), line(w * (0.08 + r() * 0.04), w * (0.72 + r() * 0.1), 4.4, 1.2)];
}

export function mount(el, ctx) {
  let svg = null, seed = null, was = null, width = 0;
  const draw = () => {
    const box = el.deco;
    if (!box) return;
    width = Math.round(el.getBoundingClientRect().width) || 600;
    svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-banner-rule');
    svg.setAttribute('viewBox', `0 0 ${width} 6`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of rulePaths(width, seed)) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    box.replaceChildren(svg);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (seed != null && Math.abs(Math.round(el.getBoundingClientRect().width) - width) > 24) draw(); }) : null;
  ro?.observe(el);
  return {
    update(s) {
      if (s.seed !== seed || !svg) { seed = s.seed; draw(); }
      if (s.phase === 'shown' && was === null && ctx.motion !== 'still' && ctx.visible) {
        svg.querySelectorAll('path').forEach((p, i) => {
          const len = p.getTotalLength?.() || 300;
          p.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
            { duration: 420, delay: i * 160, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'backwards' });
        });
      }
      was = s.phase;
    },
    leave() {
      if (ctx.motion === 'still') return Promise.resolve();
      const h = el.getBoundingClientRect().height;
      return el.animate([{ blockSize: `${h}px`, opacity: 1 }, { blockSize: '0px', paddingBlock: '0px', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    },
    destroy() { ro?.disconnect(); el.deco?.replaceChildren(); },
  };
}
