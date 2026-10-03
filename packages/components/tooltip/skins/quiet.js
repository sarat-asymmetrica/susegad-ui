// Quiet: tooltip.css draws it (a plain small label, dark on light or light
// on dark, no ornament). The skin adds nothing.

export function mount() {
  return { update() {}, destroy() {} };
}
