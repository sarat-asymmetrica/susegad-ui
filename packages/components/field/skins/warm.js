// Field, warm skin: the field rests on a pencil rule, drawn by hand and a
// little past both ends, with a laterite margin down a textarea like an
// exercise book. When the field has focus the rule inks from left to right.
// Away from focus, the ink stays under the words as far as they run: for a
// line of text, measured with the control's own font; for a textarea, line
// by line, with a hidden mirror of it. Nothing moves on its own.

import { inkPath, lineRuns, pencilRule, inkIn, GRAIN } from '../field.core.js';

const SVG = 'http://www.w3.org/2000/svg';
let ctx2d = null, grains = 0;

/** Where the words sit, as [{ x, y, w }] in the control's own box. */
export function measure(el, mirror) {
  const c = el.control;
  const cs = getComputedStyle(c);
  const px = v => parseFloat(v) || 0;
  const left = px(cs.paddingLeft) + px(cs.borderLeftWidth);
  const room = c.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
  if (!c.value) return [];
  if (!el.multiline) {
    if (c.type === 'password') return [{ x: left, y: c.offsetHeight - px(cs.borderBottomWidth) - 2.5, w: room }];
    ctx2d ??= document.createElement('canvas').getContext('2d');
    ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = ctx2d.measureText(c.value).width + px(cs.letterSpacing) * c.value.length;
    return [{ x: left - c.scrollLeft, y: c.offsetHeight - px(cs.borderBottomWidth) - 2.5, w: Math.min(w, room + c.scrollLeft) }];
  }
  // a textarea: lay the same words out in a hidden twin and read its lines
  for (const k of ['boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'tabSize', 'textIndent']) {
    mirror.style[k] = cs[k];
  }
  mirror.style.borderStyle = 'solid'; mirror.style.borderColor = 'transparent';
  mirror.style.width = `${c.clientWidth + px(cs.borderLeftWidth) + px(cs.borderRightWidth)}px`;
  mirror.textContent = c.value.endsWith('\n') ? `${c.value}​` : c.value;
  const range = document.createRange();
  range.selectNodeContents(mirror.firstChild);
  const box = mirror.getBoundingClientRect();
  return lineRuns([...range.getClientRects()], box).map(r => ({ x: r.x, y: r.y - c.scrollTop - 2, w: Math.min(r.w, room) }));
}

/**
 * The drawing for a field: the pencil rule it rests on, the ink under the
 * words, the ink that runs along the rule while it has focus, and for a
 * textarea the exercise-book margin. Returns draw(state, look) and destroy().
 * look: { phase, weight, drift } for the words; pencil, nib and margins for the rest.
 */
export function inkLayer(el, ctx) {
  const c = el.control;
  const make = (name, cls) => { const n = document.createElementNS(SVG, name); if (cls) n.setAttribute('class', cls); return n; };
  const svg = make('svg', 'sg-field-ink');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const rule = make('g', 'sg-field-pencil'), g = make('g', 'sg-field-words'), focus = make('path', 'sg-field-focus');
  // graphite: the pencil is broken up by paper grain, so it reads as pencil beside the ink
  const grain = make('filter'), id = `sg-field-grain-${++grains}`;
  grain.id = id;
  grain.innerHTML = GRAIN;
  focus.style.display = 'none';
  svg.append(grain, rule, g, focus);
  const mirror = el.multiline ? Object.assign(document.createElement('div'), { className: 'sg-field-mirror' }) : null;
  mirror?.setAttribute('aria-hidden', 'true');
  c.before(svg);
  if (mirror) el.append(mirror);
  let last = '', drawn = '', was = false, anim = null;
  const path = (d, x, y, alpha = 1, rotate = 0) => {
    const p = make('path');
    p.setAttribute('d', d);
    p.setAttribute('transform', `translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ''}`);
    if (alpha < 1) p.setAttribute('fill-opacity', alpha);
    return p;
  };
  return {
    draw(s, { phase = 0, weight = 2.1, drift = 0.7, pencil = 1.5, nib = 1.9, margins = 1, graphite = true } = {}) {
      // a band along the rule for a line, the whole box for a textarea
      const w = c.offsetWidth, h = c.offsetHeight, top = el.multiline ? 0 : h - 10, band = h - top + 3, ry = h - 1;
      // the box is the control's width; the pencil's overrun past each end is ink overflow (overflow: visible),
      // so it is drawn but never widens the page
      Object.assign(svg.style, { left: `${c.offsetLeft}px`, top: `${c.offsetTop + top}px`, width: `${w}px`, height: `${band}px` });
      svg.setAttribute('viewBox', `0 ${top} ${w} ${band}`);
      const size = `${w},${h},${pencil},${margins}`;
      if (size !== drawn) {
        drawn = size;
        if (graphite) rule.setAttribute('filter', `url(#${id})`); else rule.removeAttribute('filter');
        const seed = s.seed;
        rule.replaceChildren(...pencilRule(w, { seed, weight: pencil }).map(p => path(p.d, p.x, ry + p.y, p.alpha)));
        // the exercise-book margin: one laterite line down the page (two in playful)
        if (el.multiline) for (let i = 0; i < margins; i++) {
          const m = pencilRule(h + 2, { seed: `${seed}:margin${i}`, weight: 1.6, drift: 0.5 })[0];
          const mp = path(m.d, 20 + i * 3.5, m.x, 1, 90);
          mp.setAttribute('class', 'sg-field-margin');
          rule.append(mp);
        }
        focus.setAttribute('d', inkPath(w + 2, { seed: `${seed}:focus`, weight: nib, drift: 0.6, land: 8, lift: 16 }));
        focus.setAttribute('transform', `translate(-1 ${ry})`);
      }
      // the ink under the words, kept inside the field when it scrolls
      const runs = measure(el, mirror).map(r => {
        const x = Math.max(0, r.x), end = Math.min(w, r.x + r.w);
        return { x, y: el.multiline ? r.y : ry, w: end - x };
      }).filter(r => r.w > 0.5 && r.y > 4 && r.y < h);
      const key = `${runs.map(r => `${r.x | 0},${r.y | 0},${Math.round(r.w)}`).join(';')}|${phase}|${weight}`;
      if (key !== last) {
        last = key;
        g.replaceChildren(...runs.map((r, i) => path(inkPath(r.w, { seed: `${s.seed}:${i}`, phase, weight, drift }), r.x.toFixed(1), r.y.toFixed(1))));
      }
      // focus: the rule inks from left to right, the one thing on the page that moves
      if (s.focused !== was) {
        was = s.focused;
        anim?.cancel();
        focus.style.display = s.focused ? '' : 'none';
        const t = s.focused && ctx?.visible !== false && inkIn(ctx?.motion);
        if (t) {
          anim = focus.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], t);
          anim.finished.then(a => a.cancel(), () => {});
        }
      }
    },
    destroy() { anim?.cancel(); svg.remove(); mirror?.remove(); },
  };
}

export function mount(el, ctx) {
  const ink = inkLayer(el, ctx);
  return { update: s => ink.draw(s), restyle: () => ink.draw(el.state()), destroy: () => ink.destroy() };
}
