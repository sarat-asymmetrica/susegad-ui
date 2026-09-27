// Quiet: toggle.css draws it (a plain track and a thumb that slides across).
// The skin adds nothing; the slide is a CSS transition under 200ms, and
// reduced motion takes it to zero.

export function mount() {
  return { update() {}, destroy() {} };
}
