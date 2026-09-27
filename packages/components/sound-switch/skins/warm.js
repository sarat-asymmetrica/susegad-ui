// Warm: a small drawn speaker beside the track. Off, it sits plain with a
// line struck through; on, the line lifts and two arcs of sound fade in. The
// fade is a CSS transition on the register's own duration, so reduced motion
// makes it instant with no extra code.

import { SPEAKER } from '../sound-switch.core.js';

export const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (doc, name, attrs = {}) => {
  const n = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** The aria-hidden drawing, straight after the input; `data-on` carries the state for the CSS. */
export function art(host, viewBox) {
  const svg = svgEl(host.ownerDocument, 'svg', { class: 'sg-sound-switch-art', viewBox, 'aria-hidden': 'true', focusable: 'false' });
  host.native.after(svg);
  return svg;
}

export function mount(host) {
  const doc = host.ownerDocument;
  const svg = art(host, '0 0 28 24');
  const arcs = svgEl(doc, 'g', { class: 'sg-sound-switch-arcs' });
  for (const [i, d] of SPEAKER.arcs.entries()) arcs.append(svgEl(doc, 'path', { class: `sg-sound-switch-arc sg-sound-switch-arc-${i}`, d }));
  svg.append(
    svgEl(doc, 'path', { class: 'sg-sound-switch-body', d: SPEAKER.body }),
    arcs,
    svgEl(doc, 'path', { class: 'sg-sound-switch-slash', d: SPEAKER.slash }),
  );

  return {
    update(s) { svg.toggleAttribute('data-on', s.on); },
    destroy() { svg.remove(); },
  };
}
