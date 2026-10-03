// Warm: a slow parallax lift on the scene as the section scrolls (one
// living thing per screen, per the charter's register table), scrubbed by
// scroll-section.css from the same --sg-scroll-progress the loop sets.

export function mount(host) {
  host.setAttribute('data-scroll-parallax', '');
  host.style.setProperty('--sg-scroll-parallax', '1');
  return {
    update() {},
    destroy() { host.removeAttribute('data-scroll-parallax'); host.style.removeProperty('--sg-scroll-parallax'); },
  };
}
