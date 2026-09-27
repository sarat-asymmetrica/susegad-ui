// Quiet: three still dots before the words. Unless motion is off, they pulse
// slowly in turn: the one thing a loading state needs to show is that it is alive.

export function mount(host, ctx) {
  const dots = document.createElement('span');
  dots.className = 'sg-loader__dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = '<i></i><i></i><i></i>';
  host.prepend(dots);
  let anims = [];
  const start = () => {
    if (anims.length || ctx.motion === 'still') return;
    anims = [...dots.children].map((d, i) => d.animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }], {
      duration: 1800, delay: i * 300, iterations: Infinity, easing: 'ease-in-out',
    }));
  };
  return {
    update() { start(); anims.forEach(a => (ctx.visible ? a.play() : a.pause())); },
    destroy() { anims.forEach(a => a.cancel()); dots.remove(); },
  };
}
