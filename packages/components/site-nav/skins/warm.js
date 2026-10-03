// Warm: the links written on the paper in the hand, and a pencil line under
// the current page, drawn twice and fitted to the link's width. Still.
import { pencilLine } from '../site-nav.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-site-nav-pencil');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
  svg.append(...paths);
  let link = null, key = '', raf = 0;
  const wobble = () => parseFloat(getComputedStyle(host).getPropertyValue('--sg-wobble')) || 0.6;
  function draw() {
    raf = 0;
    if (!link) return;
    const w = Math.round(link.getBoundingClientRect().width);
    const k = `${link.textContent}|${w}`;
    if (!w || k === key) return;
    key = k;
    svg.setAttribute('viewBox', `0 0 ${w} 8`);
    pencilLine(w, link.textContent.trim(), wobble()).forEach((d, i) => paths[i].setAttribute('d', d));
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  return {
    update() {
      const now = host.links.find(a => a.hasAttribute('aria-current')) ?? null;
      if (now !== link) {
        if (link) ro.unobserve(link);
        link = now;
        key = '';
        if (link) { link.append(svg); ro.observe(link); } else svg.remove();
      }
      schedule();
    },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
