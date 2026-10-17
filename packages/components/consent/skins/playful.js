// Consent, playful skin: the notice as a ticket. A rounded outline with a round bite out of each side
// where the tear-off line meets it, and a row of perforation dots along that line, just above the
// box a person ticks. When the notice first comes into view it is stamped down: a small, quick settle
// on a spring. Under reduced motion it is simply there.

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The ticket's outline in a box `w` by `h`: corners of radius `r`, and a bite of radius `n` out of the left and
 * right edges at height `y`. Returns { edge, perf, bites }: the outline as path data, the perforation line
 * between the bites, and the two bite centres (to cover with the page's surface). Pure.
 */
export function ticketPath(w, h, y, { r = 10, n = 7 } = {}) {
  const yy = Math.min(Math.max(y, r + n + 2), h - r - n - 2);
  const edge = `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${yy - n} A${n} ${n} 0 0 0 ${w} ${yy + n} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${yy + n} A${n} ${n} 0 0 0 0 ${yy - n} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
  return { edge, perf: `M${n + 6} ${yy} H${w - n - 6}`, bites: [[0, yy, n], [w, yy, n]], y: yy };
}

export function mount(el, ctx) {
  let box = null, size = '', stamped = false;
  const draw = () => {
    box ??= el.querySelector(':scope > .sg-consent-deco') ?? el.insertBefore(Object.assign(document.createElement('div'), { className: 'sg-consent-deco' }), el.firstChild);
    box.setAttribute('aria-hidden', 'true');
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    size = `${w}x${h}`;
    const tick = el.querySelector('.sg-consent-tick');
    const y = tick ? tick.offsetTop - 8 : h * 0.75;
    const { edge, perf, bites } = ticketPath(w, h, y);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-consent-ticket');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('focusable', 'false');
    for (const [cx, cy, r] of bites) {
      // the bite shows the page through the ticket: a circle of the page's own surface
      const c = document.createElementNS(SVG, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r + 0.6);
      c.style.fill = 'var(--sg-surface)';
      svg.append(c);
    }
    for (const [cls, d] of [['edge', edge], ['perf', perf]]) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('class', cls);
      p.setAttribute('d', d);
      svg.append(p);
    }
    box.replaceChildren(svg);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (`${Math.round(el.offsetWidth)}x${Math.round(el.offsetHeight)}` !== size) draw(); }) : null;
  ro?.observe(el);
  return {
    update() {
      draw();
      if (!stamped && ctx.visible && ctx.motion !== 'still') {
        stamped = true;
        el.animate([{ scale: 1.025, opacity: 0.2 }, { scale: 0.99, opacity: 1, offset: 0.55 }, { scale: 1, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' });
      }
      if (ctx.motion === 'still') stamped = true;
    },
    destroy() { ro?.disconnect(); box?.replaceChildren(); },
  };
}
