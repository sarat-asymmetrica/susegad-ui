// The templates page: the event template's frame follows the "See it as" choice, and the marigold for a name
// is drawn and saved on this device. Nothing is sent anywhere.
//
// Library code is imported by relative path from the repo tree (../../packages/...); build.mjs rewrites the
// prefix for the built copy, so keep every package path in that form.

import { W } from './words.core.js';

const root = document.documentElement;
const announce = text => {
  const el = document.getElementById('announce');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = text));
};

// ── the event template, in the register a visitor picks ─────────────
const frame = document.getElementById('live-frame');
const open = document.getElementById('live-open');
const registers = document.getElementById('live-reg');
if (frame && open && registers) {
  const src = register => `templates/event/site/?register=${register}`;
  registers.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    frame.src = src(input.value);
    open.href = src(input.value);
  });
}

// ── the marigold for a name ─────────────────────────────────────────
const maker = document.getElementById('maker');
if (maker) {
  const canvas = document.getElementById('card');
  const nameEl = document.getElementById('name');
  const status = document.getElementById('status');
  const saveBtn = document.getElementById('save');
  let card = null, timer = 0;
  const load = () => card ??= import('../../packages/recipes/greeting-card/recipe.js');
  // a gift is not page chrome: the card is a marigold in every register (the recipe draws plain dots for 'quiet')
  const register = () => 'warm';
  const name = () => nameEl.value.trim() || W.bloom.fieldDefault;
  const redraw = async () => {
    const { drawCard } = await load();
    const n = name();
    await drawCard(canvas, { name: n, line: '', register: register() });
    canvas.setAttribute('aria-label', W.bloom.cardName(n));
  };
  const queue = () => { clearTimeout(timer); timer = setTimeout(redraw, 160); };
  nameEl.addEventListener('input', queue);
  maker.addEventListener('submit', e => e.preventDefault());

  saveBtn.addEventListener('click', async () => {
    try {
      clearTimeout(timer);
      await redraw();
      const { exportCard } = await load();
      const out = await exportCard(canvas, 'save', name());
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(out.blob), download: out.filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const kind = out.type === 'image/png' ? 'PNG' : out.type === 'image/jpeg' ? 'JPG' : out.type;
      status.textContent = out.type === out.asked ? W.bloom.saved(out.filename) : W.bloom.savedOther(out.filename, kind);
    } catch {
      status.textContent = W.bloom.failed;
    }
  });

  // the recipe, its bloom and the engine load when the toy is near the screen or asked for, not before
  const start = () => { redraw().catch(() => {}); };
  if (location.hash === '#bloom') start();
  else new IntersectionObserver((entries, io) => { if (entries.some(en => en.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '600px 0px' }).observe(maker);
}
