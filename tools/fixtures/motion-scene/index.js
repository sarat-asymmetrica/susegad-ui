// A stand-in scene for testing tools/strip.mjs and tools/onion.mjs, independent of packages/core.
// A vermilion dot orbits a ring at a steady pace, and two optional faults are built in so the
// tools' motion facts have something known to find:
//
//   stall="3-5"   the dot stops between 3 s and 5 s, while the scene is still playing
//   cut="7"       at 7 s the whole picture changes at once (a stage cut): new paper, new ring
//
// With neither attribute it is a clean control: one smooth orbit, nothing to report.
// Registered as <sg-motion-scene>. It draws on the clock it is given (performance.now), so under
// the harness's ?freeze clock every frame is repeatable, and `playing` is true throughout.

const W = 800, H = 500;

/** Pure model: where the dot is at `time`, given the two optional faults. Runs in Node. */
export function model({ time, stall = null, cut = null }) {
  let t = time;
  if (stall) {
    const [a, b] = stall;
    t = time < a ? time : time < b ? a : time - (b - a); // the dot's own time stands still inside the stall
  }
  const angle = t * 0.9;
  const cutDone = cut != null && time >= cut;
  return { x: 400 + 160 * Math.cos(angle), y: 250 + 160 * Math.sin(angle), cutDone };
}

/** "3-5" to [3, 5]; null when absent or malformed. */
export function parseSpan(text) {
  const m = /^\s*([\d.]+)\s*-\s*([\d.]+)\s*$/.exec(text ?? '');
  return m && Number(m[2]) > Number(m[1]) ? [Number(m[1]), Number(m[2])] : null;
}

const PALETTES = {
  light: { paper: '#f3ecdf', ring: '#8a7f6c', dot: '#b8412a', cutPaper: '#1d2742', cutRing: '#ece3d0' },
  dark: { paper: '#171a2b', ring: '#8d8676', dot: '#e07a55', cutPaper: '#ece3d0', cutRing: '#1d2742' },
};

class MotionScene extends HTMLElement {
  static observedAttributes = ['stall', 'cut', 'register', 'seed'];
  #time = 0; #raf = 0; #last = 0; #playing = false;
  lastPointer = null;
  meta = { title: 'Motion fixture', W, H };

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; position: relative; aspect-ratio: ${W} / ${H}; width: 100%; }
        canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      </style>
      <canvas role="img" aria-label="A dot orbiting a ring"></canvas>`;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  get theme() {
    const t = document.documentElement.dataset.theme;
    return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  get playing() { return this.#playing; }

  connectedCallback() {
    const dpr = 1, w = this.clientWidth || W;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round((w * dpr * H) / W);
    this.scale = this.canvas.width / W;
    this.#draw();
    this.play();
    requestAnimationFrame(() => this.dispatchEvent(new CustomEvent('sg-ready', { bubbles: true })));
  }
  disconnectedCallback() { this.pause(); }
  attributeChangedCallback() { if (this.isConnected) this.#draw(); }

  play() {
    if (this.#playing) return;
    this.#playing = true;
    this.#last = performance.now();
    const loop = now => {
      if (!this.#playing) return;
      this.#time += Math.min(0.1, (now - this.#last) / 1000);
      this.#last = now;
      this.#draw();
      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }
  pause() { this.#playing = false; cancelAnimationFrame(this.#raf); }

  #draw() {
    const { ctx, scale } = this;
    const pal = PALETTES[this.theme];
    const m = model({ time: this.#time, stall: parseSpan(this.getAttribute('stall')), cut: Number(this.getAttribute('cut')) || null });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = m.cutDone ? pal.cutPaper : pal.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = m.cutDone ? pal.cutRing : pal.ring;
    ctx.lineWidth = m.cutDone ? 10 : 2;
    ctx.beginPath(); ctx.arc(400, 250, 160, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = pal.dot;
    ctx.beginPath(); ctx.arc(m.x, m.y, 40, 0, Math.PI * 2); ctx.fill();
  }
}

if (!customElements.get('sg-motion-scene')) customElements.define('sg-motion-scene', MotionScene);
