// Field note, quiet skin: small text in the danger colour with a mark
// (field-note.css). The only motion is the note fading in when it appears,
// in 120 ms, and none under reduced motion.

export function mount(el, ctx) {
  let was = false;
  return {
    update(s) {
      if (s.shown && !was && ctx.motion !== 'still') {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
      }
      was = s.shown;
    },
    destroy() {},
  };
}
