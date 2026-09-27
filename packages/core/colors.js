// Resolve CSS colours (tokens, var() fallbacks, light-dark(), oklch) to hex
// for canvas code. A probe inherits from `el`, so tokens set on any ancestor
// and the page's color-scheme both apply.

let px = null;
/** @param {Element} el @param {Record<string, string>} map name → CSS colour @returns {Record<string, string>} name → '#rrggbb' */
export function readColors(el, map) {
  px ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const probe = document.createElement('i');
  probe.style.display = 'none';
  el.appendChild(probe);
  const out = {};
  for (const [name, css] of Object.entries(map)) {
    probe.style.color = '';
    probe.style.color = css;
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = '#000';
    px.fillStyle = getComputedStyle(probe).color;
    px.fillRect(0, 0, 1, 1);
    const [r, g, b] = px.getImageData(0, 0, 1, 1).data;
    out[name] = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  probe.remove();
  return out;
}
