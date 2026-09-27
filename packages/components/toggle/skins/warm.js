// Warm: a brass tower bolt, the latch on a Goan door. Off, the bolt is drawn
// back with its handle up; on, it slides into the keeper and the handle turns
// down. The slide is a CSS transition on the register's own duration and
// spring, so reduced motion makes it instant with no extra code.

import { LATCH } from '../toggle.core.js';

export const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (doc, name, attrs = {}) => {
  const n = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** The aria-hidden drawing, straight after the input; `data-on` carries the state for the CSS. */
export function art(host, viewBox) {
  const svg = svgEl(host.ownerDocument, 'svg', { class: 'sg-toggle-art', viewBox, 'aria-hidden': 'true', focusable: 'false' });
  host.native.after(svg);
  return svg;
}

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = art(host, '0 0 44 24');
  const { plate, screws, keeper, shaft, handle, knob } = LATCH;
  svg.append(svgEl(doc, 'rect', { class: 'sg-toggle-plate', x: plate.x, y: plate.y, width: plate.w, height: plate.h, rx: plate.r }));
  for (const s of screws) svg.append(svgEl(doc, 'circle', { class: 'sg-toggle-screw', cx: s.cx, cy: s.cy, r: 1.3 }));
  const bolt = svgEl(doc, 'g', { class: 'sg-toggle-bolt' });
  bolt.append(
    svgEl(doc, 'rect', { class: 'sg-toggle-shaft', x: shaft.x, y: shaft.y, width: shaft.w, height: shaft.h, rx: shaft.r }),
    svgEl(doc, 'path', { class: 'sg-toggle-handle sg-toggle-when-off', d: handle.off }),
    svgEl(doc, 'circle', { class: 'sg-toggle-knob sg-toggle-when-off', cx: knob.off.cx, cy: knob.off.cy, r: 1.9 }),
    svgEl(doc, 'path', { class: 'sg-toggle-handle sg-toggle-when-on', d: handle.on }),
    svgEl(doc, 'circle', { class: 'sg-toggle-knob sg-toggle-when-on', cx: knob.on.cx, cy: knob.on.cy, r: 1.9 }),
  );
  // The keeper is drawn after the bolt, so the bolt slides in under it.
  svg.append(bolt, svgEl(doc, 'path', { class: 'sg-toggle-keeper', d: keeper }));

  return {
    update(s) { svg.toggleAttribute('data-on', s.on); },
    destroy() { svg.remove(); },
  };
}
