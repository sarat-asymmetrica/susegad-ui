// Quiet: no parallax, no scroll-linked drawing of its own — a scene inside
// still moves (via its own `progress`, set by scroll-section.js), but this
// register adds no extra flourish on top of it.

export function mount(host) {
  host.removeAttribute('data-scroll-parallax');
  return { update() {}, destroy() {} };
}
