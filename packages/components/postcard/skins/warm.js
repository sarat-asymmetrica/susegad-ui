// Warm: the back of a picture postcard. postcard.css gives it card stock, a
// deckled edge, a divider and ruled address lines; this skin adds the ruled
// lines and, in the corner, a printed postage square with no word on it.
// With status-style="stamp" the builder's rubber stamp takes that corner and
// gets a postmark: two rings lettered with the place and year, and wavy
// cancellation lines running under the stamp. Drawn once; still.
import { postmark } from '../postcard.core.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function mount(host) {
  const doc = host.ownerDocument;
  const card = host.native ?? host;
  const hidden = (el, cls) => { el.setAttribute('class', cls); el.setAttribute('aria-hidden', 'true'); return el; };
  const address = hidden(doc.createElement('div'), 'sg-postcard-address');
  const postage = hidden(doc.createElement('div'), 'sg-postcard-postage');
  const svg = hidden(doc.createElementNS(NS, 'svg'), 'sg-postcard-postmark');
  svg.setAttribute('viewBox', '0 0 150 64');
  svg.setAttribute('focusable', 'false');
  card.append(address, postage);
  const id = `sg-postmark-${++uid}`;
  let key = null, raf = 0;
  const stamp = () => card.querySelector(':scope > sg-stamp');
  // Sit the ring on the stamp's lower-left corner; the lines run on under it.
  const place = () => {
    raf = 0;
    const st = stamp();
    if (!st || !svg.isConnected) return;
    svg.style.left = `${st.offsetLeft - 26}px`;
    svg.style.top = `${st.offsetTop + st.offsetHeight - 26}px`;
  };
  const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(place); });
  ro.observe(host);

  function draw(s) {
    const m = postmark(s.seed);
    svg.style.setProperty('--sg-postmark-rotate', `${m.rotate}deg`);
    const el = (tag, attrs) => { const e = doc.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); return e; };
    const kids = [el('circle', { cx: m.cx, cy: m.cy, r: m.r }), el('circle', { cx: m.cx, cy: m.cy, r: m.r - 9, 'stroke-width': '0.8' }), ...m.waves.map(d => el('path', { d }))];
    if (s.postmark) {
      const arc = el('path', { id, d: `M${m.cx - m.r + 4.5} ${m.cy}a${m.r - 4.5} ${m.r - 4.5} 0 1 1 ${2 * (m.r - 4.5)} 0`, fill: 'none', stroke: 'none' });
      const text = el('text', {});
      const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' });
      tp.textContent = s.postmark.toUpperCase();
      text.append(tp);
      kids.push(arc, text);
    }
    svg.replaceChildren(...kids);
  }

  return {
    update(s) {
      // The postmark cancels a stamp: no stamp, no postmark.
      const want = s.stampStyle && !!stamp();
      if (want && !svg.isConnected) card.append(svg);
      if (!want) { svg.remove(); key = null; return; }
      if (!raf) raf = requestAnimationFrame(place);
      const k = `${s.seed}|${s.postmark}`;
      if (k !== key) { key = k; draw(s); }
    },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); address.remove(); postage.remove(); },
  };
}
