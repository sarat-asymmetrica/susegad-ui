// Quiet: numbered stations joined by a hairline. Done, here and ahead are told
// apart by fill and weight, not colour alone, and nothing moves.

const NS = 'http://www.w3.org/2000/svg';

export function mount(host) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-stepper-map sg-stepper-line');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  host.querySelector(':scope > .sg-stepper-progress')?.after(svg) ?? host.prepend(svg);
  let count = 0;
  return {
    update(s) {
      const W = 40 * s.count;
      if (s.count !== count) {
        count = s.count;
        svg.setAttribute('viewBox', `0 0 ${W} 28`);
        svg.style.maxWidth = `${W * 1.1}px`;
        svg.innerHTML = `<path class="sg-stepper-rule" d="M20,14H${W - 20}"/>` +
          Array.from({ length: s.count }, (_, k) => `<g transform="translate(${20 + k * 40} 14)"><circle r="9"/><text text-anchor="middle" dominant-baseline="central">${k + 1}</text></g>`).join('');
      }
      [...svg.querySelectorAll('g')].forEach((g, i) => g.setAttribute('class', i < s.index ? 'done' : i === s.index ? 'here' : 'ahead'));
    },
    restyle() {},
    destroy() { svg.remove(); },
  };
}
