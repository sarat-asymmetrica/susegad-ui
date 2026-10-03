// Playful: the same travelling underline as warm, with a small ink bead
// riding at its centre (tabs.core.js's beadAt), on a springier CSS transition
// (tabs.css: --sg-ease-spring).

import { beadAt } from '../tabs.core.js';

export function mount(host) {
  const doc = host.ownerDocument;
  const line = doc.createElement('span');
  line.className = 'sg-tabs-underline';
  const bead = doc.createElement('span');
  bead.className = 'sg-tabs-bead';
  line.setAttribute('aria-hidden', 'true');
  bead.setAttribute('aria-hidden', 'true');
  let list = null;
  const ensure = () => {
    list = host.querySelector('[role="tablist"]');
    if (!list) return;
    if (!line.isConnected) list.append(line);
    if (!bead.isConnected) list.append(bead);
  };
  ensure();
  return {
    update(s) {
      ensure();
      if (!list) return;
      const r = s.rects[s.index];
      line.style.width = r ? `${r.width}px` : '0px';
      if (r) line.style.left = `${r.left}px`;
      const at = beadAt(r);
      if (at != null) bead.style.left = `${at}px`;
    },
    destroy() { line.remove(); bead.remove(); },
  };
}
