// Toast, warm skin: an inland letter that unfolds. The blue card, dashed rule,
// fold creases and perforated stamp are CSS (toast.css); this adds the flap.
// The flap swings open on its top edge while the card opens downward, once,
// when the toast arrives. Under reduced motion the letter is simply open.

export function decorate(el) {
  const deco = el.querySelector(':scope > .sg-toast-deco');
  const flap = document.createElement('div');
  flap.className = 'sg-toast-flap';
  flap.setAttribute('aria-hidden', 'true');
  deco.replaceChildren(flap);
  return { deco, flap };
}

export function unfold(el, parts, { still, speed = 1 }) {
  const { flap } = parts;
  if (still) { flap.hidden = true; return Promise.resolve(); }
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const opening = flap.animate(
    [{ transform: 'perspective(40rem) rotateX(0deg)' }, { transform: 'perspective(40rem) rotateX(180deg)' }],
    { duration: 380 * speed, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'forwards' },
  );
  const card = el.animate(
    [{ clipPath: 'inset(0 0 58% 0)', opacity: 0.6 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }],
    { duration: 460 * speed, delay: 120 * speed, easing: ease, fill: 'backwards' },
  );
  return Promise.all([opening.finished, card.finished]).then(() => { flap.hidden = true; opening.cancel(); card.cancel(); }, () => {});
}

export function refold(el, still) {
  if (still) return Promise.resolve();
  return el.animate(
    [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 70% 0)', opacity: 0 }],
    { duration: 240, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
  ).finished.catch(() => {});
}

export function mount(el, ctx) {
  const parts = decorate(el);
  let entered = false;
  return {
    update(s) {
      if (entered) return;
      entered = true;
      // mounted after the letter arrived (a register change): it is already open
      if (s.phase !== 'enter') { parts.flap.hidden = true; return; }
      unfold(el, parts, { still: ctx.motion === 'still' }).then(() => el.entered());
    },
    leave: () => refold(el, ctx.motion === 'still'),
    destroy() { parts.deco.replaceChildren(); },
  };
}
