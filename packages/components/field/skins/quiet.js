// Field, quiet skin: nothing to add, for an input, textarea or select. The ruled line is field.css, which is also
// what a page without JavaScript shows. Nothing moves.

export function mount() {
  return { update() {}, destroy() {} };
}
