// The caret beside the input, shared by the skins: hidden from assistive tech
// (the arrow keys open the list), a click target for a pointer. `d` is a path
// with its width, or a list of [d, width] strokes.

const NS = 'http://www.w3.org/2000/svg';

export function caret(host, d, width) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ class: 'sg-combobox__caret', viewBox: '0 0 16 10', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  for (const [pd, w] of Array.isArray(d) ? d : [[d, width]]) {
    const p = document.createElementNS(NS, 'path');
    for (const [k, v] of Object.entries({ d: pd, fill: 'none', stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) p.setAttribute(k, v);
    svg.append(p);
  }
  const click = e => { e.preventDefault(); host.toggle?.(); };
  svg.addEventListener('pointerdown', e => e.preventDefault());
  svg.addEventListener('click', click);
  host.native?.after(svg);
  const anchor = host.native?.style.getPropertyValue('anchor-name');
  if (anchor) svg.style.setProperty('position-anchor', anchor); // sit on the input, wherever hints and notes put it
  return svg;
}
