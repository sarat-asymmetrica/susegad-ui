// Room details: the wiring. A room card that shows a skeleton until the
// source answers, inks in the details, shows availability as a badge, and on
// failure says so plainly with a way to try again.
//
//   mountRoomDetails(article, { source, room: 'garden' })

import '../../components/skeleton/skeleton.js';
import '../../components/badge/badge.js';
import { STRINGS, initial, reduce, view } from './room.core.js';

export { STRINGS } from './room.core.js';

const h = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v != null) k === 'className' || k === 'hidden' ? (n[k] = v) : n.setAttribute(k, v);
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
};

let uid = 0;
const NS = 'http://www.w3.org/2000/svg';

/**
 * The stand-in photograph: a small painted view from the room, in tokens, so a
 * copied recipe needs no image files. Swap it for the room's real photo.
 */
function photo(room) {
  const tall = { garden: [70, 300], balcao: [310], house: [60, 250, 330] }[room.id] ?? [300];
  const palms = tall.map((x, i) => {
    const h = 88 - i * 14, lean = i % 2 ? -10 : 12, top = [x + lean, 150 - h];
    const fronds = [-150, -115, -80, -45, -15, 20].map(a => {
      const r = (a * Math.PI) / 180, len = 30 - i * 4;
      return `M${top[0]},${top[1]}q${Math.cos(r) * len * 0.6},${Math.sin(r) * len * 0.6 - 6} ${Math.cos(r) * len},${Math.sin(r) * len + 8}`;
    }).join('');
    return `<path d="M${x},150Q${x + lean * 0.2},${150 - h * 0.6} ${top[0]},${top[1]}" stroke-width="${3.4 - i * 0.6}"/><path d="${fronds}" stroke-width="${2 - i * 0.3}"/>`;
  }).join('');
  const bunds = [158, 166, 177, 192].map(y => `<path d="M0,${y}Q200,${y - 3} 400,${y + 1}"/>`).join('');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 200');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('class', 'room__photo');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs><linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="color-mix(in oklab, var(--sg-sea, #5b8fa8) 70%, var(--sg-paper, #f4f0e6))"/>
      <stop offset="1" stop-color="color-mix(in oklab, var(--sg-sea, #5b8fa8) 25%, var(--sg-paper, #f4f0e6))"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#sky${uid})"/>
    <circle cx="318" cy="46" r="15" fill="color-mix(in oklab, var(--sg-mango, #e8a33d) 80%, var(--sg-paper, #f4f0e6))"/>
    <path d="M0,128C60,104 110,112 160,118S260,96 320,110 380,116 400,112V152H0Z" fill="color-mix(in oklab, var(--sg-sea, #5b8fa8) 45%, var(--sg-paddy, #6c8d52))" opacity="0.75"/>
    <path d="M0,150H400V200H0Z" fill="var(--sg-paddy, #6c8d52)"/>
    <path d="M150,200L205,150H212L190,200Z" fill="color-mix(in oklab, var(--sg-laterite, #a0522d) 70%, var(--sg-paddy, #6c8d52))"/>
    <g fill="none" stroke="color-mix(in oklab, var(--sg-paddy, #6c8d52) 55%, var(--sg-paper, #f4f0e6))" stroke-width="1.2">${bunds}</g>
    <g fill="none" stroke="color-mix(in oklab, #16241f 75%, var(--sg-paddy, #6c8d52))" stroke-linecap="round">${palms}</g>`;
  return svg;
}

/** Build the card's parts inside `card` once: the skeleton and the error line. */
function scaffold(card) {
  card.classList.add('room');
  card.tabIndex = -1; // focus lands here when the error's button goes away
  const skeleton = h('sg-skeleton', { busy: '', shape: 'card', lines: '3', label: STRINGS.label, seed: card.dataset.room || '1' });
  const retry = h('button', { type: 'button', className: 'room__retry' }, STRINGS.retry);
  // only the message is the alert; the button sits beside it, so it is not read as part of it
  const message = h('p', { className: 'room__message', role: 'alert' }, '');
  const error = h('div', { className: 'room__error', hidden: true }, message, retry);
  card.replaceChildren(skeleton, error);
  return { skeleton, error, message, retry };
}

/** Draw a view (from room.core.js view()) into the card's parts. */
function paint(card, parts, v) {
  const { skeleton, error, message } = parts;
  // a failed card keeps the size it had while loading, so the page does not jump
  if (v.error && !card.classList.contains('is-failed')) {
    const hgt = card.offsetHeight;
    if (hgt > 120) card.style.setProperty('--room-min', `${hgt}px`);
  }
  card.classList.toggle('is-failed', !!v.error);
  if (v.room) {
    const r = v.room, room = { id: card.dataset.room }, id = `room-${++uid}`;
    card.setAttribute('aria-labelledby', id);
    // the skeleton keeps its own status line and drawing; the content goes in beside them
    skeleton.querySelector(':scope > .room__body')?.remove();
    skeleton.append(h('div', { className: 'room__body' },
      photo(room),
      h('div', { className: 'room__head' }, h('h2', { id }, r.name), h('sg-badge', { tone: r.badge.tone }, r.badge.text)),
      h('p', { className: 'room__summary' }, r.summary),
      h('p', { className: 'room__facts' }, `${r.sleeps} · ${r.beds}`),
      h('p', { className: 'room__price' }, h('strong', {}, r.price), ` ${r.per}`),
      h('h3', {}, STRINGS.included),
      h('ul', { className: 'room__included' }, r.included.map(t => h('li', {}, t))),
      h('button', { type: 'button', className: 'room__act' }, r.action),
    ));
  }
  skeleton.hidden = v.skeleton.hidden;
  skeleton.busy = v.skeleton.busy;
  error.hidden = !v.error;
  if (v.error) message.textContent = v.error;
}

/**
 * Load a room into a card, showing only what has arrived: the skeleton stays until the
 * source answers, and only the latest request may change the card.
 */
export function mountRoomDetails(card, { source, room = card.dataset.room }) {
  const parts = scaffold(card);
  let state = initial, next = 0;
  const set = e => { state = reduce(state, e); paint(card, parts, view(state)); card.dispatchEvent(new CustomEvent('room-state', { detail: state })); };
  async function load() {
    const request = ++next;
    set({ type: 'load', request });
    try { set({ type: 'loaded', request, room: await source.load(room) }); }
    catch (err) { set({ type: 'failed', request, error: err?.code ?? 'failed' }); }
  }
  parts.retry.addEventListener('click', () => { card.focus(); load(); });
  load();
  return { load, get state() { return state; } };
}

/** A still of one state, for the gallery of every state. It never loads anything. */
export function stillRoom(card, state) {
  const parts = scaffold(card);
  // a picture of a state, not the state: nothing in it is announced, and its button does nothing
  parts.message.setAttribute('role', 'none');
  parts.skeleton.querySelector(':scope > .sg-skeleton-status')?.setAttribute('role', 'none');
  parts.retry.disabled = true;
  paint(card, parts, view({ ...initial, ...state }));
}
