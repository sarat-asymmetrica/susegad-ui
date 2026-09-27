// Warm: written on the paper like the field. The field's pencil rule, inked
// while focused and under the words after; a two-stroke pencil caret.
import { caret } from './caret.js';
import { ruleUnder } from '../../field/rule.js';

const CARET = [['M1.3 1.6C3.2 3.5 5.4 6.3 8.6 9', '1.9'], ['M7.1 8.7C9.3 6.2 11.9 3.6 14.8 1.1', '1.5']];
let ctx2d = null;

export function mount(host, ctx) {
  const input = ctx.native;
  const svg = caret(host, CARET);
  svg.style.color = 'var(--sg-ink, currentColor)';
  const rule = ruleUnder(host, input, ctx, { seed: input.name || input.id || 'combobox' });
  const words = () => {
    if (!input.value) return null;
    const cs = getComputedStyle(input), x = parseFloat(cs.paddingLeft) + 1;
    ctx2d ??= document.createElement('canvas').getContext('2d');
    ctx2d.font = cs.font;
    return { x, w: Math.max(8, Math.min(input.clientWidth - x - 32, ctx2d.measureText(input.value).width)) };
  };
  const paint = focused => rule.ink(focused ? { x: -1, w: input.offsetWidth + 2 } : words(), focused);
  const onFocus = () => paint(true), onBlur = () => paint(false);
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => paint(document.activeElement === input)) : null;
  ro?.observe(input);
  return {
    update() { if (document.activeElement !== input) paint(false); },
    destroy() { ro?.disconnect(); input.removeEventListener('focus', onFocus); input.removeEventListener('blur', onBlur); rule.destroy(); svg.remove(); },
  };
}
