// Warm: the sign-off written on the paper in the hand, with a pencil rule
// under it, drawn twice and fitted to the words' width (site-footer.css tints
// and places the stroke; this skin fits it and draws it). It refits when the
// line changes size and at no other time. Still.
import { rulePath } from '../site-footer.core.js';

const NS = 'http://www.w3.org/2000/svg';

/** How wide the words are, not the block they sit in: the widest line of the
    sign-off's text, so the rule ends where the writing ends. */
export function wordsWidth(sign, rule) {
  const range = sign.ownerDocument.createRange();
  range.selectNodeContents(sign);
  if (rule?.parentNode === sign) range.setEndBefore(rule);
  const lines = [...range.getClientRects()].filter(r => r.width > 0);
  if (!lines.length) return 0;
  return Math.max(...lines.map(r => r.right)) - Math.min(...lines.map(r => r.left));
}

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-site-footer-rule');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
  svg.append(...paths);
  const sign = host.native?.querySelector('.sg-site-footer-sign') ?? null;
  let seed = 'footer', raf = 0;

  function draw() {
    raf = 0;
    if (!sign || !sign.isConnected) return;
    const w = Math.round(wordsWidth(sign, svg));
    if (!w) return;
    svg.setAttribute('viewBox', `0 0 ${w} 8`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', '8');
    rulePath(w, seed).forEach((d, i) => paths[i].setAttribute('d', d));
    if (svg.parentNode !== sign) sign.append(svg);
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  if (sign) ro.observe(sign);
  return {
    update(s) { seed = s.seed; schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
