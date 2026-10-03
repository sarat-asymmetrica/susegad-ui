// Drawer, quiet skin: nothing to draw. drawer.css's base rules (a hairline
// panel at the edge, sliding in a plain slide) already are the quiet look.

export function mount() {
  return { update() {}, destroy() {} };
}
