// Playful: a bolder parallax than warm, same mechanism.

export function mount(host) {
  host.setAttribute('data-scroll-parallax', '');
  host.style.setProperty('--sg-scroll-parallax', '1.6');
  return {
    update() {},
    destroy() { host.removeAttribute('data-scroll-parallax'); host.style.removeProperty('--sg-scroll-parallax'); },
  };
}
