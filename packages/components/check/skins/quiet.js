// Quiet: check.css draws it (a hairline box and a crisp tick). The skin adds
// nothing; the tick's only motion is the CSS scale-in under 200ms, which
// reduced motion takes to zero.

export function mount() {
  return { update() {}, destroy() {} };
}
