// <sg-diagram>: brings a rendered diagram to life. renderDiagram() has
// already put a static SVG and its text alternative in the page; this element
// only adds to it, and everything it adds is decoration or a second way in:
//
//   - arrows that draw when the diagram first comes into view (Web Animations
//     on a stroke dash, so getAnimations() can pause them);
//   - things moving along flows (=>), paused off screen, and left as still
//     dots under reduced motion and in quiet;
//   - step-through, when the source asked for steps: Previous and Next
//     buttons, arrow keys, and each step's words in a polite live region. The
//     steps are also an ordered list in the page, readable without JavaScript;
//   - the register: if the page's register differs from the one drawn at build
//     time, or changes, it draws again; on a narrow screen a diagram that runs
//     right turns to run down, unless its author fixed the direction.
//
// Event: sg-diagram-step { step, of } when the step changes.

import { observeRegister, registerState, resolveMotion } from '../../core/register.js';
import { renderDiagram } from './render.js';
import { STRINGS } from './diagram.core.js';

const NS = 'http://www.w3.org/2000/svg';
const MIN_SCALE = 12 / 14; // the boxes' words are 14 px; never smaller than about 12
const svgEl = (name, a) => { const n = document.createElementNS(NS, name); for (const k in a) n.setAttribute(k, a[k]); return n; };

export class SgDiagram extends HTMLElement {
  #on = false; #off = []; #src = ''; #opts = {}; #register = null; #motion = 'state'; #dir = null;
  #visible = false; #introduced = false; #at = 0; #stepper = null; #now = null; #wide = 0; #fixed = false;

  get step() { return this.#at; }
  /** Go to a step: 0 shows all of them. */
  set step(k) { this.#go(k); }

  connectedCallback() {
    if (this.#on) return;
    this.#on = true;
    this.#src = this.dataset.src ?? '';
    try { this.#opts = JSON.parse(this.dataset.opts || '{}'); } catch { this.#opts = {}; }
    if (!this.id) this.id = `sg-d-${Math.random().toString(36).slice(2, 8)}`;
    this.#register = this.dataset.registerDrawn || 'warm';
    this.#dir = this.dataset.direction || 'right';
    this.#fixed = this.hasAttribute('data-direction-set');
    if (!this.#svg && this.#src) this.#build(registerState(this).register);
    if (this.#svg && !this.#fixed && this.#dir === 'right') this.#wide = +this.#svg.getAttribute('width') || 0;
    if (this.hasAttribute('data-steps')) this.#buildStepper();

    this.#apply(registerState(this));
    this.#off.push(observeRegister(this, s => this.#apply(s)));
    const io = new IntersectionObserver(([e]) => { this.#visible = e.isIntersecting; this.#play(); });
    io.observe(this);
    const ro = new ResizeObserver(() => this.#fit());
    ro.observe(this);
    this.#off.push(() => io.disconnect(), () => ro.disconnect());
  }
  connectedMoveCallback() {}
  disconnectedCallback() {
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.#on = false;
      this.#off.splice(0).forEach(f => f());
      this.getAnimations({ subtree: true }).forEach(a => a.cancel());
    });
  }

  get #svg() { return this.querySelector('.sg-diagram-svg'); }

  #apply(s) {
    const motion = resolveMotion(s.register, { reducedMotion: s.reducedMotion, forScene: false });
    const redraw = s.register !== this.#register;
    this.#register = s.register; this.#motion = motion;
    if (redraw) this.#redraw(); else this.#flows();
  }

  /** A narrow screen turns a rightward diagram downward, unless its author chose. */
  #fit() {
    if (!this.#fixed && this.#wide) {
      const dir = this.clientWidth < this.#wide * MIN_SCALE ? 'down' : 'right'; // turn before the words would get too small
      if (dir !== this.#dir) { this.#dir = dir; this.#redraw(); }
    }
    this.#floor();
  }

  /** Shrink to fit, down to words about 12 px high (the boxes' 14 px at 0.86); past that, scroll within the figure. */
  #floor() {
    const svg = this.#svg, box = svg?.parentElement;
    if (!svg) return;
    this.style.setProperty('--sg-d-min', `${Math.round((+svg.getAttribute('width') || 0) * MIN_SCALE)}px`);
    if (!box?.classList.contains('sg-diagram-scroll')) return;
    // a region that scrolls can be reached and scrolled from the keyboard, and says what it holds
    const scrolls = box.scrollWidth > box.clientWidth + 1;
    if (scrolls) { box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-label', svg.querySelector('title')?.textContent || STRINGS.untitled); }
    else { box.removeAttribute('tabindex'); box.removeAttribute('role'); box.removeAttribute('aria-label'); }
  }

  /** Markdown rendered without a build leaves only data-src and the source text: draw it all here (decision 0013). */
  #build(register) {
    const { html } = renderDiagram(this.#src, { ...this.#opts, id: this.id, register, steps: this.hasAttribute('data-steps') });
    const t = document.createElement('template');
    t.innerHTML = html;
    const made = t.content.firstElementChild;
    this.replaceChildren(...made.childNodes);
    this.#register = this.dataset.registerDrawn = register;
    this.#dir = made.dataset.direction || this.#dir;
  }

  #redraw() {
    const old = this.#svg;
    if (!old) return;
    const { html } = renderDiagram(this.#src, { ...this.#opts, id: this.id, register: this.#register, direction: this.#dir, steps: this.hasAttribute('data-steps') });
    const t = document.createElement('template');
    t.innerHTML = html;
    const next = t.content.querySelector('.sg-diagram-svg');
    old.getAnimations({ subtree: true }).forEach(a => a.cancel());
    old.replaceWith(next);
    this.dataset.registerDrawn = this.#register;
    this.#go(this.#at, { quiet: true });
    this.#flows();
    this.#floor();
  }

  /** Draw an edge's line from its start: the plain path in quiet, the inked ribbon through a mask otherwise. */
  #draw(g, { duration, delay = 0 }) {
    const path = g.querySelector('.sg-d-path'), ink = g.querySelector('.sg-d-ink'), heads = g.querySelectorAll('.sg-d-head');
    if (!path) return [];
    const len = path.getTotalLength(), out = [], ease = 'cubic-bezier(0.45, 0.05, 0.25, 1)';
    let line = path;
    if (ink) {
      const id = `${this.id}-m${g.dataset.edge}`, svg = this.#svg;
      let defs = svg.querySelector('defs');
      if (!defs) { defs = svgEl('defs', {}); svg.prepend(defs); }
      defs.querySelector(`#${CSS.escape(id)}`)?.remove();
      const mask = svgEl('mask', { id, maskUnits: 'userSpaceOnUse' });
      line = svgEl('path', { d: path.getAttribute('d'), fill: 'none', stroke: '#fff', 'stroke-width': 12, 'stroke-linecap': 'round' });
      mask.append(line); defs.append(mask);
      ink.setAttribute('mask', `url(#${id})`);
    }
    line.style.strokeDasharray = `${len} ${len}`;
    const a = line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, easing: ease, fill: 'backwards' });
    out.push(a);
    for (const h of heads) out.push(h.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(160, duration / 2), delay: delay + duration * 0.8, fill: 'backwards' }));
    // a flow's beads come after its line, never floating before it is there
    for (const b of g.querySelectorAll('.sg-d-dots, .sg-d-particle')) out.push(b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: delay + duration, fill: 'backwards' }));
    a.finished.then(() => { ink?.removeAttribute('mask'); line.style.strokeDasharray = ''; }, () => {});
    for (const x of out) x.finished.then(() => x.cancel(), () => {});
    return out;
  }

  /** The first time the diagram comes into view, its arrows draw one after another. */
  #intro() {
    if (this.#introduced || this.#motion === 'still' || this.#motion === 'state') return;
    this.#introduced = true;
    // the whole draw-in takes no more than 600 ms, however many arrows there are
    const edges = [...this.querySelectorAll('.sg-d-edge')], n = edges.length;
    const dur = Math.min(this.#motion === 'full' ? 300 : 360, 600 / Math.max(1, n) * 1.6), gap = n > 1 ? (600 - dur) / (n - 1) : 0;
    edges.forEach((g, k) => this.#draw(g, { duration: dur, delay: k * gap }));
  }

  /** Things moving along each flow; still dots in quiet and under reduced motion. */
  #flows() {
    const svg = this.#svg;
    if (!svg) return;
    svg.querySelectorAll('.sg-d-particle').forEach(p => { p.getAnimations().forEach(a => a.cancel()); p.remove(); });
    const moving = this.#motion === 'ambient' || this.#motion === 'full';
    this.toggleAttribute('data-moving', moving);
    if (moving) {
      for (const g of svg.querySelectorAll('.sg-d-flow')) {
        const path = g.querySelector('.sg-d-path'), len = path.getTotalLength();
        const frames = Array.from({ length: 25 }, (_, i) => { const p = path.getPointAtLength((len * i) / 24); return { transform: `translate(${p.x}px, ${p.y}px)` }; });
        const n = this.#motion === 'full' ? 5 : 3, duration = (len / (this.#motion === 'full' ? 70 : 45)) * 1000;
        for (let k = 0; k < n; k++) {
          const c = svgEl('circle', { class: 'sg-d-particle', r: this.#motion === 'full' ? 3.2 : 2.6, cx: 0, cy: 0 });
          g.append(c);
          const a = c.animate(frames, { duration, iterations: Infinity, delay: -(duration * k) / n, easing: 'linear' });
          if (!this.#visible) a.pause();
        }
      }
    }
    this.#play();
  }

  /** Off screen, everything waits. */
  #play() {
    if (this.#visible) this.#intro();
    for (const a of this.getAnimations({ subtree: true })) {
      if (a.effect?.getComputedTiming().iterations !== Infinity) continue;
      this.#visible ? a.play() : a.pause();
    }
  }

  #buildStepper() {
    const list = this.querySelector('.sg-diagram-steps');
    if (!list) return;
    const wrap = document.createElement('div');
    wrap.className = 'sg-diagram-stepper';
    const btn = (label, dir) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => this.#go(this.#at + dir));
      return b;
    };
    const prev = btn(STRINGS.prev, -1), next = btn(STRINGS.next, 1);
    const now = document.createElement('p');
    now.className = 'sg-diagram-now';
    now.setAttribute('role', 'status');
    wrap.append(prev, now, next);
    wrap.addEventListener('keydown', e => {
      const n = this.#count, k = { ArrowRight: this.#at + 1, ArrowDown: this.#at + 1, ArrowLeft: this.#at - 1, ArrowUp: this.#at - 1, Home: 0, End: n }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      this.#go(k);
    });
    list.before(wrap);
    this.#stepper = { prev, next, list };
    this.#now = now;
    this.#go(0, { quiet: true });
  }

  get #count() { return this.#stepper?.list.children.length ?? 0; }

  #go(k, { quiet = false } = {}) {
    if (!this.#stepper) return;
    const n = this.#count, at = Math.max(0, Math.min(n, k | 0));
    const moved = at !== this.#at;
    this.#at = at;
    this.dataset.at = at;
    const edge = at ? this.querySelector(`.sg-d-edge[data-edge="${at - 1}"]`) : null;
    const lit = new Set(edge ? [edge.dataset.from, edge.dataset.to] : []);
    this.querySelectorAll('.sg-d-edge, .sg-d-label').forEach(g => g.classList.toggle('is-now', !!at && +g.dataset.edge === at - 1));
    this.querySelectorAll('.sg-d-node').forEach(g => g.classList.toggle('is-lit', lit.has(g.dataset.node)));
    [...this.#stepper.list.children].forEach((li, i) => (i === at - 1 ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
    this.#stepper.prev.setAttribute('aria-disabled', String(at === 0));
    this.#stepper.next.setAttribute('aria-disabled', String(at === n));
    // the live region says the step in words; the picture follows
    this.#now.textContent = at ? `${STRINGS.stepOf(at, n)} ${this.#stepper.list.children[at - 1].textContent}` : STRINGS.overview;
    if (!moved || quiet) return;
    if (edge && this.#motion !== 'still') this.#draw(edge, { duration: this.#motion === 'state' ? 180 : 420 });
    this.dispatchEvent(new CustomEvent('sg-diagram-step', { bubbles: true, detail: { step: at, of: n } }));
  }
}

if (globalThis.customElements && !customElements.get('sg-diagram')) customElements.define('sg-diagram', SgDiagram);
