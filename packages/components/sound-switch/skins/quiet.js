// Quiet: sound-switch.css draws it as a plain track and thumb, the same
// hairline switch as any other in the quiet register. No speaker, no arcs:
// the label's own words ("Sound") carry the meaning.

export function mount() {
  return { update() {}, destroy() {} };
}
