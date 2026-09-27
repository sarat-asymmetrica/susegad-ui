// The warm pencil rule under any form control: the same drawing the field
// rests on, for a select or a combobox. A graphite rule, drawn by hand a
// little past both ends of the control, and ink laid over it: under a chosen
// value, or along the whole rule while the control has focus. Decorative and
// aria-hidden; the control keeps its own border width, so nothing shifts.
//
//   const rule = ruleUnder(host, select, ctx, { seed: 'room' });
//   rule.draw();                       after a resize
//   rule.ink({ x: 12, w: 140 }, true); ink 140 units from x = 12, drawn in
//   rule.ink(null);                    lift the ink

import { pencilRule, inkPath, inkIn, GRAIN } from './field.core.js';

const NS = 'http://www.w3.org/2000/svg';
let n = 0;

export function ruleUnder(host, control, ctx, { seed = 'rule', pencil = 1.5, nib = 1.9, graphite = true } = {}) {
  const make = (name, cls) => { const e = document.createElementNS(NS, name); if (cls) e.setAttribute('class', cls); return e; };
  const svg = make('svg', 'sg-rule');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const grain = make('filter'), id = `sg-rule-grain-${++n}`;
  grain.id = id;
  grain.innerHTML = GRAIN;
  const rule = make('g', 'sg-rule__pencil'), ink = make('path', 'sg-rule__ink');
  if (graphite) rule.setAttribute('filter', `url(#${id})`);
  ink.style.display = 'none';
  svg.append(grain, rule, ink);
  host.append(svg);
  let size = '', now = '', anim = null;

  const draw = () => {
    const w = control.offsetWidth, h = control.offsetHeight;
    if (!w) return;
    // the control's width: the pencil's overrun is ink overflow, drawn but never widening the page
    Object.assign(svg.style, { left: `${control.offsetLeft}px`, top: `${control.offsetTop + h - 10}px`, width: `${w}px`, height: '13px' });
    svg.setAttribute('viewBox', `0 ${h - 10} ${w} 13`);
    const key = `${w},${h}`;
    if (key === size) return;
    size = key;
    rule.replaceChildren(...pencilRule(w, { seed, weight: pencil }).map(p => {
      const e = make('path');
      e.setAttribute('d', p.d);
      e.setAttribute('transform', `translate(${p.x} ${h - 1 + p.y})`);
      if (p.alpha < 1) e.setAttribute('fill-opacity', p.alpha);
      return e;
    }));
    now = ''; // the ink sits on the rule's height, so lay it again
  };

  return {
    draw,
    /** Ink over the rule from x for w units, or null to lift it. `animate` draws it in from the left. */
    ink(run, animate = false) {
      draw();
      const key = run ? `${Math.round(run.x)},${Math.round(run.w)},${size}` : '';
      if (key === now) return;
      now = key;
      anim?.cancel();
      ink.style.display = run ? '' : 'none';
      if (!run) return;
      ink.setAttribute('d', inkPath(run.w, { seed: `${seed}:ink`, weight: nib, drift: 0.6, land: 8, lift: 16 }));
      ink.setAttribute('transform', `translate(${run.x.toFixed(1)} ${control.offsetHeight - 1})`);
      const t = animate && ctx?.visible !== false && inkIn(ctx?.motion);
      if (t) {
        anim = ink.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], t);
        anim.finished.then(a => a.cancel(), () => {});
      }
    },
    destroy() { anim?.cancel(); svg.remove(); },
  };
}
