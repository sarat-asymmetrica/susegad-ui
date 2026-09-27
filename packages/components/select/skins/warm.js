// Warm: the select is written on the paper, like the field beside it. No box:
// a pencil rule drawn by hand under it, a caret of two uneven pencil strokes
// (select.css), and, once the person has chosen, ink over the rule as far as
// the chosen words go, drawn in from the left. A value the page arrived with is
// not a choice, so it gets no ink. Nothing else moves.

import { ruleUnder } from '../../field/rule.js';

let ctx2d = null;

/** How wide the chosen words are, in the select's own font. */
function textRun(select, text) {
  const cs = getComputedStyle(select);
  ctx2d ??= document.createElement('canvas').getContext('2d');
  ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const x = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
  const room = select.clientWidth - x - 32; // leave the caret alone
  return { x, w: Math.max(8, Math.min(room, ctx2d.measureText(text).width)) };
}

export function mount(host, ctx) {
  const select = ctx.native;
  const rule = ruleUnder(host, select, ctx, { seed: select.name || select.id || 'select' });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => rule.ink(last && textRun(select, last.text))) : null;
  ro?.observe(select);
  let seen = null, last = null;
  return {
    update(s) {
      const chosen = s.changed > 0 && s.value !== '';
      last = chosen ? s : null;
      rule.ink(chosen ? textRun(select, s.text) : null, seen !== null && s.changed !== seen);
      seen = s.changed;
    },
    destroy() { ro?.disconnect(); rule.destroy(); },
  };
}
