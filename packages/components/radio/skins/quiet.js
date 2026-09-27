// Quiet: radio.css draws it (hairline circles and a crisp dot). The skin adds
// nothing; the dot's only motion is the CSS scale-in under 200ms, which reduced
// motion takes to zero.

export function mount() {
  return { update() {}, destroy() {} };
}
