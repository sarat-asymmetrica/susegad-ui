// Banner, quiet skin: a plain strip with one hairline (banner.css). The only motion is the strip
// fading out when it is dismissed, in 120 ms, and none under reduced motion.

export function mount(el, ctx) {
  return {
    update() {},
    leave: () => (ctx.motion === 'still' ? Promise.resolve() : el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {})),
    destroy() {},
  };
}
