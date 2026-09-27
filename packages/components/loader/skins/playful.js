// Playful: a bambaram, the wooden spinning top, turning on its nail. Its
// lacquer bands slide under the outline to show the spin, and it leans in a
// slow circle about its tip. With motion off it stands upright and still.

const NS = 'http://www.w3.org/2000/svg';

/** Pure: the top's outline in a 60 x 60 box, and the colours of its lacquer bands. */
export const BODY = 'M9 25C9 11 51 11 51 25C51 34 39 41 30 47C21 41 9 34 9 25Z';
export const BANDS = ['var(--sg-mango, #e4b24c)', 'var(--sg-kokum, #7c1648)', 'var(--sg-paddy, #5b8b3b)', 'var(--sg-kokum, #7c1648)'];

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function mount(host, ctx) {
  const id = Math.random().toString(36).slice(2, 8);
  const svg = el('svg', { class: 'sg-loader__art', viewBox: '0 0 60 60', 'aria-hidden': 'true', focusable: 'false' });
  el('path', { d: BODY }, el('clipPath', { id: `sg-top-${id}` }, el('defs', {}, svg)));
  const shadow = el('ellipse', { cx: 30, cy: 56, rx: 10, ry: 2.2, fill: 'var(--sg-ink, CanvasText)', opacity: '0.16' }, svg);
  const top = el('g', {}, svg);
  top.style.transformOrigin = '30px 55px';
  top.style.transformBox = 'view-box';

  // the lacquer: vertical bands twice as wide as the body, sliding sideways to read as spin
  const lacquer = el('g', {}, el('g', { 'clip-path': `url(#sg-top-${id})` }, top));
  el('rect', { x: 0, y: 8, width: 60, height: 40, fill: 'var(--sg-laterite, #b3563a)' }, lacquer);
  for (let i = 0; i < 12; i++) el('rect', { x: -48 + i * 8, y: 8, width: 4, height: 40, fill: BANDS[i % BANDS.length] }, lacquer);
  // the string groove and a highlight, which do not turn
  const ink = { fill: 'none', stroke: 'var(--sg-ink, CanvasText)', 'stroke-linecap': 'round' };
  el('path', { d: 'M11 29Q30 36 49 29', ...ink, 'stroke-width': '1.1', 'stroke-opacity': '0.55' }, top);
  el('path', { d: 'M15 18Q22 14 30 14', stroke: '#fffaf0', 'stroke-opacity': '0.65', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round' }, top);
  el('path', { d: BODY, ...ink, 'stroke-width': '1.8', 'stroke-linejoin': 'round' }, top);
  el('rect', { x: 26.5, y: 7, width: 7, height: 6, rx: 1.5, fill: 'var(--sg-teak, #7e5f32)', ...ink, 'stroke-width': '1.4' }, top);
  el('path', { d: 'M30 47L30 55', stroke: 'var(--sg-ink-soft, GrayText)', 'stroke-width': '2', 'stroke-linecap': 'round' }, top);
  host.prepend(svg);

  let anims = [];
  function start() {
    if (anims.length || ctx.motion === 'still') return;
    anims = [
      lacquer.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(32px)' }], { duration: 420, iterations: Infinity }),
      top.animate([{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }], { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }),
      shadow.animate([{ transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' }], { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }),
    ];
  }
  return {
    update() { start(); anims.forEach(a => (ctx.visible ? a.play() : a.pause())); },
    destroy() { anims.forEach(a => a.cancel()); svg.remove(); },
  };
}
