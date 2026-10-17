// Ticket, playful skin: a ticket with a round bite out of each edge where it tears, and a row of perforation
// dots along the tear, between the facts and the QR stub. Beside a phone the stub is below and the tear runs
// across; on a wide screen it runs down. The bites show the page through the ticket. When the card is first
// shown it settles with a small spring (ticket.finish.js does that for a new ticket).

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The ticket's outline in a box `w` by `h`: corners of radius `r`, and a bite of radius `n` out of the two edges
 * the tear meets, at `at` (from the left when `vertical`, else from the top). Returns { edge, perf, bites }: the
 * outline as path data, the perforation line between the bites, and the bite centres (to cover with the page's
 * surface). Pure.
 */
export function ticketShape(w, h, at, vertical, { r = 10, n = 7 } = {}) {
  if (vertical) {
    const x = Math.min(Math.max(at, r + n + 2), w - r - n - 2);
    return {
      edge: `M${r} 0 H${x - n} A${n} ${n} 0 0 0 ${x + n} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${x + n} A${n} ${n} 0 0 0 ${x - n} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`,
      perf: `M${x} ${n + 6} V${h - n - 6}`, bites: [[x, 0, n], [x, h, n]],
    };
  }
  const y = Math.min(Math.max(at, r + n + 2), h - r - n - 2);
  return {
    edge: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${y - n} A${n} ${n} 0 0 0 ${w} ${y + n} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${y + n} A${n} ${n} 0 0 0 0 ${y - n} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`,
    perf: `M${n + 6} ${y} H${w - n - 6}`, bites: [[0, y, n], [w, y, n]],
  };
}

/** Where an element's top-left corner is inside the card, from layout (offsets), so a card that is mid-settle still measures true. */
function within(card, el) {
  let x = 0, y = 0;
  for (let n = el; n && n !== card; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}

export function mount(el) {
  let size = '';
  const geometry = () => {
    const card = el.querySelector('.sg-ticket-card'), stub = el.querySelector('.sg-ticket-stub'), facts = el.querySelector('.sg-ticket-facts');
    if (!card || !stub || !facts) return null;
    const s = within(card, stub), f = within(card, facts), vertical = s.x > f.x + 4;
    return { w: Math.round(card.offsetWidth), h: Math.round(card.offsetHeight), vertical, at: vertical ? s.x - 1 : s.y - 1 };
  };
  const draw = () => {
    const g = geometry(), box = el.deco;
    if (!g || !box || !g.w || !g.h) return;
    size = `${g.w}x${g.h}x${g.at}`;
    const { edge, perf, bites } = ticketShape(g.w, g.h, g.at, g.vertical);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sg-ticket-shape');
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('focusable', 'false');
    for (const [cx, cy, r] of bites) {
      const c = document.createElementNS(SVG, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r + 0.6);
      c.style.fill = 'var(--sg-surface)';
      svg.append(c);
    }
    for (const [cls, d] of [['edge', edge], ['perf', perf]]) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('class', cls); p.setAttribute('d', d); svg.append(p); }
    box.replaceChildren(svg);
  };
  const stale = () => { const g = geometry(); return !g || `${g.w}x${g.h}x${g.at}` !== size; };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (el.ticket && stale()) draw(); }) : null;
  ro?.observe(el);
  return {
    update(s) { if (!s.has) { el.deco?.replaceChildren(); return; } if (stale()) draw(); },
    destroy() { ro?.disconnect(); el.deco?.replaceChildren(); },
  };
}
