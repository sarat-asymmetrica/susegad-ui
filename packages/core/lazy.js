// <sg-lazy>: the poster is the first paint, and the scene is fetched only when it can be seen and
// wanted (decision 0024). Defining this element pulls in no engine and no scene: sg-scene (./index.js)
// and the scene module named by `src` arrive when the time comes.
//
//   <sg-lazy src="/packages/scenes/abri/index.js">
//     <picture>…poster…</picture>
//     <sg-scene name="abri" hidden></sg-scene>
//   </sg-lazy>
//
// The poster stays, as the finished still, under reduced motion, Save-Data, the quiet register and
// low-memory devices; start() starts the scene anyway, for a viewer who asks. data-state is
// "poster" | "loading" | "live" | "failed", and data-hold names why the poster is being kept.

import { registerState, observeRegister } from './register.js';
import { adopt } from './sheet.js';
import { holdReason, parseSrc } from './lazy.core.js';

// :where() keeps every rule at zero specificity, so a page's own CSS wins without a fight.
const CSS = `
:where(sg-lazy){display:grid;position:relative}
:where(sg-lazy)>*{grid-area:1/1;min-width:0}
:where(sg-lazy)>picture{position:relative;z-index:1;display:block;transition:opacity .35s,visibility 0s}
:where(sg-lazy)>picture img{display:block;width:100%;height:auto}
:where(sg-lazy[data-state=live])>picture{opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s}
@media (prefers-reduced-motion:reduce){:where(sg-lazy)>picture,:where(sg-lazy[data-state=live])>picture{transition:none}}`;

const Base = globalThis.HTMLElement ?? class {};
const MARGIN = '200px';
const GIVE_UP_MS = 20000;

export class SgLazy extends Base {
  #io = null; #off = null; #seen = false; #started = false; #token = 0;

  static observedAttributes = ['src'];
  attributeChangedCallback() { if (this.isConnected) this.#maybe(); }

  /** 'poster' | 'loading' | 'live' | 'failed' */
  get state() { return this.dataset.state ?? 'poster'; }
  /** Why the poster is being kept ('reduced-motion', 'save-data', 'low-memory', 'quiet'), or null. */
  get holding() { return holdReason(this.#env()); }
  /** The scene inside. */
  get scene() { return this.querySelector('sg-scene'); }

  connectedCallback() {
    adopt(document, CSS);
    if (!this.dataset.state) this.#set('poster');
    this.#seen = false;
    this.#io = new IntersectionObserver(([e]) => { this.#seen = e.isIntersecting; this.#maybe(); }, { rootMargin: MARGIN });
    this.#io.observe(this);
    this.#off = observeRegister(this, () => this.#maybe());
    if (document.readyState !== 'complete') addEventListener('load', this.#onLoad, { once: true });
  }
  disconnectedCallback() {
    this.#token++;
    this.#io?.disconnect(); this.#off?.(); this.#io = this.#off = null;
    removeEventListener('load', this.#onLoad);
  }
  #onLoad = () => this.#maybe();

  #env() { const s = registerState(this); return { reducedMotion: s.reducedMotion, saveData: s.saveData, register: s.register, deviceMemory: navigator.deviceMemory ?? null }; }
  #set(state, hold = null) {
    this.dataset.state = state;
    hold ? this.setAttribute('data-hold', hold) : this.removeAttribute('data-hold');
    this.dispatchEvent(new CustomEvent('sg-lazy', { bubbles: true, detail: { state, hold } }));
  }

  // The scene starts by itself only when it is near the viewport, the page has loaded, and nothing says no.
  #maybe() {
    if (this.#started || !this.isConnected) return;
    const hold = holdReason(this.#env());
    if ((this.dataset.hold ?? null) !== hold) this.#set(this.state, hold);
    if (!hold && this.#seen && document.readyState === 'complete') this.start();
  }

  /** Fetch and start the scene now, whatever the hold: a viewer asked. True when its first frame is drawn, false if the poster stays. A held scene is played too, unless `play` is false (look closer, not watch). */
  async start({ play = true } = {}) {
    if (this.#started) return this.state === 'live';
    this.#started = true;
    const token = ++this.#token, scene = this.scene, held = this.dataset.hold ?? null;
    this.#set('loading', held);
    let timer = 0;
    try {
      if (!scene) throw new Error('no <sg-scene> inside');
      // Listen first: the scene mounts the moment its element is defined, maybe before the imports settle.
      const ready = new Promise((res, rej) => { scene.addEventListener('sg-ready', res, { once: true }); timer = setTimeout(() => rej(new Error('no first frame')), GIVE_UP_MS); });
      scene.hidden = false; // under the poster (z-index), so the first frame draws at its real size
      await Promise.all([import('./index.js'), ...parseSrc(this.getAttribute('src'), document.baseURI).map(u => import(u))]);
      await ready;
      if (token !== this.#token) return false;
      // A held scene draws its still and waits; a viewer who asked gets it playing.
      if (held && play) scene.play?.();
      this.#set('live', held);
      return true;
    } catch (err) {
      if (token === this.#token) { this.#started = false; scene && (scene.hidden = true); this.#set('failed', held); console.warn('sg-lazy: the scene did not load, so the poster stays', err?.message ?? err); }
      return false;
    } finally { clearTimeout(timer); }
  }
}

if (globalThis.customElements && !customElements.get('sg-lazy')) customElements.define('sg-lazy', SgLazy);
