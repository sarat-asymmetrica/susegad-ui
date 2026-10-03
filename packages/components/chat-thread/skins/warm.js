// Warm: speech on paper. Each message sits in a hand-inked bubble, drawn twice
// like a nib going round and fitted to the message's measured size, with a
// small tail on the first message of a run. Painted once per size; nothing
// moves.

import { bubbleOutline } from '../chat-thread.core.js';

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const doc = host.ownerDocument;
  const inks = new Map(); // li -> { svg, paths, key }
  const dirty = new Set();
  let raf = 0;
  const wobble = () => parseFloat(getComputedStyle(host).getPropertyValue('--sg-wobble')) || 0.6;

  function draw() {
    raf = 0;
    const wob = wobble() * 1.6;
    for (const li of dirty) {
      const ink = inks.get(li);
      if (!ink || !li.isConnected) continue;
      const b = li.getBoundingClientRect();
      const w = +b.width.toFixed(2), h = +b.height.toFixed(2);
      const tail = li.dataset.run !== 'continue';
      const side = li.dataset.from === 'me' ? 'right' : 'left';
      const seed = li.textContent.trim().slice(0, 48);
      const key = `${seed}|${w}|${h}|${tail}|${side}`;
      if (!w || !h || key === ink.key) continue;
      ink.key = key;
      ink.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const { d } = bubbleOutline(w, h, seed, { side, tail, radius: Math.min(14, h / 2.4), wobble: wob });
      ink.paths.forEach((p, i) => p.setAttribute('d', d[i]));
    }
    dirty.clear();
  }
  const schedule = li => { dirty.add(li); if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(list => list.forEach(e => schedule(e.target)));

  function sync() {
    for (const li of host.messages) {
      if (inks.has(li)) { schedule(li); continue; }
      const svg = doc.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'sg-chat-ink');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('preserveAspectRatio', 'none');
      const paths = [doc.createElementNS(NS, 'path'), doc.createElementNS(NS, 'path')];
      svg.append(...paths);
      li.prepend(svg);
      inks.set(li, { svg, paths, key: '' });
      ro.observe(li);
      schedule(li);
    }
    for (const [li, ink] of inks) if (!li.isConnected) { ro.unobserve(li); ink.svg.remove(); inks.delete(li); }
  }

  return {
    update() { sync(); },
    restyle() { for (const [li, ink] of inks) { ink.key = ''; schedule(li); } },
    destroy() {
      ro.disconnect(); cancelAnimationFrame(raf);
      for (const ink of inks.values()) ink.svg.remove();
      inks.clear();
    },
  };
}
