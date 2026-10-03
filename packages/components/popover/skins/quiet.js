// Quiet: popover.css draws it (a hairline card, no ornament). The skin adds
// nothing; the native popover API does the rest.

export function mount() {
  return { update() {}, destroy() {} };
}
