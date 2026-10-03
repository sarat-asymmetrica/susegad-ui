// <sg-scene>: mounts a scene definition, runs its loop, and keeps it true:
// the still under reduced motion, pause off screen and in hidden tabs, a
// reading layer with a contrast scrim, calm rects, a play/pause toggle, and
// text for every state the drawing shows.

import { loop, createGovernor } from '../engine/index.js';
import { getScene, whenSceneDefined, paramsFromAttributes, mergeParams, coerceSeed, toCamel } from './define-scene.js';
import { observeRegister, registerState } from './register.js';

const CSS = `
:host{display:block;position:relative;container-type:inline-size}
:host([hidden]){display:none}
.frame{display:grid;border-radius:inherit}
.stage,.reading{grid-area:1/1;min-width:0}
.stage{position:relative;align-self:center;width:100%;border-radius:inherit;overflow:hidden;outline:none}
.stage:focus-visible::after{content:"";position:absolute;inset:4px;border-radius:inherit;pointer-events:none;box-shadow:0 0 0 2px #fff,0 0 0 4px var(--sg-focus,Highlight)}
button:focus-visible{outline:2px solid var(--sg-focus,Highlight);outline-offset:2px}
.reading{position:relative;z-index:1;display:grid;place-items:var(--sg-reading-place,end start);padding:var(--sg-reading-inset,clamp(12px,4cqi,40px));pointer-events:none}
.panel{pointer-events:auto;max-width:min(34rem,100%);padding:.85em 1.1em;border-radius:var(--sg-radius-2,8px);
 background:var(--sg-scrim,color-mix(in oklab,Canvas 86%,transparent));color:var(--sg-scrim-ink,var(--sg-text,CanvasText))}
.panel[hidden]{display:none}
.stacked .reading{grid-area:2/1;padding-block:12px 0}
::slotted(:first-child){margin-top:0}::slotted(:last-child){margin-bottom:0}
button{position:absolute;z-index:2;top:10px;right:10px;width:32px;height:32px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;
 background:var(--sg-scrim,color-mix(in oklab,Canvas 80%,transparent));color:var(--sg-scrim-ink,var(--sg-text,CanvasText));opacity:.72;transition:opacity .15s}
button:hover,button:focus-visible{opacity:1}
button[hidden]{display:none}
button svg{width:14px;height:14px;fill:currentColor}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;

const ICON = { pause: '<path d="M3 2h3v12H3zM10 2h3v12h-3z"/>', play: '<path d="M4 2l10 6-10 6z"/>' };
const HELP = 'Arrow keys move your hand over the drawing. Enter or Space acts on it.';
const Base = globalThis.HTMLElement ?? class {};

export class SgScene extends Base {
  #def = null; #renderer = null; #lp = null; #gov = createGovernor();
  #params = {}; #seed = 1; #time = 0; #pending = 0; #epoch = 0;
  #rs = null; #calm = []; #all = []; #extra = new Map(); #placed = ''; #pointer = { x: 0, y: 0, inside: false, down: false, keyboard: false, travel: 0 };
  #want = false; #still = true; #sleeping = false; #settled = false; #onscreen = true; #ready = false;
  #mounted = false; #destroyed = false; #token = 0; #raf = 0; #statusAt = 0; #statusTimer = 0;
  #off = []; #els; #ro = null; #mv = null; #mvLoad = false; #interactive = false; #early = {}; #touched = false; #told = ''; #held = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="frame"><div class="stage" part="stage" role="img"></div>` +
      `<div class="reading" part="reading"><div class="panel" part="panel" hidden><slot></slot></div></div></div>` +
      `<button type="button" part="toggle" aria-label="Pause animation" aria-pressed="false" hidden><svg viewBox="0 0 16 16" aria-hidden="true"></svg></button>` +
      `<div class="vh" role="status"></div><div class="vh" id="help"></div>`;
    const $ = s => root.querySelector(s);
    this.#els = { stage: $('.stage'), panel: $('.panel'), slot: $('slot'), toggle: $('button'), status: $('[role=status]'), help: $('#help') };
    this.#els.toggle.addEventListener('click', () => (this.#want ? this.pause() : this.play()));
    this.#els.slot.addEventListener('slotchange', () => this.#watchSlot());
    this.#listen();
  }

  // ── public API
  get playing() { return !!this.#lp?.playing; }
  get params() { return { ...this.#params }; }
  get seed() { return this.#seed; }
  /** The viewer's intent: true after play(), false after pause() or still(), whatever the viewport. */
  get wanted() { return this.#want; }
  get meta() { return this.#def?.meta ?? null; }
  /** The last pointer the renderer saw, in logical units (0..W, 0..H); null before any. */
  get lastPointer() { const { x, y, inside, down, keyboard } = this.#pointer; return this.#touched ? { x, y, inside, down, keyboard } : null; }
  play() { this.#want = true; this.#still = false; this.#wake(); }
  pause() { this.#want = false; this.#sync(); }
  replay() { this.#time = 0; this.#epoch++; this.play(); }
  reseed(seed) {
    this.#seed = seed ?? (typeof this.#seed === 'number' ? this.#seed + 1 : `${this.#seed}+`);
    this.#time = 0; this.#epoch++; this.#wake(); this.#invalidate();
  }
  set(patch = {}) {
    if (!this.#def) return void Object.assign(this.#early, patch); // applied once the definition arrives
    this.#params = mergeParams(this.#def.params, this.#params, patch);
    this.#status(); this.#wake(); this.#invalidate();
  }
  still() { this.#want = false; this.#still = true; this.#sync(); this.#draw(0); }
  /** Where the words have been moved to as { x, y } (fractions of the free room), or null at home; only with `movable`. */
  get wordsAt() { return this.#mv?.at() ?? null; }
  /** The keep-away list a renderer gets as `calm`: the slotted words' rects plus whatever joined with keepClear, in logical units. A copy. */
  get calm() { return this.#all.map(r => ({ ...r })); }
  /** Anything can join the keep-away list: a rect in logical units, replaced by id, removed with null (decision 0021). */
  keepClear(id, rect) {
    rect && [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) ? this.#extra.set(id, { x: rect.x, y: rect.y, w: rect.w, h: rect.h }) : this.#extra.delete(id);
    this.#merge(); this.#invalidate();
  }
  /** A renderer that sets the slotted words on a surface of its own hides the panel (decision 0019); false gives them back. */
  holdReading(on = true) { if (this.#held !== !!on) { this.#held = !!on; this.#watchSlot(); } }
  destroy() { this.#destroyed = true; this.#teardown(); }

  // ── lifecycle
  connectedMoveCallback() {} // moveBefore(): keep running, no teardown
  static observedAttributes = ['name'];
  attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); } // a name set after connecting
  connectedCallback() { if (!this.#mounted && !this.#destroyed) this.#mount(); }
  disconnectedCallback() {
    // A move (for example into a View Transition) reconnects in the same task: keep running.
    queueMicrotask(() => { if (!this.isConnected) this.#teardown(); });
  }

  async #mount() {
    const token = ++this.#token, name = this.getAttribute('name');
    if (!name) return;
    this.#mounted = true;
    const def = getScene(name) ?? (await whenSceneDefined(name));
    if (token !== this.#token || !this.isConnected) return;
    const { W, H } = def.meta;
    this.#def = def;
    this.#params = mergeParams(def.params, paramsFromAttributes(def.params, a => this.getAttribute(a)), this.#early);
    this.#early = {};
    this.#seed = coerceSeed(this.getAttribute('seed'), def.meta.seed ?? 1);
    this.#time = 0;
    const { stage } = this.#els;
    stage.style.aspectRatio = `${W} / ${H}`;
    this.#off.push(observeRegister(this, s => this.#onRegister(s)));
    this.#rs = null;
    this.#onRegister(null);
    this.#lp = loop((t, dt) => { this.#time += dt + this.#pending; this.#pending = 0; this.#draw(dt); });
    const io = new IntersectionObserver(([e]) => { this.#onscreen = e.isIntersecting; this.#sync(); });
    io.observe(this);
    const ro = new ResizeObserver(() => this.#measure());
    ro.observe(stage);
    this.#ro = ro;
    const mo = new MutationObserver(list => this.#onAttributes(list));
    mo.observe(this, { attributes: true });
    const vis = () => this.#sync();
    document.addEventListener('visibilitychange', vis);
    this.#off.push(() => io.disconnect(), () => ro.disconnect(), () => mo.disconnect(), () => document.removeEventListener('visibilitychange', vis));
    this.#label(); this.#status(); this.#watchSlot(); this.#watchPlace(); this.#movable();
    this.#want = this.#rs.motion !== 'still' && !this.hasAttribute('paused');
    this.#still = !this.#want;
    if (!this.#want) this.#draw(0);
    this.#sync();
  }
  #teardown() {
    this.#token++;
    if (!this.#mounted) return;
    this.#mounted = false; this.#ready = false; this.#told = '';
    this.#lp?.pause(); cancelAnimationFrame(this.#raf); clearTimeout(this.#statusTimer);
    this.#off.splice(0).forEach(f => f());
    this.#renderer?.destroy(); this.#renderer = null; this.#lp = null;
    this.#mv?.destroy(); this.#mv = null;
  }
  // `movable` is its own module (decision 0021): loaded the first time it is asked for, dropped when the attribute goes.
  #movable() {
    if (!this.hasAttribute('movable')) { if (this.#mv) { this.#mv.destroy(); this.#mv = null; this.#measure(); } return; }
    if (this.#mv || this.#mvLoad) return;
    this.#mvLoad = true;
    import('./movable.js').then(m => {
      this.#mvLoad = false;
      if (!this.#mounted || this.#mv || !this.hasAttribute('movable')) return;
      this.#mv = m.attach(this, { root: this.shadowRoot, els: this.#els, register: () => this.#rs.register, measure: () => this.#measure() });
      this.#measure();
    }, () => { this.#mvLoad = false; });
  }

  #makeRenderer() {
    const { W, H } = this.#def.meta, rs = this.#rs;
    this.#renderer?.destroy();
    this.#renderer = this.#def.createRenderer(this.#els.stage, {
      W, H, register: rs.register, motion: rs.motion, seed: this.#seed, governor: this.#gov, scene: this,
      invalidate: () => this.#invalidate(),
      advance: s => { this.#pending += s; this.#wake(); },
    });
  }

  #onRegister(s) {
    const prev = this.#rs, rs = (this.#rs = s ?? registerState(this));
    if (!prev) { this.#makeRenderer(); this.#setMode(); return; }
    if (prev.register !== rs.register || prev.motion !== rs.motion) {
      this.#renderer.setRegister ? this.#renderer.setRegister(rs.register, rs.motion) : this.#makeRenderer();
      this.#setMode(); this.#mv?.sync();
      if (rs.motion === 'still') return this.still();
      if (prev.motion === 'still' && !this.hasAttribute('paused')) return this.replay();
    } else if (prev.theme !== rs.theme) this.#renderer.restyle?.();
    this.#wake(); this.#invalidate();
  }

  #setMode() {
    const { stage, help, toggle } = this.#els, rs = this.#rs;
    const live = this.#def.interactive.includes(rs.register) && rs.motion === 'full' && this.getAttribute('interactive') !== 'false';
    this.#interactive = live;
    stage.setAttribute('role', live ? 'application' : 'img');
    if (live) {
      stage.tabIndex = 0;
      stage.setAttribute('aria-roledescription', 'interactive drawing');
      stage.setAttribute('aria-describedby', 'help');
      help.textContent = this.#def.meta.keys ?? HELP;
    } else {
      stage.removeAttribute('tabindex'); stage.removeAttribute('aria-roledescription'); stage.removeAttribute('aria-describedby');
      help.textContent = '';
    }
    toggle.hidden = true;
  }

  #onAttributes(list) {
    const names = new Set(list.map(m => m.attributeName));
    if (names.has('name')) { this.#teardown(); this.#mount(); return; }
    if (names.has('label')) { this.#label(); this.#status(); }
    if (names.has('movable')) this.#movable();
    if (names.has('words-at')) this.#mv?.attr(this.getAttribute('words-at'));
    if (names.has('interactive') && this.#def) { this.#setMode(); this.#sync(); }
    if (names.has('seed')) this.reseed(coerceSeed(this.getAttribute('seed'), this.#def?.meta.seed ?? 1));
    if (names.has('paused')) this.hasAttribute('paused') ? this.pause() : this.#rs?.motion !== 'still' && this.play();
    const patch = {};
    for (const n of names) if (this.#def?.params[toCamel(n)]) patch[toCamel(n)] = this.getAttribute(n);
    if (Object.keys(patch).length) this.set(patch);
  }

  // ── running
  #sync() {
    if (!this.#lp) return;
    const run = this.#want && !this.#sleeping && this.#onscreen && document.visibilityState !== 'hidden';
    run ? this.#lp.play() : this.#lp.pause();
    const { toggle } = this.#els;
    toggle.hidden = this.#rs.register === 'quiet' || this.#settled;
    toggle.setAttribute('aria-pressed', String(!this.#want));
    toggle.firstChild.innerHTML = this.#want ? ICON.pause : ICON.play;
    const told = `${this.#want}|${this.#still}`;
    if (told !== this.#told) {
      this.#told = told;
      this.dispatchEvent(new CustomEvent('sg-state', { bubbles: true, composed: true, detail: { wanted: this.#want, still: this.#still, playing: this.playing } }));
    }
  }
  #wake() { if (this.#sleeping) { this.#sleeping = false; this.#settled = false; } this.#sync(); }
  #invalidate() {
    if (!this.#renderer || this.#lp?.playing || this.#raf) return;
    this.#raf = requestAnimationFrame(() => { this.#raf = 0; if (!this.#lp?.playing) this.#draw(0); });
  }

  #draw(dt) {
    const def = this.#def, r = this.#renderer;
    if (!def || !r) return;
    const { W, H } = def.meta, rs = this.#rs, still = this.#still;
    const time = still ? def.meta.stillTime ?? 1e6 : this.#time;
    const data = def.model({ time, seed: this.#seed, register: rs.register, params: this.#params, W, H });
    const quality = still || !dt ? this.#gov.level : this.#gov.sample(dt * 1000);
    r.render(data, { time, dt, calm: this.#all, pointer: this.#pointer, quality, still, epoch: this.#epoch, register: rs.register, motion: rs.motion });
    const settled = !!data?.settled;
    if (settled !== this.#settled) { this.#settled = settled; if (settled && this.#lp?.playing) this.#sleeping = true; this.#sync(); }
    if (!this.#ready) {
      // A renderer that paints in time slices exposes `ready` (a promise); sg-ready waits for it.
      this.#ready = true;
      const token = this.#token, fire = () => token === this.#token && this.dispatchEvent(new CustomEvent('sg-ready', { bubbles: true, composed: true }));
      typeof r.ready?.then === 'function' ? r.ready.then(fire, fire) : fire();
    }
  }

  // ── words
  #label() {
    const m = this.#def?.meta ?? {};
    this.#els.stage.setAttribute('aria-label', this.getAttribute('label') || m.alt || m.title || 'Drawing');
  }
  /** The state as words naming the work, "Upload progress: 40% done": label + the scene's short status. At most once a second, only on change. */
  #status() {
    const short = this.#def?.status?.(this.#params, this.#def.meta) ?? '';
    const label = this.getAttribute('label') || this.#def?.meta.title || '';
    const text = short && label ? `${label}: ${short}` : short;
    const put = () => { this.#statusAt = performance.now(); if (this.#els.status.textContent !== text) this.#els.status.textContent = text; };
    clearTimeout(this.#statusTimer);
    if (text === this.#els.status.textContent) return;
    const wait = 1000 - (performance.now() - this.#statusAt);
    wait <= 0 ? put() : (this.#statusTimer = setTimeout(put, wait));
  }

  // ── reading layer and calm rects
  #watchSlot() {
    const els = this.#els.slot.assignedElements();
    const text = this.#els.slot.assignedNodes().some(n => n.nodeType === 3 && n.textContent.trim());
    this.#els.panel.hidden = this.#held || (!els.length && !text);
    if (!this.#ro) return;
    this.#ro.disconnect(); this.#ro.observe(this.#els.stage);
    els.forEach(el => this.#ro.observe(el));
    this.#measure();
  }
  #measure() {
    if (!this.#def) return;
    const { stage, panel } = this.#els, frame = stage.parentNode, { W, H } = this.#def.meta;
    const s = stage.getBoundingClientRect();
    if (!s.width) return;
    // Words go below the drawing when they would cover too much of it. Same panel width either way: no flip-flop.
    const cover = panel.hidden ? 0 : panel.offsetHeight / s.height;
    const stacked = frame.classList.contains('stacked') ? cover > 0.4 : cover > 0.45;
    frame.classList.toggle('stacked', stacked);
    this.#mv?.sync();
    const kx = W / s.width, ky = H / s.height;
    this.#calm = this.#els.slot.assignedElements().map(el => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - s.left) * kx, y: (r.top - s.top) * ky, w: r.width * kx, h: r.height * ky };
    }).filter(r => r.w > 0 && r.h > 0 && r.y < H && r.y + r.h > 0);
    this.#placed = this.#placeKey(); this.#merge(); this.#invalidate();
  }
  #merge() { this.#all = this.#extra.size ? [...this.#calm, ...this.#extra.values()] : this.#calm; }
  // The panel can move with no resize (--sg-reading-place, a class up the tree, a stylesheet), which the
  // ResizeObserver never sees: watch the tree's style, class and register attributes and the head's styles, and re-measure if the panel really moved.
  #placeKey() { const r = this.#els.panel.getBoundingClientRect(); return `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0}`; }
  #placeMoved() { return this.#placed !== '' && this.#placed !== this.#placeKey(); }
  #watchPlace() {
    const mo = new MutationObserver(() => this.#placeMoved() && this.#measure());
    for (let n = this; n; n = n.parentElement ?? n.getRootNode().host) mo.observe(n, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'register', 'data-register', 'data-theme', 'data-palette'] });
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    this.#off.push(() => mo.disconnect());
  }

  // ── pointer and keys (arrow keys mirror the pointer)
  #listen() {
    const st = this.#els.stage, p = this.#pointer;
    let downAt = null;
    const at = e => {
      const r = st.getBoundingClientRect(), { W, H } = this.#def?.meta ?? { W: 1, H: 1 };
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      if (p.inside) p.travel += Math.hypot(x - p.x, y - p.y);
      p.x = x; p.y = y; p.inside = true; p.keyboard = false; this.#touched = true;
      if (this.#interactive) this.#wake();
    };
    st.addEventListener('pointermove', at);
    st.addEventListener('pointerdown', e => { at(e); p.down = true; downAt = [e.clientX, e.clientY]; });
    st.addEventListener('pointerup', () => { p.down = false; });
    st.addEventListener('pointerleave', () => { p.inside = p.down = false; });
    st.addEventListener('click', e => {
      if (this.#interactive && (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8)) this.#renderer?.activate?.(p);
      downAt = null;
    });
    st.addEventListener('keydown', e => {
      if (!this.#interactive || !this.#def) return;
      const { W, H } = this.#def.meta, step = W * (e.shiftKey ? 0.09 : 0.03);
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) {
        if (!p.keyboard) { p.x = W / 2; p.y = H / 2; }
        p.x = Math.min(W, Math.max(0, p.x + d[0] * step)); p.y = Math.min(H, Math.max(0, p.y + d[1] * step));
        p.travel += step; p.inside = p.down = p.keyboard = this.#touched = true;
      } else if (e.key === 'Enter' || e.key === ' ') this.#renderer?.activate?.(p);
      else return;
      e.preventDefault(); this.#wake(); this.#invalidate();
    });
    st.addEventListener('keyup', () => { if (p.keyboard) p.down = false; });
    st.addEventListener('blur', () => { if (p.keyboard) p.inside = p.down = false; this.#invalidate(); });
  }
}

