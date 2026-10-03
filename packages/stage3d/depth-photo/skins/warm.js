// Warm: one living thing, the water, moving inside its mask, and the rack
// focus as the transition. The camera answers the story's dolly only; the
// pointer does not move it.

export function mount(host) {
  host.registerChanged();
  host.pointerTarget = [0, 0];
  return { update() {}, restyle() { host.regrade(); }, destroy() {} };
}
