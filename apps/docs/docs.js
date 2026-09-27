// The docs home page: the switches, the scene plates, the pencil box and Look closer.
//
// Library code is imported by relative path from the repo tree
// (../../packages/...). build.mjs rewrites that prefix for the built copy, so
// keep every package path in that form.

import { order, built } from './manifest.js';
import { TECHNIQUES, techniqueName } from './techniques.js';

// Every string a person reads that this script writes. A writer can edit them here.
const STRINGS = {
  plate: n => `Plate ${n}`,
  replay: 'Replay',
  reseed: 'New seed',
  pause: 'Pause',
  play: 'Play',
  closer: 'Look closer',
  copy: 'Copy',
  copied: 'Copied',
  selected: 'Selected. Press Ctrl+C or Cmd+C',
  copiedAnnounce: 'Prompt copied',
  promptTitle: 'the prompt',
  mapTitle: 'how the words become code',
  techniques: 'Techniques',
  liveMoving: 'drawn live in your browser',
  livePaused: 'paused',
  liveStill: 'a still frame; press Play to run it',
  holding: 'looking closer',
  usedIn: 'in ',
  none: 'No scenes yet. Each one appears here once its module is in packages/scenes.',
  registerAnnounce: r => `Register set to ${r}`,
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];

/** Where a scene's own page will live. For now every scene is a plate on this page. */
const sceneHref = name => `#${name}`;

const root = document.documentElement;
const announce = text => { const el = document.getElementById('announce'); el.textContent = ''; requestAnimationFrame(() => (el.textContent = text)); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.includes('-') || k === 'role') el.setAttribute(k, v);
    else el[k] = v;
  }
  kids.flat(Infinity).forEach(k => k != null && k !== false && el.append(k));
  return el;
};

// ── the switches: register, theme, palette ───────────────────────────
const prefs = window.sgDocsPrefs;
const form = document.getElementById('prefs');
if (prefs && form) {
  for (const [key, value] of Object.entries(prefs.current)) {
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  form.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !prefs.ALLOWED[input.name]) return;
    prefs.current = { ...prefs.current, [input.name]: input.value };
    prefs.apply(prefs.current);
    prefs.save(prefs.current);
    if (input.name === 'register') announce(STRINGS.registerAnnounce(input.value));
  });
  form.addEventListener('submit', e => e.preventDefault());
}

// ── pencil box ───────────────────────────────────────────────────────
const toolsEl = document.getElementById('tools');
function drawPencilBox(metas) {
  const usedBy = {};
  metas.forEach(m => (m.techniques || []).forEach(t => (usedBy[t] ||= []).push(m)));
  toolsEl.replaceChildren(...Object.entries(TECHNIQUES).map(([id, [name, desc]]) => {
    const users = usedBy[id] || [];
    const used = users.length
      ? h('span', { className: 'used' }, STRINGS.usedIn, users.flatMap((m, i) => [i ? ', ' : '', h('a', { href: sceneHref(m.name), textContent: m.word || m.title })]))
      : null;
    return h('div', { className: 'tool', id: `t-${id}` }, h('dt', { textContent: name }), h('dd', {}, desc, used));
  }));
}
drawPencilBox([]);

// ── loading: core first, then each scene; a missing piece is skipped ─
const pkg = rel => new URL(`../../packages/${rel}`, import.meta.url).href;

/** Ask the dev server whether a file exists, so a missing scene is not a 404 in the console. */
async function exists(href) {
  try {
    const r = await fetch(`/__exists?path=${encodeURIComponent(new URL(href).pathname)}`, { cache: 'no-store' });
    if (!r.ok) return true; // not our dev server: try the import and let it fail softly
    return (await r.json()).exists;
  } catch { return true; }
}

async function loadCore() {
  const href = pkg('core/index.js');
  if (built ? !built.includes('core') : !(await exists(href))) return false;
  try { await import(href); return true; } catch (err) { console.warn('core not loaded', err); return false; }
}

async function loadScene(name) {
  const href = pkg(`scenes/${name}/index.js`);
  if (built ? !built.includes(name) : !(await exists(href))) return null;
  try {
    const mod = await import(href);
    const def = mod.default;
    if (!def?.meta) { console.warn(`scene ${name} has no meta`); return null; }
    return { name: def.name || name, def, meta: { ...def.meta, name: def.name || name } };
  } catch (err) { console.warn(`scene ${name} not loaded`, err); return null; }
}

const hasCore = await loadCore();
const scenes = hasCore ? (await Promise.all(order.map(loadScene))).filter(Boolean) : [];

// ── masthead kolam ───────────────────────────────────────────────────
if (!scenes.some(s => s.name === 'kolam')) {
  document.getElementById('mast-art').hidden = true;
  document.querySelector('.mast').style.gridTemplateColumns = '1fr';
}

// ── plates ───────────────────────────────────────────────────────────
const platesEl = document.getElementById('plates');
const stageSync = new Set();

/** The viewer's intent, not the loop: a scene off screen is paused but still "playing". */
const wants = stage => !!(stage.wanted ?? stage.playing);

function liveText(stage) {
  if (wants(stage)) return STRINGS.liveMoving;
  return stage.dataset.userPaused ? STRINGS.livePaused : STRINGS.liveStill;
}

function copyButton(text, textEl) {
  const btn = h('button', { className: 'copy', type: 'button', textContent: STRINGS.copy });
  const reset = () => setTimeout(() => (btn.textContent = STRINGS.copy), 1600);
  btn.addEventListener('click', () => {
    const done = () => { btn.textContent = STRINGS.copied; announce(STRINGS.copiedAnnounce); reset(); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(textEl);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = STRINGS.selected; reset();
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch { fallback(); }
  });
  return btn;
}

/** meta.map entries may be [phrase, technique, why] or { phrase, technique, why }. */
const mapEntry = e => (Array.isArray(e) ? e : [e.phrase ?? e.words, e.technique ?? e.tech, e.why ?? e.note]);

function plate({ name, meta: m }, i) {
  const stage = h('sg-scene', { className: 'stage' });
  stage.setAttribute('name', name);
  stage.setAttribute('seed', '1');
  if (m.W && m.H) stage.style.aspectRatio = `${m.W} / ${m.H}`;

  const live = h('span', { className: 'live', 'aria-hidden': 'true' });
  const pauseBtn = h('button', { className: 'btn', type: 'button', textContent: STRINGS.pause });
  const sync = () => {
    pauseBtn.textContent = wants(stage) ? STRINGS.pause : STRINGS.play;
    live.textContent = liveText(stage);
  };
  stageSync.add(sync);
  stage.addEventListener('sg-ready', sync);
  for (const ev of ['sg-play', 'sg-pause', 'sg-state']) stage.addEventListener(ev, sync);

  const replayBtn = h('button', { className: 'btn', type: 'button', textContent: STRINGS.replay });
  replayBtn.addEventListener('click', () => { delete stage.dataset.userPaused; stage.replay?.(); stage.play?.(); sync(); });
  const reseedBtn = h('button', { className: 'btn', type: 'button', textContent: STRINGS.reseed });
  reseedBtn.addEventListener('click', () => { stage.reseed?.(); sync(); });
  pauseBtn.addEventListener('click', () => {
    if (wants(stage)) { stage.pause?.(); stage.dataset.userPaused = '1'; }
    else { delete stage.dataset.userPaused; stage.play?.(); }
    sync();
  });
  const closerBtn = h('button', { className: 'btn', type: 'button', textContent: STRINGS.closer, 'aria-haspopup': 'dialog' });
  closerBtn.addEventListener('click', () => openCloser(m, stage, closerBtn));

  const titleId = `${name}-title`;
  closerBtn.setAttribute('aria-describedby', titleId);

  const promptText = m.prompt || '';
  const promptP = h('p', { textContent: promptText });
  const techniques = m.techniques || [];
  const map = (m.map || []).map(mapEntry);

  const art = h('div', { className: 'art' },
    h('div', { className: 'mount' }, stage),
    h('div', { className: 'controls' }, replayBtn, reseedBtn, pauseBtn, closerBtn, live));

  const text = h('div', { className: 'text' },
    h('p', { className: 'plate-no', textContent: STRINGS.plate(ROMAN[i] || i + 1) }),
    h('h3', { id: titleId, textContent: m.title }),
    (m.word || m.gloss) && h('p', { className: 'word' }, m.word && h('b', { textContent: m.word }), m.gloss && `${m.word ? ' · ' : ''}${m.gloss}`),
    m.caption && h('p', { className: 'caption', textContent: m.caption }),
    m.credit && h('p', { className: 'credit', textContent: m.credit }),
    techniques.length && h('ul', { className: 'tags', 'aria-label': STRINGS.techniques },
      techniques.map(t => h('li', {}, h('a', { href: `#t-${t}`, textContent: techniqueName(t) })))),
    promptText && h('div', { className: 'letter' },
      h('div', { className: 'letter-head' }, h('h4', { id: `${name}-prompt`, textContent: STRINGS.promptTitle }), copyButton(promptText, promptP)),
      promptP),
    map.length && h('div', { className: 'map' },
      h('h4', { id: `${name}-map`, textContent: STRINGS.mapTitle }),
      h('dl', {}, map.map(([phrase, tech, why]) => [
        h('dt', { textContent: phrase }),
        // the technique is plain text here: the same technique is already a link in the tags above,
        // and linking it twice doubled each plate's tab stops
        h('dd', {}, tech && h('span', { className: 'term', textContent: techniqueName(tech) }), why),
      ]))),
  );

  return h('article', { className: `plate${i % 2 ? ' flip' : ''}`, id: name, 'aria-labelledby': titleId }, art, text);
}

if (scenes.length) platesEl.replaceChildren(...scenes.map(plate));
else platesEl.replaceChildren(h('p', { className: 'note', textContent: STRINGS.none }));
drawPencilBox(scenes.map(s => s.meta));

// the register decides whether scenes move; keep the labels truthful when it changes
new MutationObserver(() => requestAnimationFrame(() => stageSync.forEach(f => f())))
  .observe(root, { attributes: true, attributeFilter: ['data-register'] });
reduceMotion.addEventListener('change', () => stageSync.forEach(f => f()));

// ── look closer ──────────────────────────────────────────────────────
// The plate's stage morphs into a full view. The browser photographs the
// before and after and animates between them (View Transitions); the running
// scene itself is moved, never rebuilt, so it does not restart. Reduced
// motion skips the morph and simply opens the dialog.
const closer = document.getElementById('closer');
const slot = document.getElementById('closer-slot');
let open = null;

const morph = fn => (document.startViewTransition && !reduceMotion.matches ? document.startViewTransition(fn) : (fn(), null));
const move = (el, parent, before = null) => {
  if (parent.moveBefore) { try { parent.moveBefore(el, before); return; } catch { /* fall through */ } }
  parent.insertBefore(el, before);
};
const fitCloser = () => {
  if (!open) return;
  const r = slot.getBoundingClientRect();
  const ar = (open.m.W || 3) / (open.m.H || 2);
  open.stage.style.width = `${Math.floor(Math.min(r.width, r.height * ar))}px`;
};

function openCloser(m, stage, trigger) {
  if (open) return;
  const hold = h('div', { className: 'stage-hold', textContent: STRINGS.holding });
  hold.style.aspectRatio = stage.style.aspectRatio || '3 / 2';
  stage.style.viewTransitionName = 'closer-stage';
  morph(() => {
    stage.parentNode.insertBefore(hold, stage);
    document.getElementById('closer-title').textContent = m.title || '';
    document.getElementById('closer-word').textContent = m.word || '';
    move(stage, slot);
    closer.showModal();
    open = { m, stage, hold, trigger };
    fitCloser();
  });
}

function restore() {
  const { stage, hold } = open;
  move(stage, hold.parentNode, hold);
  hold.remove();
  stage.style.width = '';
}

function closeCloser() {
  if (!open) return;
  const { stage, trigger } = open;
  const t = morph(() => { restore(); open = null; if (closer.open) closer.close(); });
  const done = () => { stage.style.viewTransitionName = ''; trigger.focus({ preventScroll: true }); };
  t ? t.finished.then(done, done) : done();
}

document.getElementById('closer-close').addEventListener('click', closeCloser);
// Escape: run our own close so the stage morphs home and focus returns to the trigger
closer.addEventListener('cancel', e => { e.preventDefault(); closeCloser(); });
// if the browser closes the dialog on its own, put the stage back without ceremony
closer.addEventListener('close', () => {
  if (!open) return;
  const { stage, trigger } = open;
  restore(); open = null;
  stage.style.viewTransitionName = '';
  trigger.focus({ preventScroll: true });
});
addEventListener('resize', fitCloser);

if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
window.__ready = true;
