// Warm: a ticket. event-card.css cuts the notches and tints the stub; this skin
// finds where the tear line falls (a vertical line when the stub is a column,
// a horizontal one when it is a strip), tells the CSS, and draws the holes of
// the perforation along it, each a touch different, as a wheel would punch
// them. It redraws when the card changes size and at no other time. Still.
import { perforation, lean } from '../event.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host, ctx) {
  const doc = host.ownerDocument, card = host.native ?? host;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-event-perf');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  let seed = 'event';

  function layout() {
    watch();
    const stub = card.querySelector('.sg-event-stub');
    if (!stub || !card.clientWidth) { svg.remove(); host.removeAttribute('data-tear'); return; }
    const column = getComputedStyle(stub).position === 'absolute';
    const length = column ? card.clientHeight : card.clientWidth, at = column ? stub.offsetLeft : stub.offsetTop;
    host.dataset.tear = column ? 'x' : 'y';
    host.style.setProperty('--sg-event-tear', `${at}px`);
    const holes = perforation(length, seed);
    svg.replaceChildren(...holes.map(h => {
      const c = doc.createElementNS(NS, 'circle');
      c.setAttribute(column ? 'cx' : 'cy', '2');
      c.setAttribute(column ? 'cy' : 'cx', String(h.at));
      c.setAttribute('r', String(h.r));
      return c;
    }));
    svg.setAttribute('viewBox', column ? `0 0 4 ${length}` : `0 0 ${length} 4`);
    svg.style.cssText = column ? `left:${at - 2}px;top:0;width:4px;height:${length}px` : `left:0;top:${at - 2}px;width:${length}px;height:4px`;
    if (svg.parentNode !== card) card.append(svg);
  }

  // the card changing size and the stub changing shape (a layout flip) both move the tear line
  const ro = new ResizeObserver(layout);
  let watched = null;
  const watch = () => { const stub = card.querySelector('.sg-event-stub'); if (stub && stub !== watched) { watched = stub; ro.observe(stub); } };
  ro.observe(card);
  return {
    update(s) {
      host.dataset.motion = ctx.motion;
      if (s.seed !== seed) { seed = s.seed; host.style.setProperty('--sg-event-lean', `${lean(seed)}deg`); }
      layout();
    },
    destroy() {
      ro.disconnect(); svg.remove();
      host.removeAttribute('data-tear'); host.removeAttribute('data-motion');
      host.style.removeProperty('--sg-event-tear'); host.style.removeProperty('--sg-event-lean');
    },
  };
}
