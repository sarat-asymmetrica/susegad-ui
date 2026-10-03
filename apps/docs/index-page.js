// An index page's search: hide the cards that don't match, say how many are left.
// The cards are plain HTML (site.core.js), so with no JavaScript every card shows.

const input = document.getElementById('s-q');
const list = document.getElementById('s-list');
const count = document.getElementById('s-count');
const none = document.getElementById('s-none');

if (input && list) {
  const cards = [...list.querySelectorAll('.s-card')];
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const c of cards) {
      const hit = !q || c.dataset.search.includes(q);
      c.hidden = !hit;
      if (hit) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? 'piece' : 'pieces'}${q ? ` for “${input.value.trim()}”` : ''}`;
    none.hidden = shown > 0;
  };
  input.addEventListener('input', apply);
  // "/" jumps to the search, unless someone is already typing somewhere
  addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
    e.preventDefault();
    input.focus();
  });
  if (input.value) apply();
}
