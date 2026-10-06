// Warm: the marker drawn in the hand face, and a soft open transition. The
// drawing is CSS; this skin carries the motion word (`data-motion`) the CSS
// gates on, so the hand face still draws when the page is seen again after a
// scroll, and cleans itself up when the element goes away. Still.
export function mount(host, ctx) {
  host.dataset.motion = ctx.motion;
  return {
    update() { host.dataset.motion = ctx.motion; },
    destroy() { delete host.dataset.motion; },
  };
}
