// Quiet: the graded photograph as a still. No water, no parallax; the focus
// may still move between beats, as a change of state. The 2D tier draws it, so
// a quiet page never downloads three.

export function mount(host) {
  host.registerChanged();
  return { update() {}, restyle() { host.regrade(); }, destroy() {} };
}
