// Dialog, quiet skin: nothing to draw. The native <dialog> and dialog.css's
// base rules (an own-sized box, a plain dimmed ::backdrop) already are the
// quiet look. This skin only exists so `data-skin` is set consistently.

export function mount() {
  return { update() {}, destroy() {} };
}
