// Playful: a big hand-drawn quotation mark above the words. The first time
// the quote is on screen the two blots ink in, one after the other. Under
// reduced motion the mark is simply there; with no JavaScript it isn't drawn.
import { quoteMark, inkIn } from '../quote.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-quote-mark');
  svg.setAttribute('viewBox', '0 0 64 52');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const blots = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
  svg.append(...blots);
  (host.native ?? host).prepend(svg);
  let seed = null, inked = false;
  const anims = [];
  return {
    update(s) {
      if (s.seed !== seed) { seed = s.seed; quoteMark(seed).forEach((d, i) => blots[i].setAttribute('d', d)); }
      if (inked || !s.visible) return;
      inked = true;
      blots.forEach((b, i) => {
        const a = inkIn(ctx.motion, i);
        if (!a) return;
        const anim = b.animate(a.frames, a.timing);
        anims.push(anim);
        anim.finished.then(x => x.cancel(), () => {});
      });
    },
    destroy() { anims.forEach(a => a.cancel()); svg.remove(); },
  };
}
