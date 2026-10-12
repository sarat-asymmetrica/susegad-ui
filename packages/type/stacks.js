// The token font stacks, for words laid on a drawn surface. A canvas measures with the font string it is given and
// does not inherit the page's stack, so a scene that names one family ('Kalam') gets a system face for any script that
// family lacks (Kalam has no Kannada). Scenes pass the whole stack instead, so Pretext measures, and the spans are
// drawn in, the same faces per script (the "named font per script" caveat of decision 0029).
//
// One source of truth: the stack is read from the page's own tokens at run time (--sg-font-hand, --sg-font-body from
// tokens.css) and falls back to the mirror below when the tokens are not loaded. The mirror is kept honest by
// stacks.test.js and by the text gate (tools/text-gate.mjs), which both read tokens.css. This file imports nothing.

export const STACKS = {
  hand: "'Kalam', 'Kalam Fallback', 'Segoe Print', 'Bradley Hand', 'Noto Sans Kannada', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, 'Kannada Sangam MN', Tunga, cursive",
  body: "'Mukta', 'Noto Sans Kannada', 'Mukta Fallback', 'Segoe UI', system-ui, 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, 'Kannada Sangam MN', Tunga, sans-serif",
};

/** The stack named `name` ('hand' | 'body') as `el` sees it: the --sg-font-<name> custom property, else the mirror. */
export function stackOf(el, name) {
  let v = '';
  try { v = el ? getComputedStyle(el).getPropertyValue(`--sg-font-${name}`).trim() : ''; } catch { /* no DOM: use the mirror */ }
  return v || STACKS[name];
}
