// Quiet: a plain hairline chevron. The list itself is drawn by combobox.css; nothing moves but the caret turning.
import { caret } from './caret.js';

export function mount(host) {
  const svg = caret(host, 'M1.5 1.5 8 8l6.5-6.5', '1.6');
  return { update() {}, destroy() { svg.remove(); } };
}
