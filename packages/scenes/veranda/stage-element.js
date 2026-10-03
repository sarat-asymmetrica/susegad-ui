// <sg-veranda-stage>: the drawn veranda staged in 3D, with the page's words on a frosted pane INSIDE it.
//
//   <sg-veranda-stage register="warm">
//     <h2>Come and sit</h2>
//     <p>The lamp is on at six.</p>
//   </sg-veranda-stage>
//
// The children are the words: they stay real text in the page, in the accessibility tree, selectable, at every depth and in
// every tier. The element makes the drawing and its exact depth map (assets.js), stages them through <sg-depth-photo>
// (three.js only when the picture will move), and puts the words on a pane at a depth d:
//
//   drag the grip          the pane moves across the picture (core's movable: keys, status line, words-at, sg-words-moved)
//   PageUp / PageDown      the pane comes forward or goes back; so does the wheel over the grip
//   things in front hide it   a CSS mask made from the depth map at d, for the camera as it stands (each near pixel placed where the camera puts it)
//   focus follows the pane    focus = d: the pane's plane is sharp and the rest softens
//   at rest, always        no line more than 15% hidden and no line over other words (notes, the pot's pane): on release, and again, throttled, when the
//                          camera, the lens, a note or the pot changes what is in front. Least change first: stay, come forward, then move (settleSpot).
//
// In playful the pane can become a LENS (a button in the pane): through it the same veranda in another state (the monsoon, dusk),
// drawn from the same solids, seen only inside the pane's rect; the words stay one block on one plate, the button in a strip below. It is a 2D overlay in
// both tiers, so on the live tier it does not lean with the camera the way the picture does (a render target would). With `pane-turn` the words lean a
// little toward the camera as it moves and settle back, turned on a layer inside the panel so the mask stays on the panel (core's orient; decision 0022);
// off by default, and nothing is loaded for it unless a page asks.
// A paragraph marked data-flow sits on its own glass pane at a turning clay pot on the balcao (matka-view.js), the pot straddling the pane's
// corner and the lines set round its silhouette: drawn by three.js on the live tier with the lines re-laid at sixteen steps a turn, or a
// still with the lines laid once on the 2D tier, in quiet and with reduced motion.
// Notes stick to places: addNote({ anchor, text }) puts a small note on a surface (the door, the balcao, the lamp...), kept there
// through place() as the camera moves, on whichever side of its anchor meets no other words. A note is a sticker: it is drawn over the picture and does not hide behind things. Drag a note by its grip and let go:
// the depth map under the drop decides which surface it belongs to. From the keyboard the grip's arrows cycle the anchors. With
// the `walk` attribute, scrolling dollies the camera down the veranda and stops at each note. Notes are [{ anchor, text }] where
// text is an index into `noteTexts`, so a postcard (the page's job) carries ids and never words.
// Quiet: the pane is a flat opaque plate at rest; nothing moves and nothing hides it. Under a narrow stage the words go below
// the picture, flat. No storage here: the page remembers with `words-at` and `pane-depth`, and listens for sg-words-moved.

import { readRegister, observeRegister } from '../../core/register.js';
import { verandaAssets } from './assets.js';
import { ANCHORS, anchorPoint } from './world.js';
import { DEPTH, depthSaid, paneScale, stepDepth, parseDepth, samplePoints, byteAt, photoAt, cutByte, nearestAnchor, cycleAnchor, walkPlan, walkAt, hiddenGrid, hiddenIn, shownPath, lineShares, settleSpot, placeNote } from './pane.core.js';

const W = 1200, H = 800;
// two panes of frosted glass must not be within reach of each other's blur (3 sigma of 14 px): one backdrop-filter reading another's output made the
// GPU raster stall for a second on this machine's integrated GPU, at a random moment while the camera moved
const GLASS_APART = 48;
const CSS = `
sg-veranda-stage{display:block;position:relative;container-type:inline-size;--sg-reading-place:center center}
/* the glass tint, per register and theme: the lowest whose worst pixel under any line is still 5:1 (scene-scoped; tokens.css says 74% and 66%, which is what an
   unqualified rule here would have got, because the element carries data-register and [data-register=warm] in tokens.css outranks a bare element selector) */
sg-veranda-stage[data-register=warm]{--sg-glass-tint:46%}
sg-veranda-stage[data-register=playful]{--sg-glass-tint:40%}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) sg-veranda-stage[data-register=warm]{--sg-glass-tint:50%}:root:not([data-theme=light]) sg-veranda-stage[data-register=playful]{--sg-glass-tint:52%}}
:root[data-theme=dark] sg-veranda-stage[data-register=warm]{--sg-glass-tint:50%}
:root[data-theme=dark] sg-veranda-stage[data-register=playful]{--sg-glass-tint:52%}
sg-veranda-stage .frame{display:grid}
sg-veranda-stage .stage{position:relative;grid-area:1/1;aspect-ratio:3/2;overflow:hidden;border-radius:var(--sg-radius-3,10px);background:var(--sg-surface-sunk,#ddd)}
sg-veranda-stage .stage sg-depth-photo{position:absolute;inset:0;aspect-ratio:auto;border-radius:0;box-shadow:none}
sg-veranda-stage .reading{grid-area:1/1;position:relative;z-index:1;display:grid;place-items:var(--sg-reading-place,end start);padding:var(--sg-reading-inset,clamp(12px,4cqi,40px));pointer-events:none;min-width:0}
sg-veranda-stage .panel{pointer-events:auto;position:relative;font-size:calc(1rem*var(--sg-pane-scale,1));max-width:min(20em,100%);padding:.85em 1.1em;border-radius:var(--sg-radius-2,8px);
 background:var(--sg-scrim,color-mix(in oklab,Canvas 92%,transparent));color:var(--sg-scrim-ink,var(--sg-text,CanvasText));
 -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
sg-veranda-stage .panel > :first-child:not(.grip){margin-top:0}
sg-veranda-stage .panel > :nth-last-child(2):not(.grip),sg-veranda-stage .panel > :last-child:not(.grip){margin-bottom:0}
sg-veranda-stage[data-register=quiet] .panel{background:var(--sg-surface-raised,Canvas)}
sg-veranda-stage .frame.stacked .reading{grid-area:2/1;padding:12px 0 0;display:block;pointer-events:auto}
sg-veranda-stage .frame.stacked .panel{mask-image:none!important;-webkit-mask-image:none!important}
sg-veranda-stage[data-lens-ok] .panel{padding-bottom:calc(.85em + 2.7em)}
sg-veranda-stage .lens-view{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;display:none;pointer-events:none;z-index:0}
sg-veranda-stage .panel.lens .lens-view{display:block}
sg-veranda-stage .panel.glass.lens{background:transparent;background-image:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:inset 0 0 0 2px var(--sg-surface-raised,Canvas),0 0 0 1px var(--sg-rule-strong,GrayText)}
sg-veranda-stage .panel.lens::after{content:"";position:absolute;z-index:1;left:6px;right:6px;top:6px;bottom:calc(2.7em + 4px);border-radius:calc(var(--sg-radius-2,8px) - 2px);background:color-mix(in oklab,var(--sg-surface-raised,Canvas) var(--sg-lens-plate,60%),transparent);pointer-events:none}
sg-veranda-stage .panel.lens > :is(h1,h2,h3,h4,h5,h6,p,li){position:relative;z-index:2}
sg-veranda-stage .lens-btn{position:absolute;z-index:3;left:1.1em;bottom:.6em;display:none;margin:0;font:inherit;font-size:.85em;padding:.3em .8em;border-radius:999px;border:1px solid var(--sg-rule-strong,GrayText);background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);cursor:pointer}
sg-veranda-stage[data-lens-ok] .lens-btn{display:inline-block}
sg-veranda-stage .lens-btn:focus-visible{outline:2px solid var(--sg-focus,Highlight);outline-offset:2px}
sg-veranda-stage .notes{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
sg-veranda-stage .note{position:absolute;left:0;top:0;pointer-events:auto;max-width:11em;font-size:calc(.82rem*var(--sg-note-scale,1));line-height:1.35;padding:.45em .7em .5em .55em;border-radius:6px 6px 6px 0;background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);box-shadow:0 0 0 1px var(--sg-rule-strong,GrayText),0 6px 14px -8px var(--sg-shadow,rgb(0 0 0/.4));will-change:transform}
sg-veranda-stage .note::after{content:"";position:absolute;width:0;height:0;border:0 solid transparent}
sg-veranda-stage .note[data-side=tr]::after{left:-1px;bottom:calc(-1*var(--tail,7px));border-left-width:9px;border-top:var(--tail,7px) solid var(--sg-surface-raised,Canvas)}
sg-veranda-stage .note[data-side=tl]::after{right:-1px;bottom:calc(-1*var(--tail,7px));border-right-width:9px;border-top:var(--tail,7px) solid var(--sg-surface-raised,Canvas)}
sg-veranda-stage .note[data-side=br]::after{left:-1px;top:calc(-1*var(--tail,7px));border-left-width:9px;border-bottom:var(--tail,7px) solid var(--sg-surface-raised,Canvas)}
sg-veranda-stage .note[data-side=bl]::after{right:-1px;top:calc(-1*var(--tail,7px));border-right-width:9px;border-bottom:var(--tail,7px) solid var(--sg-surface-raised,Canvas)}
sg-veranda-stage .note[data-active]{box-shadow:0 0 0 2px var(--sg-accent,Highlight),0 8px 18px -8px var(--sg-shadow,rgb(0 0 0/.5))}
sg-veranda-stage .note p{margin:0}
sg-veranda-stage .note-grip{position:absolute;top:-11px;right:-11px;width:22px;height:22px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid var(--sg-rule-strong,GrayText);background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);cursor:grab;touch-action:none;font-size:11px;line-height:1}
sg-veranda-stage .note-grip:focus-visible{outline:2px solid var(--sg-focus,Highlight);outline-offset:2px}
sg-veranda-stage .note.dragging{z-index:3;opacity:.92}
sg-veranda-stage .notes-list{margin:var(--sg-space-3,12px) 0 0;padding:0;list-style:none;font-size:.9rem;color:var(--sg-text-soft,GrayText)}
sg-veranda-stage .notes-list li{margin:.15em 0}
sg-veranda-stage .notes-list li[aria-current=step]{color:var(--sg-text,CanvasText);font-weight:600}
sg-veranda-stage .notes-list button{font:inherit;margin-left:.6em;padding:0 .5em;border-radius:4px;border:1px solid var(--sg-rule-strong,GrayText);background:none;color:inherit;cursor:pointer}
sg-veranda-stage[data-walk]{min-height:calc((var(--sg-walk-stops,3) + 1) * 78vh)}
sg-veranda-stage[data-walk] .frame{position:sticky;top:12px}
sg-veranda-stage .flow-card{background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);border-radius:var(--sg-radius-2,8px);box-shadow:0 0 0 1px var(--sg-rule-strong,GrayText),0 8px 18px -10px var(--sg-shadow,rgb(0 0 0/.4));pointer-events:auto;font-size:.9rem;line-height:1.4}
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
sg-veranda-stage[data-moving] .flow-card{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
sg-veranda-stage[data-register=warm] .flow-card,sg-veranda-stage[data-register=playful] .flow-card{background:color-mix(in oklab,var(--sg-surface-raised,Canvas) var(--sg-glass-tint,56%),transparent);-webkit-backdrop-filter:blur(var(--sg-glass-blur,14px)) saturate(1.15);backdrop-filter:blur(var(--sg-glass-blur,14px)) saturate(1.15);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--sg-rule-strong,GrayText) 45%,transparent),0 14px 30px -18px var(--sg-shadow,rgb(0 0 0/.4))}}
sg-veranda-stage .matka-cv{pointer-events:none}
sg-veranda-stage .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
sg-veranda-stage .wait{position:absolute;inset:0;display:grid;place-items:center;color:var(--sg-text-soft,GrayText);font-size:.9rem}`;

let styled = false;
const isDark = el => {
  const t = el.closest('[data-theme]')?.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class SgVerandaStage extends HTMLElement {
  static observedAttributes = ['pane-depth', 'words-at', 'lens', 'walk', 'pane-turn'];
  #els = null; #dp = null; #assets = null; #d = DEPTH.home; #mv = null; #off = []; #built = false; #reg = 'warm';
  #flowP = null; #matka = null;
  #notes = []; #noteEls = new Map(); #noteTexts = []; #noteKey = ''; #noteRaf = 0; #uid = 1; #walk = null; #drag = null;
  #lens = ''; #lensLooks = new Map(); #lensRaf = 0; #lensKey = '';
  #clear = new Map(); #maskTimer = 0; #maskUrl = ''; #maskFor = null; #status = null; #raf = 0; #tween = null; #focusTo = null;
  #cam = ''; #tab = null; #hid = new Map(); #arrT = 0; #camT = 0; #movT = 0; #camAt = -1e9; #sz = { w: 0, h: 0 }; #noteBoxes = []; #noteSize = new Map();
  #turn = null; #tw = null;

  get meta() { return { W, H }; }
  /** The pane's depth, 0.10 far to 0.85 near. */
  get paneDepth() { return this.#d; }
  set paneDepth(v) { this.#setDepth(parseDepth(v), { emit: false }); }
  /** Where the words have been moved to as { x, y } (fractions of the free room), or null at home. */
  get wordsAt() { return this.#mv?.at() ?? null; }
  /** The keep-away list: the pane's rect (and any other that joined), in the picture's logical units. A copy. */
  get calm() { return [...this.#clear.values()].map(r => ({ ...r })); }
  keepClear(id, rect) {
    if (rect === null) this.#clear.delete(id);
    else if (rect && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(rect[k]))) this.#clear.set(id, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    else return;
    this.dispatchEvent(new CustomEvent('sg-calm', { bubbles: true, composed: true, detail: { calm: this.calm } }));
  }
  get depthPhoto() { return this.#dp; }
  get pane() { return this.#els?.panel ?? null; }
  /** Depth bytes and the drawing's assets, once made. */
  get assets() { return this.#assets; }

  connectedCallback() {
    if (this.#built) return;
    this.#built = true;
    if (!styled) { document.head.append(Object.assign(document.createElement('style'), { textContent: CSS })); styled = true; }
    const words = [...this.childNodes];
    const frame = Object.assign(document.createElement('div'), { className: 'frame' });
    const stage = Object.assign(document.createElement('div'), { className: 'stage' });
    const reading = Object.assign(document.createElement('div'), { className: 'reading' });
    const panel = Object.assign(document.createElement('div'), { className: 'panel' });
    const wait = Object.assign(document.createElement('p'), { className: 'wait', textContent: 'Drawing the veranda.' });
    this.#flowP = words.find(w => w.nodeType === 1 && w.hasAttribute('data-flow')) ?? null;
    panel.append(...words.filter(w => w !== this.#flowP));
    const lensView = Object.assign(document.createElement('canvas'), { className: 'lens-view' }); lensView.setAttribute('aria-hidden', 'true');
    const lensBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'lens-btn', textContent: 'Look through the glass' }); lensBtn.setAttribute('aria-pressed', 'false');
    panel.prepend(lensView); panel.append(lensBtn);
    lensBtn.addEventListener('click', () => this.#setLens({ '': 'monsoon', monsoon: 'dusk', dusk: '' }[this.#lens]));
    const notesLayer = Object.assign(document.createElement('div'), { className: 'notes' });
    const list = Object.assign(document.createElement('ul'), { className: 'notes-list' }); list.setAttribute('aria-label', 'Notes on the veranda'); list.hidden = true;
    reading.append(panel); stage.append(wait, notesLayer); frame.append(stage, reading);
    this.append(frame, list);
    this.#status = Object.assign(document.createElement('div'), { className: 'vh' }); this.#status.setAttribute('role', 'status');
    this.append(this.#status);
    this.#els = { frame, stage, reading, panel, wait, lensView, lensBtn, notesLayer, list, toggle: Object.assign(document.createElement('button'), { hidden: true }) };
    this.#d = parseDepth(this.getAttribute('pane-depth'));
    this.#reg = readRegister(this);
    this.dataset.register = this.#reg;
    this.#off.push(observeRegister(this, s => this.#onRegister(s)));
    const ro = new ResizeObserver(() => this.#layout());
    ro.observe(stage);
    this.#off.push(() => ro.disconnect());
    this.#setDepth(this.#d, { emit: false, focus: false });
    this.#init();
    if (this.hasAttribute('pane-turn')) void this.#turnOn();
  }
  disconnectedCallback() {
    this.#off.splice(0).forEach(f => f()); cancelAnimationFrame(this.#lensRaf); cancelAnimationFrame(this.#noteRaf); this.#noteRaf = 0; this.#walkSet(false); this.#matka?.destroy(); this.#matka = null;
    this.#mv?.destroy(); this.#mv = null;
    this.#turnOff();
    cancelAnimationFrame(this.#raf); clearTimeout(this.#maskTimer); clearTimeout(this.#arrT); clearTimeout(this.#camT); clearTimeout(this.#movT); this.#camT = 0; clearTimeout(this.#tween);
    if (this.#maskUrl) URL.revokeObjectURL(this.#maskUrl);
    this.#assets?.release?.();
    this.#built = false;
  }
  attributeChangedCallback(name, _, now) {
    if (!this.#built) return;
    if (name === 'pane-depth') this.#setDepth(parseDepth(now), { emit: false });
    if (name === 'words-at') this.#mv?.attr(now);
    if (name === 'lens' && this.dataset.ready !== undefined) this.#setLens(now || '');
    if (name === 'walk' && this.dataset.ready !== undefined) this.#walkSet(now !== null);
    if (name === 'pane-turn') { if (now === null) this.#turnOff(); else void this.#turnOn(); }
  }

  // ── building the picture ──────────────────────────────────────────────────
  async #init() {
    const { stage, wait } = this.#els;
    // the smaller three, when the vendored build is there (decision 0017); the page's own import map is the fallback
    const [{ setThreeLoader }] = await Promise.all([import('../../stage3d/stage3d.js'), import('../../stage3d/depth-photo/depth-photo.js')]);
    setThreeLoader(() => import('../../stage3d/vendor/three.named.js'));
    const mood = this.getAttribute('mood') || (isDark(this) ? 'dusk' : 'day');
    const a = this.#assets = await verandaAssets({ mood });
    const still = await new Promise(r => a.look.toBlob(r, 'image/png'));
    const alt = this.getAttribute('alt') || 'A drawing of a Goan veranda seen along its length: laterite pillars and a built-in seat on the right, a lime-washed wall with a teak door and a shuttered window on the left, a brass lamp hanging from the roof, and the garden and paddy beyond.';
    const img = Object.assign(new Image(), { src: URL.createObjectURL(still), alt });
    const drawn = a.look; drawn.dataset.treatment = 'drawn';
    const dp = this.#dp = document.createElement('sg-depth-photo');
    for (const [k, v] of Object.entries({ depth: a.depth, layers: a.layers, treatment: 'drawn', sea: '0', focus: String(this.#d), 'dolly-path': '0 -0.02 0.6 0', keep: '0.5 0.5' })) dp.setAttribute(k, v);
    dp.append(img, drawn);
    wait.replaceWith(dp);
    dp.addEventListener('sg-ready', () => { this.#onReady(); }, { once: true });
    dp.addEventListener('sg-tier', e => { this.dataset.tier = e.detail.tier; });
  }

  async #onReady() {
    this.dataset.ready = '';
    this.#layout();
    await this.#attachMovable();
    // the words start where they can be read: if the place at home is behind something, they come forward before anyone sees them
    this.#settle({ quiet: true });
    this.#scheduleMask(true);
    this.#lensOk();
    if (this.getAttribute('lens')) this.#setLens(this.getAttribute('lens'));
    this.#renderNotes();
    if (this.hasAttribute('walk')) this.#walkSet(true);
    this.addEventListener('sg-flow', () => { this.#camSoon(); this.#arrangeSoon(); });
    const set = this.#dp.set.bind(this.#dp);
    this.#dp.set = params => { set(params); this.#camAt = performance.now(); this.#moving(); this.#camSoon(); };
    this.#camTick();
    this.#flowOn().then(() => this.#arrangeSoon(0));
    this.dispatchEvent(new CustomEvent('sg-ready', { bubbles: true, composed: true }));
  }

  async #attachMovable() {
    if (this.#mv) return;
    const { attach } = await import('../../core/movable.js');
    if (!this.#built || this.#mv) return;
    const { frame, stage, panel, toggle } = this.#els;
    this.#mv = attach(this, { root: this, els: { stage, panel, toggle }, register: () => this.#reg, measure: () => this.#measure() });
    const grip = panel.querySelector('.grip');
    grip?.addEventListener('keydown', e => this.#gripKey(e));
    grip?.addEventListener('wheel', e => this.#gripWheel(e), { passive: false });
    // Home puts the words back where they started: the depth too
    this.addEventListener('sg-words-moved', e => { if (e.detail?.home) this.#setDepth(DEPTH.home, { say: false }); this.#settle(); });
    this.#measure();
    void frame;
  }

  // ── layout, register ──────────────────────────────────────────────────────
  #onRegister(s) {
    this.#reg = s.register; this.dataset.register = s.register;
    this.#mv?.sync(); this.#scheduleMask(true); this.#lensOk();
    this.#turn?.setReduced(reduced()); this.#turn?.setRegister(this.#reg);
    if (this.dataset.ready !== undefined) this.#flowOn();
  }
  #layout() {
    const { frame, stage, panel } = this.#els, w = stage.clientWidth;
    this.#sz = { w, h: stage.clientHeight }; // read here, where the browser has just laid the stage out, and never per frame: a read after a style write forces a layout
    if (!w) return;
    const home = frame.classList.contains('stacked') ? false : panel.offsetHeight / stage.clientHeight > 0.45;
    frame.classList.toggle('stacked', w < 560 || home);
    this.#lensOk();
    this.#measure();
    this.#camSoon();
  }
  #measure() {
    if (!this.#els) return;
    this.#mv?.sync();
    this.#positionMask();
  }

  // ── the pot and its paragraph ────────────────────────────────────────────
  get matka() { return this.#matka; }
  /** Set the data-flow paragraph round the pot: live (three.js) in warm and playful with motion, a still otherwise. Flat below the picture when stacked. */
  async #flowOn() {
    const para = this.#flowP, { frame, notesLayer } = this.#els;
    if (!para) return;
    this.#matka?.destroy(); this.#matka = null;
    if (frame.classList.contains('stacked')) { para.style.cssText = ''; para.dataset.flat = ''; this.#els.list.before(para); return; }
    delete para.dataset.flat;
    const live = this.#dp.tier === 'live' && this.#reg !== 'quiet' && !reduced();
    const { attachMatka } = await import('./matka-view.js');
    if (!this.#built) return;
    this.#matka = await attachMatka(this, { stage: this.#els.stage, layer: notesLayer, para, dp: this.#dp, mood: this.getAttribute('mood') || (isDark(this) ? 'dusk' : 'day'), live });
    this.dataset.flow = live ? 'live' : 'still';
  }

  // ── notes ─────────────────────────────────────────────────────────────────
  /** The places a note can stick to, each with its picture place and the surface's depth. */
  get anchors() { return ANCHORS.map(anchorPoint); }
  /** The words a note can carry: notes hold an index into this list, so a postcard carries ids, never words. */
  get noteTexts() { return [...this.#noteTexts]; }
  set noteTexts(v) { this.#noteTexts = Array.isArray(v) ? v.map(String) : []; this.#renderNotes(); }
  /** The notes as [{ anchor, text }] (text is an index into noteTexts). */
  get notes() { return this.#notes.map(({ anchor, text }) => ({ anchor, text })); }
  set notes(list) { this.#notes = (Array.isArray(list) ? list : []).filter(n => ANCHORS.some(a => a.id === n.anchor)).map(n => ({ id: this.#uid++, anchor: n.anchor, text: Number(n.text) || 0 })); this.#renderNotes(); this.#notesChanged(false); }
  addNote({ anchor, text = 0 }) {
    if (!ANCHORS.some(a => a.id === anchor)) return null;
    const n = { id: this.#uid++, anchor, text: Number(text) || 0 };
    this.#notes.push(n); this.#renderNotes(); this.#notesChanged(true, `Note put on ${this.#label(anchor)}.`);
    return n.id;
  }
  removeNote(id) {
    const i = this.#notes.findIndex(n => n.id === id);
    if (i < 0) return;
    const [n] = this.#notes.splice(i, 1); this.#renderNotes(); this.#notesChanged(true, `Note taken off ${this.#label(n.anchor)}.`);
  }
  #label(id) { return ANCHORS.find(a => a.id === id)?.label ?? id; }
  #notesChanged(say, said) {
    if (say && said) this.#say(said);
    this.dispatchEvent(new CustomEvent('sg-notes-changed', { bubbles: true, composed: true, detail: { notes: this.notes } }));
  }
  #renderNotes() {
    const els = this.#els; if (!els) return;
    const { notesLayer, list } = els, texts = this.#noteTexts;
    const seen = new Set();
    for (const n of this.#notes) {
      seen.add(n.id);
      let el = this.#noteEls.get(n.id);
      if (!el) {
        el = Object.assign(document.createElement('aside'), { className: 'note' });
        const grip = Object.assign(document.createElement('button'), { type: 'button', className: 'note-grip', textContent: '\u2725' });
        const p = document.createElement('p');
        el.append(p, grip);
        this.#noteEls.set(n.id, el); notesLayer.append(el);
        grip.addEventListener('pointerdown', e => this.#noteDown(e, n.id, el));
        grip.addEventListener('keydown', e => this.#noteKeydown(e, n.id));
      }
      el.dataset.anchor = n.anchor;
      const label = this.#label(n.anchor);
      el.querySelector('p').textContent = texts[n.text] ?? '';
      el.setAttribute('aria-label', 'Note on ' + label);
      el.querySelector('.note-grip').setAttribute('aria-label', 'Move this note to another place. Now on ' + label + '. Arrow keys choose the next place');
    }
    for (const [id, el] of this.#noteEls) if (!seen.has(id)) { el.remove(); this.#noteEls.delete(id); }
    // the words, always as a plain list too: a note in the picture is never the only copy
    list.hidden = !this.#notes.length;
    list.replaceChildren(...this.#notes.map(n => {
      const li = document.createElement('li');
      li.append(document.createTextNode('On ' + this.#label(n.anchor) + ': ' + (texts[n.text] ?? '')));
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Remove' }); b.setAttribute('aria-label', 'Remove the note on ' + this.#label(n.anchor));
      b.addEventListener('click', () => this.removeNote(n.id));
      li.append(b); li.dataset.note = n.id;
      return li;
    }));
    this.#noteKey = '';
    this.#placeNotes();
    this.#arrangeSoon();
  }
  /**
   * The camera as a key: where the picture's corners land at the near and far ends of the depth range, to half a pixel. When it
   * changes, everything that stands in the picture is looked at again: the notes, the mask, and the words' place (throttled).
   */
  #camKey() {
    const dp = this.#dp, o = [dp.place(0, 0, 0), dp.place(1, 1, 0), dp.place(0, 0, 1), dp.place(1, 1, 1)];
    return o.flat().map(v => Math.round(v * 2)).join() + '|' + this.#sz.w + 'x' + this.#sz.h;
  }
  /**
   * Look at the camera once a frame at most, and only after something set it (depth-photo's set() is wrapped, so every caller counts): a
   * loop that read place() every frame, moving or not, made the GPU raster stall for a second at a random moment on this machine's
   * integrated GPU, while the camera walked.
   */
  /** data-moving is on the element while the camera is being set and for a moment after (the pot's pane drops its blur meanwhile). */
  #moving() {
    if (!this.hasAttribute('data-moving')) this.setAttribute('data-moving', '');
    clearTimeout(this.#movT);
    this.#movT = setTimeout(() => this.removeAttribute('data-moving'), 260);
  }
  #camSoon() {
    if (this.#noteRaf || this.#camT || !this.#dp || !this.#built) return;
    // notes must follow the camera frame by frame; without notes there is only the mask and the words' place, which can wait a moment
    if (this.#notes.length) this.#noteRaf = requestAnimationFrame(() => { this.#noteRaf = 0; this.#camTick(); });
    else this.#camT = setTimeout(() => { this.#camT = 0; this.#camTick(); }, 60);
  }
  #camTick() {
    if (!this.#dp || !this.#built || !this.#els) return;
    const k = this.#camKey();
    if (k !== this.#cam) { this.#cam = k; this.#tab = null; this.#hid.clear(); this.#scheduleMask(); this.#arrangeSoon(); }
    this.#placeNotes();
    this.#turnPointer();
  }
  /** Keep every note on its surface: where place() puts the anchor now. A note stands where it touches its anchor and no other words. */
  #placeNotes() {
    const dp = this.#dp; if (!dp || !this.#notes.length) { this.#noteBoxes = []; return; }
    const flow = this.#matka?.rect() ?? null;
    const key = this.#cam + '|' + this.#notes.map(n => n.id + n.anchor + n.text).join() + '|' + (flow ? [flow.x, flow.y, flow.w, flow.h].map(v => Math.round(v)).join() : '');
    if (key === this.#noteKey && !this.#drag) return;
    this.#noteKey = key;
    const stage = { w: this.#sz.w, h: this.#sz.h }, placed = [];
    for (const n of this.#notes) {
      const el = this.#noteEls.get(n.id); if (!el) continue;
      if (this.#drag?.id === n.id) { placed.push(this.#boxOf(el)); continue; }
      const p = this.anchors.find(x => x.id === n.anchor), [x, y] = dp.place(p.u, p.v, p.d);
      el.style.setProperty('--sg-note-scale', paneScale(p.d).toFixed(3));
      const sk = n.id + '|' + n.anchor + '|' + n.text + '|' + stage.w, size = this.#noteSize.get(sk) ?? (this.#noteSize.set(sk, { w: el.offsetWidth, h: el.offsetHeight }), this.#noteSize.get(sk)), at = placeNote(x, y, size, { others: [...(flow ? [flow] : []), ...placed], stage });
      el.style.transform = 'translate(' + at.x.toFixed(1) + 'px,' + at.y.toFixed(1) + 'px)';
      el.style.setProperty('--tail', at.tail.toFixed(1) + 'px');
      el.dataset.side = at.side; el.dataset.x = x.toFixed(1); el.dataset.y = y.toFixed(1);
      placed.push({ x: at.x, y: at.y, w: size.w, h: size.h });
    }
    this.#noteBoxes = placed;
  }
  #boxOf(el) { const s = this.#els.stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; }
  #noteKeydown(e, id) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = this.#notes.find(x => x.id === id), next = cycleAnchor(ANCHORS, n.anchor, dir);
    this.#stick(id, next.id, true);
    this.#noteEls.get(id)?.querySelector('.note-grip')?.focus();
  }
  #stick(id, anchor, say) {
    const n = this.#notes.find(x => x.id === id); if (!n) return;
    n.anchor = anchor; this.#renderNotes(); this.#notesChanged(say, `Note moved to ${this.#label(anchor)}.`);
    this.#noteEls.get(id)?.querySelector('.note-grip')?.focus();
  }
  #noteDown(e, id, el) {
    if (e.button) return;
    e.preventDefault();
    const grip = e.currentTarget, s = this.#els.stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    grip.setPointerCapture(e.pointerId);
    this.#drag = { id, dx: e.clientX - r.left, dy: e.clientY - r.bottom };
    el.classList.add('dragging');
    const move = ev => { el.style.transform = 'translate(' + (ev.clientX - s.left - this.#drag.dx).toFixed(1) + 'px,' + (ev.clientY - s.top - this.#drag.dy - r.height).toFixed(1) + 'px)'; };
    const up = ev => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      el.classList.remove('dragging'); this.#drag = null;
      // the depth map under the drop decides which surface the note belongs to
      const a = this.#assets, a0 = this.#dp.place(0, 0, DEPTH.home), a1 = this.#dp.place(1, 1, DEPTH.home), [u, v] = photoAt(a0, a1)(ev.clientX - s.left, ev.clientY - s.top);
      const hit = nearestAnchor(u, v, a ? byteAt(a.depthBytes, a.width, a.height, u, v) : 0, this.anchors);
      const n = this.#notes.find(x => x.id === id);
      if (hit && hit.anchor.id !== n.anchor) this.#stick(id, hit.anchor.id, true); else { this.#renderNotes(); this.#say('Note stays on ' + this.#label(n.anchor) + '.'); }
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  }

  // ── the walk ───────────────────────────────────────────────────────────────
  /** Scrolling dollies the camera down the veranda, stopping at each note; with reduced motion or in quiet, one still per stop. */
  #walkSet(on) {
    this.toggleAttribute('data-walk', on);
    if (this.#walk) { removeEventListener('scroll', this.#walk.onScroll); removeEventListener('resize', this.#walk.onScroll); this.#walk = null; }
    if (!on) { this.style.removeProperty('--sg-walk-stops'); return; }
    const onScroll = () => this.#walkTick();
    this.#walk = { onScroll };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    this.#walkTick();
  }
  #walkPlan() {
    const ids = [...new Set(this.#notes.map(n => n.anchor))], anchors = this.anchors.filter(a => ids.includes(a.id));
    return walkPlan(anchors);
  }
  #walkTick() {
    if (!this.#walk || !this.#dp) return;
    const plan = this.#walkPlan();
    this.style.setProperty('--sg-walk-stops', String(Math.max(1, plan.length)));
    const range = this.offsetHeight - this.#els.frame.offsetHeight, p = range > 0 ? Math.min(1, Math.max(0, -this.getBoundingClientRect().top / range)) : 0;
    // the 2D tier repaints the whole picture on the CPU for every change of camera (47 ms a frame against 17 on this machine's software renderer), so
    // there, as in quiet and with reduced motion, the walk steps between one still per stop and is not repainted between them
    const w = walkAt(p, plan), still = this.#reg === 'quiet' || reduced() || this.#dp.tier === '2d';
    const at = plan[w.index], dolly = still ? (at?.dolly ?? 0) : w.dolly, focus = still ? (at?.d ?? DEPTH.home) : w.focus;
    cancelAnimationFrame(this.#raf);
    const was = this.#walk.set;
    if (!was || Math.abs(was.dolly - dolly) > 1e-4 || Math.abs(was.focus - focus) > 1e-4) { this.#walk.set = { dolly, focus }; this.#dp.set({ dolly, focus }); }
    for (const [id, el] of this.#noteEls) { const n = this.#notes.find(x => x.id === id); el.toggleAttribute('data-active', !!at && n?.anchor === at.id && w.holding); }
    for (const li of this.#els.list.children) { const n = this.#notes.find(x => String(x.id) === li.dataset.note); if (at && n?.anchor === at.id && w.holding) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); }
    this.dataset.walkStop = String(w.index);
    if (w.index !== this.#walk.last && w.holding) { this.#walk.last = w.index; this.#say('Stop ' + (w.index + 1) + ' of ' + plan.length + ': ' + this.#label(at.id) + '.'); }
  }

  // ── the lens ──────────────────────────────────────────────────────────────
  /** The lens is for playful, with motion, on a stage wide enough to float the pane; anywhere else the glass stays clear. */
  #lensOk() {
    const ok = this.#reg === 'playful' && !reduced() && !this.#els.frame.classList.contains('stacked') && !!this.#dp;
    this.toggleAttribute('data-lens-ok', ok);
    if (!ok && this.#lens) this.#setLens('');
  }
  get lens() { return this.#lens; }
  async #setLens(mood) {
    const { panel, lensBtn } = this.#els;
    if (mood && !this.hasAttribute('data-lens-ok')) mood = '';
    if (mood === this.#lens) return;
    if (!mood) {
      this.#lens = ''; panel.classList.remove('lens'); cancelAnimationFrame(this.#lensRaf);
      lensBtn.setAttribute('aria-pressed', 'false'); lensBtn.textContent = 'Look through the glass';
      this.#say('The glass is clear again.'); this.#scheduleMask(); this.#arrangeSoon(); return;
    }
    lensBtn.setAttribute('aria-busy', 'true');
    if (!this.#lensLooks.has(mood)) { const a = await verandaAssets({ mood }); this.#lensLooks.set(mood, a.look); a.release(); }
    lensBtn.removeAttribute('aria-busy');
    if (!this.#built || !this.hasAttribute('data-lens-ok')) return;
    this.#lens = mood; panel.classList.add('lens');
    lensBtn.setAttribute('aria-pressed', 'true'); lensBtn.textContent = mood === 'monsoon' ? 'The monsoon. Press for dusk' : 'Dusk. Press for clear glass';
    this.#say('Looking through the glass at the veranda ' + (mood === 'monsoon' ? 'in the monsoon' : 'at dusk') + '.');
    this.#lensKey = ''; this.#lensLoop(); this.#arrangeSoon();
  }
  #lensLoop() {
    cancelAnimationFrame(this.#lensRaf);
    if (!this.#lens) return;
    this.#drawLens();
    this.#lensRaf = requestAnimationFrame(() => this.#lensLoop());
  }
  /** The other still, cropped to the pane's rect on the picture and drawn into the pane; redrawn only when the pane or the camera moved. */
  #drawLens() {
    const { stage, panel, lensView } = this.#els, look = this.#lensLooks.get(this.#lens), dp = this.#dp;
    if (!look || !dp) return;
    const s = stage.getBoundingClientRect(), p = panel.getBoundingClientRect(), a = dp.place(0, 0, DEPTH.home), b = dp.place(1, 1, DEPTH.home);
    const key = [p.left - s.left, p.top - s.top, p.width, p.height, a[0], a[1], b[0], b[1]].map(v => v.toFixed(1)).join() + this.#lens;
    if (key === this.#lensKey) return;
    this.#lensKey = key;
    const k = Math.min(2, window.devicePixelRatio || 1), cw = Math.max(1, Math.round(p.width * k)), ch = Math.max(1, Math.round(p.height * k));
    if (lensView.width !== cw || lensView.height !== ch) { lensView.width = cw; lensView.height = ch; }
    const kx = look.width / (b[0] - a[0]), ky = look.height / (b[1] - a[1]);
    lensView.getContext('2d').drawImage(look, (p.left - s.left - a[0]) * kx, (p.top - s.top - a[1]) * ky, p.width * kx, p.height * ky, 0, 0, cw, ch);
  }

  // ── the pane's depth ──────────────────────────────────────────────────────
  #setDepth(d, { emit = true, dir = 0, focus = true, say = true } = {}) {
    this.#d = d;
    const { panel } = this.#els;
    panel.style.setProperty('--sg-pane-scale', paneScale(d).toFixed(3));
    if (focus) this.#rack(d);
    this.#scheduleMask();
    if (this.#built && this.#mv) this.#mv.sync();
    if (emit) {
      if (say) this.#say(depthSaid(d, dir));
      this.dispatchEvent(new CustomEvent('sg-pane-depth', { bubbles: true, composed: true, detail: { d, said: depthSaid(d, dir) } }));
    }
  }
  #say(t) { if (this.#status) this.#status.textContent = t; }
  /** Focus follows the words: warm racks to the pane's depth over a moment, playful and warm with reduced motion never wait. */
  #rack(d) {
    const dp = this.#dp; if (!dp || this.#walk) return;
    cancelAnimationFrame(this.#raf);
    const from = dp.params.focus, t0 = performance.now(), dur = this.#reg === 'quiet' || reduced() ? 0 : 260;
    if (!dur) return dp.set({ focus: d });
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = p * p * (3 - 2 * p); dp.set({ focus: from + (d - from) * e }); if (p < 1) this.#raf = requestAnimationFrame(step); };
    this.#raf = requestAnimationFrame(step);
  }
  #gripKey(e) {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    const s = stepDepth(this.#d, e.key, e.shiftKey);
    if (!s.moved) return this.#say(`Words are as ${s.dir > 0 ? 'far forward' : 'far back'} as they go.`);
    this.#setDepth(s.d, { dir: s.dir });
    this.#settleSoon();
  }
  #gripWheel(e) {
    e.preventDefault();
    const s = stepDepth(this.#d, e.deltaY < 0 ? 'wheelUp' : 'wheelDown', e.shiftKey);
    if (s.moved) { this.#setDepth(s.d, { dir: s.dir }); this.#settleSoon(); }
  }

  // ── the turn: the words lean a little toward the camera, and settle back ───
  /**
   * Mount core's orient on an inner layer inside the panel, and nowhere else: the occlusion mask is on the panel and must not travel with
   * the turn. Loaded only for a page that asks (the `pane-turn` attribute), so a page without it fetches nothing and behaves as before.
   */
  async #turnOn() {
    if (this.#turn || !this.#built || !this.#els || !this.hasAttribute('pane-turn')) return;
    const { createOrient } = await import('../../core/orient.js');
    if (this.#turn || !this.#built || !this.hasAttribute('pane-turn')) return;
    const { panel, stage, lensBtn } = this.#els;
    const tw = Object.assign(document.createElement('div'), { className: 'turn' });
    for (const node of [...panel.childNodes]) if (!(node.nodeType === 1 && node.matches('.grip,.lens-view,.lens-btn'))) tw.append(node);
    panel.insertBefore(tw, lensBtn); // the words keep their place, before the controls
    this.#tw = tw;
    this.#turn = createOrient({ layer: tw, stage, register: this.#reg, reduced: reduced(), perspective: 900, onSaid: t => this.#say(t) });
  }
  /** Off: the applier is destroyed, the words layer is identity again, and the wrapper goes; the DOM is as it was without the attribute. */
  #turnOff() {
    this.#turn?.destroy(); this.#turn = null;
    const tw = this.#tw; if (!tw) return;
    this.#tw = null;
    for (const node of [...tw.childNodes]) this.#els.panel.insertBefore(node, this.#els.lensBtn);
    tw.remove();
  }
  /** The camera's pan as a synthetic pointer in [-1, 1] each way, handed to the settle at most once a frame (a no-op where the register does not follow a pointer). */
  #turnPointer() {
    const t = this.#turn, dp = this.#dp, { w, h } = this.#sz;
    if (!t || !dp || !w) return;
    const [x, y] = dp.place(0.5, 0.5, DEPTH.home), cl = v => Math.max(-1, Math.min(1, v));
    t.pointer([cl((x - w / 2) / (w / 2)), cl((y - h / 2) / (h / 2))]);
  }

  // ── what hides the pane ───────────────────────────────────────────────────
  /** Where a photo pixel at each depth byte lands on the stage for the camera as it is now (two corners each; made once per camera). */
  #corners() {
    if (this.#tab) return this.#tab;
    const dp = this.#dp, tab = new Array(256);
    for (let b = 0; b < 256; b++) tab[b] = [dp.place(0, 0, b / 255), dp.place(1, 1, b / 255)];
    return (this.#tab = tab);
  }
  /**
   * What hides the pane at depth d, for the camera now: the depth map's near pixels splatted to where the camera puts them (a
   * walk moves the near things more than the far ones). { grid, cw, ch, sw, sh, hid(x, y) }, memoised per camera and depth.
   */
  #hiddenAt(d) {
    const a = this.#assets, sw = this.#sz.w, sh = this.#sz.h, q = Math.round(Math.min(1, Math.max(0, d)) * 100);
    const key = q + '|' + sw + 'x' + sh, got = this.#hid.get(key);
    if (got) return got;
    if (this.#hid.size > 70) this.#hid.clear();
    const cw = Math.max(2, Math.ceil(sw / 3)), ch = Math.max(2, Math.ceil(sh / 3)), tab = this.#corners();
    const grid = hiddenGrid({ bytes: a.depthBytes, w: a.width, h: a.height, cut: cutByte(q / 100), corners: b => tab[b], cw, ch, sw, sh, step: 2 });
    const out = { grid, cw, ch, sw, sh, hid: hiddenIn(grid, cw, ch, sw, sh) };
    this.#hid.set(key, out);
    return out;
  }
  /**
   * The mask is remade when the camera is still, never while it moves: changing the pane's mask (a PNG or a vector image alike) while the
   * picture animated made this machine's integrated GPU stall a whole second in raster, at a random moment, in six frames out of ten. So
   * during a walk the mask is the last still's, and the words' place and depth are kept right by the settle (which works from the grid,
   * not from the mask); a moment after the camera stops the mask is exact again.
   */
  #scheduleMask(now = false) {
    const wait = Math.max(now ? 0 : 60, 180 - (performance.now() - this.#camAt));
    if (this.#maskTimer && !now) return;
    clearTimeout(this.#maskTimer);
    this.#maskTimer = setTimeout(() => { this.#maskTimer = 0; if (performance.now() - this.#camAt < 170) return this.#scheduleMask(true); this.#buildMask(); }, wait);
  }
  async #buildMask() {
    const { panel } = this.#els, a = this.#assets, dp = this.#dp;
    if (!a || !dp) return;
    if (this.#reg === 'quiet' || panel.closest('.stacked')) { panel.style.maskImage = panel.style.webkitMaskImage = 'none'; this.#maskFor = null; return; }
    if (!this.#sz.w) return;
    const d = this.#d, { grid, cw, ch, sw, sh } = this.#hiddenAt(d);
    // a vector mask (the shown cells as rects), not a PNG: nothing to decode or upload when the camera moves it
    const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="' + sw + '" height="' + sh + '" viewBox="0 0 ' + cw + ' ' + ch + '" preserveAspectRatio="none"><path d="' + shownPath(grid, cw, ch) + '"/></svg>'], { type: 'image/svg+xml' });
    if (!this.#built) return;
    const url = URL.createObjectURL(blob);
    if (this.#maskUrl) URL.revokeObjectURL(this.#maskUrl);
    this.#maskUrl = url; this.#maskFor = { sw, sh, d };
    panel.style.maskImage = panel.style.webkitMaskImage = `url(${url})`;
    this.#positionMask();
    this.dataset.maskDepth = d.toFixed(3);
  }
  /** The mask is the whole stage; keep it still in stage space while the pane moves under it. */
  #positionMask() {
    const { stage, panel } = this.#els, f = this.#maskFor;
    if (!f) return;
    const s = stage.getBoundingClientRect(), p = panel.getBoundingClientRect();
    const pos = `${(s.left - p.left).toFixed(1)}px ${(s.top - p.top).toFixed(1)}px`, size = `${f.sw}px ${f.sh}px`;
    panel.style.maskSize = panel.style.webkitMaskSize = size;
    panel.style.maskPosition = panel.style.webkitMaskPosition = pos;
  }

  /** The words' line boxes in stage px: the real lines of real text, one rect per line, in the plane's own space when the words lean. */
  #lineRects() {
    const { stage, panel } = this.#els, s = stage.getBoundingClientRect(), out = [];
    for (const el of (this.#tw ?? panel).children) {
      if (el.matches('.grip,.lens-view,.lens-btn')) continue;
      const r = document.createRange(); r.selectNodeContents(el);
      for (const q of r.getClientRects()) if (q.width > 1) out.push(this.#flat(q, s));
    }
    return out;
  }
  /** A measured client rect back in the flat plane, in stage px: through orient.unproject under a turn, so the 15% rule is judged in the plane's own space (decision 0022). */
  #flat(q, s) {
    if (this.#turn) q = this.#turn.unproject({ left: q.left, top: q.top, width: q.width, height: q.height });
    return { x: q.left - s.left, y: q.top - s.top, w: q.width, h: q.height };
  }
  #panelRect() { const s = this.#els.stage.getBoundingClientRect(), p = this.#els.panel.getBoundingClientRect(); return { x: p.left - s.left, y: p.top - s.top, w: p.width, h: p.height }; }
  /** The other words the pane must keep clear of: the notes' boxes and the pot's paragraph (stage px). */
  #others() { const flow = this.#matka?.rect(); return [...this.#noteBoxes.map(b => ({ ...b, panelPad: -8 })), ...(flow ? [{ ...flow, pad: GLASS_APART }] : [])]; }
  /** The covered share of the lines' area at the pane's depth. */
  coveredShare(d = this.#d) {
    const pts = samplePoints(this.#lineRects(), 4), hid = this.#hiddenAt(d).hid;
    let n = 0; for (const [x, y] of pts) if (hid(x, y)) n++;
    return pts.length ? n / pts.length : 0;
  }
  /** The most covered line's share (rule 3 holds line by line), for the camera as it is now. */
  worstLineShare(d = this.#d) { return Math.max(0, ...lineShares(this.#lineRects(), this.#hiddenAt(d).hid, 4)); }
  /** The rects of every set of words on the stage, by surface, in stage px: { pane, flow, notes } (lines for the pane and the pot). */
  surfaces() {
    const st = this.#els.stage.getBoundingClientRect(), flow = this.#matka?.lines?.() ?? [];
    return { pane: this.#lineRects(), flow, notes: this.#notes.map(n => this.#noteEls.get(n.id)).filter(Boolean).map(el => this.#boxOf(el)), stage: { w: st.width, h: st.height } };
  }
  #arrangeSoon(ms = 120) {
    if (this.#arrT) return;
    this.#arrT = setTimeout(() => { this.#arrT = 0; this.#settle({ quiet: true }); }, ms);
  }
  #settleSoon() { clearTimeout(this.#tween); this.#tween = setTimeout(() => this.#settle(), 350); }
  /**
   * The words come to rest where they can be read, on release and whenever the camera, the lens, a note or the pot changes what is
   * in front of them: no line more than 15% hidden and no line over another set of words. It stays if it can, comes forward if
   * that is enough, and moves only when it must (settleSpot). A hand on the grip is never argued with.
   */
  #settle({ quiet = false } = {}) {
    const { stage, panel, frame } = this.#els;
    if (this.#reg === 'quiet' || frame.classList.contains('stacked') || !this.#assets || !this.#mv || panel.classList.contains('moving')) return;
    let moved = false, upTotal = 0, last = null; const d0 = this.#d;
    for (let pass = 0; pass < 3; pass++) {
      const lines = this.#lineRects(), pr = this.#panelRect(), sw = this.#sz.w, sh = this.#sz.h;
      const r = last = settleSpot({ lines, panel: pr, stage: { w: sw, h: sh }, obstacles: this.#others(), hiddenAt: d => this.#hiddenAt(d).hid, d: this.#d, limit: quiet ? 0.06 : 0.15 }); // the words a person put down keep the 15% they were promised; the words that arrange themselves (load, camera, lens) do not clip a letter
      if (!r.moved) break;
      moved = true;
      if (r.dx || r.dy) {
        const rx = Math.max(1, sw - pr.w - 28), ry = Math.max(1, sh - pr.h - 28), cl = v => Math.min(1, Math.max(0, v));
        this.#mv.attr(cl((pr.x + r.dx - 14) / rx).toFixed(3) + ' ' + cl((pr.y + r.dy - 14) / ry).toFixed(3));
        upTotal += Math.hypot(r.dx, r.dy);
      }
      if (r.d !== this.#d) this.#setDepth(r.d, { dir: 1, say: false, focus: !quiet });
      else this.#measure();
    }
    if (!moved) return;
    this.dataset.settled = this.#d.toFixed(3);
    this.#scheduleMask(true);
    if (quiet) { if (!this.#walk) this.#dp.set({ focus: this.#d }); return; }
    const fwd = this.#d > d0 + 1e-6, said = 'Words ' + [fwd && 'brought forward so nothing stands in front of them', upTotal > 1 && 'moved clear of other words'].filter(Boolean).join(' and ') + '.';
    this.#say(said);
    this.dispatchEvent(new CustomEvent('sg-pane-depth', { bubbles: true, composed: true, detail: { d: this.#d, settled: true, moved: upTotal > 1, said, free: last?.free !== false } }));
  }
}

if (!customElements.get('sg-veranda-stage')) customElements.define('sg-veranda-stage', SgVerandaStage);
