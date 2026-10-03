// Warm: the ink underline that travels. One element, positioned by
// tabs.core.js's underlineRect and left to CSS (tabs.css) to transition
// smoothly between tabs; reduced motion collapses that transition to the
// register's near-zero duration on its own, so there is nothing to branch on
// here.

export function mount(host) {
  const line = host.ownerDocument.createElement('span');
  line.className = 'sg-tabs-underline';
  line.setAttribute('aria-hidden', 'true');
  let list = null;
  const ensure = () => {
    list = host.querySelector('[role="tablist"]');
    if (list && !line.isConnected) list.append(line);
  };
  ensure();
  return {
    update(s) {
      ensure();
      const r = s.rects[s.index];
      if (!list) return;
      line.style.width = r ? `${r.width}px` : '0px';
      if (r) line.style.left = `${r.left}px`;
    },
    destroy() { line.remove(); },
  };
}
