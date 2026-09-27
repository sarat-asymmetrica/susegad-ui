// Toast, quiet skin: a plain ruled note (toast.css). Motion only for the state
// change itself: it fades in and out in well under 200 ms. Still under reduced motion.

export function mount(el, ctx) {
  let entered = false;
  const still = () => ctx.motion === 'still';
  return {
    update(s) {
      if (entered || s.phase !== 'enter') return;
      entered = true;
      if (still()) { el.entered(); return; }
      el.animate(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      ).finished.then(() => el.entered(), () => el.entered());
    },
    leave() {
      if (still()) return Promise.resolve();
      return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
    },
    destroy() {},
  };
}
