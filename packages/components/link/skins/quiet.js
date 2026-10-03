// Quiet: link.css draws it (a plain hairline underline, the browser's own
// text-decoration). The skin adds nothing.

export function mount() {
  return { update() {}, destroy() {} };
}
