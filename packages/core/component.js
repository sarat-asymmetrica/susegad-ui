// SgElement and defineComponent: the component contract (decision 0005).
// A component is a light-DOM element that enhances a native child. The native
// element carries the meaning; a skin, loaded lazily per register, adds an
// aria-hidden decorative layer.

import { observeRegister, registerState, resolveMotion, REGISTERS } from './register.js';

/** The skin loader for a register, falling back to a quieter one when a register has none. */
export function pickSkin(skins, register) {
  for (let i = REGISTERS.indexOf(register); i >= 0; i--) if (skins?.[REGISTERS[i]]) return skins[REGISTERS[i]];
  return null;
}

/** Component motion: 'still' under reduced motion, 'state' in quiet, then 'ambient' or 'full'. */
export const componentMotion = s => resolveMotion(s.register, { reducedMotion: s.reducedMotion, forScene: false });

// One IntersectionObserver for every component on the page.
let io = null;
const watched = new WeakMap();
function watch(el, cb) {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  io ??= new IntersectionObserver(list => list.forEach(e => watched.get(e.target)?.(e.isIntersecting)));
  watched.set(el, cb); io.observe(el);
  return () => { io.unobserve(el); watched.delete(el); };
}

const Base = globalThis.HTMLElement ?? class {};

export class SgElement extends Base {
  /** A selector for the native child this element enhances, e.g. 'progress'. */
  static native = null;
  /** { quiet: () => import('./skins/quiet.js'), warm: …, playful: … } */
  static skins = {};
  static observedAttributes = ['register'];

  register = 'warm'; motion = 'state'; visible = true; skin = null; native = null;
  #rs = null; #off = []; #queued = false; #token = 0; #mounted = false;

  /** Plain data for the skin. Override. */
  state() { return {}; }

  /** Recompute state() and hand it to the skin, batched into one microtask. */
  update() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; if (this.skin && this.#mounted) this.skin.update(this.state()); });
  }

  /** Dispatch a bubbling, composed `sg-*` event. */
  emit(name, detail) { return this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail })); }

  connectedCallback() {
    if (this.#mounted) return;
    this.#mounted = true;
    const sel = this.constructor.native;
    this.native = sel ? this.querySelector(sel) : null;
    this.#apply(registerState(this));
    this.#off.push(
      observeRegister(this, s => this.#apply(s)),
      watch(this, v => { if (v !== this.visible) { this.visible = v; this.update(); } }),
    );
    this.connected?.();
    this.#load();
  }
  /** moveBefore() keeps the skin and its state. */
  connectedMoveCallback() {}
  disconnectedCallback() {
    // A move within one task (append() elsewhere) must not restart the skin.
    queueMicrotask(() => { if (!this.isConnected) this.#teardown(); });
  }
  attributeChangedCallback(name, old, now) { if (old !== now && this.#mounted) this.update(); }

  #teardown() {
    if (!this.#mounted) return;
    this.#mounted = false; this.#token++;
    this.#off.splice(0).forEach(f => f());
    this.skin?.destroy(); this.skin = null;
    this.disconnected?.();
  }

  #apply(s) {
    const prev = this.#rs;
    this.#rs = s;
    this.register = s.register;
    this.motion = componentMotion(s);
    if (prev && (prev.register !== s.register || componentMotion(prev) !== this.motion)) this.#load();
    else if (prev && prev.theme !== s.theme) this.skin?.restyle ? this.skin.restyle() : this.#load();
  }

  /** The live context a skin receives: getters, so it always reads the current values. */
  get ctx() {
    const el = this;
    return {
      host: el,
      get native() { return el.native; },
      get register() { return el.register; },
      get motion() { return el.motion; },
      get visible() { return el.visible; },
      emit: (n, d) => el.emit(n, d),
    };
  }

  async #load() {
    const token = ++this.#token, loader = pickSkin(this.constructor.skins, this.register);
    if (!loader) return;
    let mod;
    try { mod = await loader(); }
    catch (err) { console.warn(`${this.localName}: the ${this.register} skin did not load; the native element still works.`, err); return; }
    if (token !== this.#token || !this.#mounted) return;
    const mount = mod.mount ?? mod.default?.mount ?? mod.default;
    this.skin?.destroy();
    this.skin = mount(this, this.ctx);
    this.dataset.skin = this.register;
    this.skin.update(this.state());
    this.emit('sg-skin', { register: this.register, motion: this.motion });
  }
}

let hiddenSheet = null;

/**
 * customElements.define, once, and only where custom elements exist (not in Node).
 * Also makes `hidden` work for the tag: a component's own display rule would
 * otherwise beat the browser's [hidden] rule, so one shared stylesheet adds
 * `tag[hidden] { display: none !important }` for every component.
 */
export function defineComponent(tag, ctor) {
  if (!globalThis.customElements) return ctor;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
  try {
    if (!hiddenSheet) { hiddenSheet = new CSSStyleSheet(); document.adoptedStyleSheets = [...document.adoptedStyleSheets, hiddenSheet]; }
    const rule = `${tag}[hidden]{display:none!important}`;
    if (![...hiddenSheet.cssRules].some(r => r.cssText.replace(/\s/g, '') === rule.replace(/\s/g, ''))) hiddenSheet.insertRule(rule);
  } catch { /* no constructable stylesheets: the component's own CSS carries the rule */ }
  return ctor;
}
