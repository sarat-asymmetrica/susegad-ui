// Toast, quiet skin: a plain ruled note (toast.css). The change of state is
// CSS: it arrives from @starting-style and leaves on data-phase="leave", each
// 120 ms of opacity and nothing else, under 200 ms. Still under reduced motion
// (the stylesheet has no transition there). This skin only waits for the
// transition to finish before it says the toast has arrived or may go.

/** Resolves when the toast's own CSS transitions have finished (at once when there are none). */
const settled = el => {
  getComputedStyle(el).opacity; // flush style, so a transition that has just been set up is counted
  return Promise.all(el.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished.catch(() => {})));
};

export function mount(el) {
  let entered = false;
  return {
    update(s) {
      if (entered || s.phase !== 'enter') return;
      entered = true;
      settled(el).then(() => el.entered());
    },
    leave: () => settled(el),
    destroy() {},
  };
}
