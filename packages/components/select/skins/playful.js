// Playful: the options are stamped chips (select.css), and a choice lands on
// the control with a small press, like a stamp coming down. Only a choice moves it.

export function mount(host, ctx) {
  let seen = null;
  return {
    update(s) {
      const select = ctx.native;
      if (select && seen !== null && s.changed !== seen && ctx.motion === 'full' && ctx.visible) {
        select.animate([{ scale: 1 }, { scale: 0.97, offset: 0.35 }, { scale: 1.015, offset: 0.7 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
      }
      seen = s.changed;
    },
    destroy() {},
  };
}
