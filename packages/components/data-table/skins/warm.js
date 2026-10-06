// Warm: a hand-ruled table. The CSS lays the hairlines; this skin draws the one
// rule that a hand would draw, the strong rule under the header row, as an SVG
// path with a small seeded wobble, so up close it reads as drawn and at a
// distance reads as a line. It redraws when the table changes size and at no
// other time. Still.
import { rng } from '../../../engine/src/rng.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument, table = host.native ?? host;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-table-ink');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  let seed = 'table';

  function layout() {
    watch();
    const wrap = table.parentElement;
    if (!table.clientWidth || !wrap) { svg.remove(); return; }
    const head = table.tHead, row = head?.rows[0];
    if (!row) { svg.remove(); return; }
    const y = head.offsetTop + head.offsetHeight - 1, w = table.scrollWidth;
    svg.setAttribute('viewBox', `0 0 ${w} 8`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = `left:0;top:${y - 3}px;width:${w}px;height:8px`;
    const r = rng(`table-rule:${seed}`), pts = [];
    const n = Math.max(8, Math.round(w / 90));
    for (let i = 0; i <= n; i++) pts.push([+(w * i / n).toFixed(1), +(2 + r.range(-0.9, 0.9)).toFixed(2)]);
    svg.replaceChildren(doc.createElementNS(NS, 'path'));
    svg.firstChild.setAttribute('d', `M ${pts.map(p => p.join(' ')).join(' L ')}`);
    svg.firstChild.setAttribute('stroke-width', '1.1');
    if (svg.parentNode !== wrap) wrap.append(svg);
  }

  const ro = new ResizeObserver(layout);
  let watched = null;
  const watch = () => { if (table !== watched) { watched = table; ro.observe(table); } };
  return {
    update(s) {
      host.dataset.motion = ctx.motion;
      if (s?.seed && s.seed !== seed) { seed = s.seed; layout(); }
      layout();
    },
    destroy() { ro.disconnect(); svg.remove(); host.removeAttribute('data-motion'); },
  };
}
