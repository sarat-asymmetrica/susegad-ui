// Warm: a margin note in the hand, with a pencil bracket beside the words,
// fitted to their height and drawn twice. Painted once per size; still.
import { bracket } from '../quote.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  const quote = host.querySelector('blockquote') ?? host;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-quote-bracket');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  const paths = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
  svg.append(...paths);
  quote.prepend(svg);
  let seed = '', key = '', raf = 0;
  const wobble = () => parseFloat(getComputedStyle(host).getPropertyValue('--sg-wobble')) || 0.6;
  function draw() {
    raf = 0;
    const h = Math.round(quote.getBoundingClientRect().height);
    const k = `${seed}|${h}`;
    if (!h || k === key) return;
    key = k;
    svg.setAttribute('viewBox', `0 0 12 ${h}`);
    bracket(h, seed, wobble()).forEach((d, i) => paths[i].setAttribute('d', d));
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(schedule);
  ro.observe(quote);
  return {
    update(s) { if (s.seed !== seed) { seed = s.seed; key = ''; } schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
