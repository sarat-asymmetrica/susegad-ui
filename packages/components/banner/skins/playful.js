// Banner, playful skin: bunting strung along the bottom of the strip, the paper flags of a Goan feast.
// A string sags between two points and small pennants hang from it in the palette's colours, spaced and
// tilted from the banner's id. When the banner arrives the flags drop in one after another and settle with
// a little swing; under reduced motion they are simply hung. On dismissal the strip folds away (200 ms).

const SVG = 'http://www.w3.org/2000/svg';
// the flags' colours are palette tokens, so a different palette recolours the bunting
export const COLOURS = ['--sg-mango', '--sg-laterite', '--sg-paddy', '--sg-sea', '--sg-kokum', '--sg-indigo'];

const rng = seed => {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5);
};

/**
 * The bunting for a strip `width` wide, in a box 24 units tall: the string's path data (a gentle sag
 * between two ends) and each flag as { d, colour, delay }. A flag hangs from the string at x with its
 * point down. Flags are about 16 wide and 5 apart; a seed jitters their spacing and length so no two
 * banners are hung alike. Pure.
 */
export function bunting(width, seed = 1) {
  const r = rng(seed), w = Math.max(60, Math.round(width));
  const sag = 7, y0 = 3;
  const yAt = x => y0 + 4 * sag * (x / w) * (1 - x / w);        // a parabola: the string's height at x
  const string = `M0 ${y0} Q${w / 2} ${y0 + 2 * sag} ${w} ${y0}`;
  const flags = [];
  const pitch = 22;
  let x = 10 + (r() + 0.5) * 8, i = 0;
  while (x + 16 < w - 6) {
    const y = yAt(x), len = 9.5 + (r() + 0.5) * 4;
    flags.push({
      d: `M${x.toFixed(1)} ${y.toFixed(2)} L${(x + 16).toFixed(1)} ${yAt(x + 16).toFixed(2)} L${(x + 8 + r() * 1.5).toFixed(1)} ${(y + len).toFixed(2)} Z`,
      colour: COLOURS[i % COLOURS.length],
      delay: i * 28,
    });
    x += pitch + (r() + 0.5) * 3;
    i++;
  }
  return { string, flags };
}

export function mount(el, ctx) {
  let svg = null, seed = null, first = true, width = 0;
  const draw = () => {
    const box = el.deco;
    if (!box) return;
    width = Math.round(el.getBoundingClientRect().width) || 600;
    const { string, flags } = bunting(width, seed);
    svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-banner-bunting');
    svg.setAttribute('viewBox', `0 0 ${width} 24`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const line = document.createElementNS(SVG, 'path');
    line.setAttribute('class', 'string');
    line.setAttribute('d', string);
    svg.append(line);
    for (const f of flags) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('class', 'flag');
      p.setAttribute('d', f.d);
      p.style.fill = `var(${f.colour}, var(--sg-accent))`;
      p.dataset.delay = f.delay;
      svg.append(p);
    }
    box.replaceChildren(svg);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (seed != null && Math.abs(Math.round(el.getBoundingClientRect().width) - width) > 24) draw(); }) : null;
  ro?.observe(el);
  return {
    update(s) {
      if (s.seed !== seed || !svg) { seed = s.seed; draw(); }
      if (s.phase === 'shown' && first && ctx.motion !== 'still' && ctx.visible) {
        svg.querySelectorAll('.flag').forEach(p => {
          // each flag drops from the string, overshoots with a swing, and hangs
          p.animate([
            { opacity: 0, transform: 'scaleY(0.2) rotate(-8deg)' },
            { opacity: 1, transform: 'scaleY(1.08) rotate(5deg)', offset: 0.6 },
            { opacity: 1, transform: 'scaleY(1) rotate(0)' },
          ], { duration: 420, delay: Number(p.dataset.delay), easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' });
        });
      }
      first = false;
    },
    leave() {
      if (ctx.motion === 'still') return Promise.resolve();
      const h = el.getBoundingClientRect().height;
      return el.animate([{ blockSize: `${h}px`, opacity: 1 }, { blockSize: '0px', paddingBlock: '0px', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    },
    destroy() { ro?.disconnect(); el.deco?.replaceChildren(); },
  };
}
