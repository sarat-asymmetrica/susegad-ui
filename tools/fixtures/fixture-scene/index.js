// A stand-in scene for testing the tools, independent of packages/core.
// It honours the parts of the 0001 contract the tools rely on: seeded and
// deterministic, register and theme aware, reduced-motion still, sg-ready after
// the first frame, play/pause/replay/reseed/set/still/seek/destroy, slotted
// content in a reading layer, lastPointer in logical units, and a text mirror
// of its state for assistive technology.
//
// Registered as <sg-fixture-scene> so it can never collide with the real <sg-scene>.

const W = 800, H = 500;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure model: a pulli grid and a closed Lissajous line through it, drawn up to `progress`. */
export function model({ time, seed, register }) {
  const r = rng(seed);
  const n = 5 + Math.floor(r() * 3);
  const a = 2 + Math.floor(r() * 3), b = a + 1 + Math.floor(r() * 2), phase = r() * Math.PI;
  const cycle = register === 'playful' ? 5 : 8;
  const progress = register === 'quiet' ? 1 : Math.min(1, time / cycle);
  const dots = [];
  const gap = 300 / (n - 1);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) dots.push({ x: 250 + i * gap, y: 100 + j * gap });
  const pts = [];
  const steps = 720;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    pts.push({ x: 400 + 170 * Math.sin(a * t + phase), y: 250 + 170 * Math.sin(b * t) });
  }
  return { n, dots, pts, progress };
}

const PALETTES = {
  light: { paper: '#f3ecdf', ink: '#1d2742', dot: '#8a7f6c', accent: '#b8412a' },
  dark: { paper: '#171a2b', ink: '#ece3d0', dot: '#8d8676', accent: '#e07a55' },
};

class FixtureScene extends HTMLElement {
  static observedAttributes = ['register', 'seed', 'paused', 'label'];
  #seed = 1; #time = 0; #raf = 0; #last = 0; #playing = false;
  lastPointer = null;
  meta = { title: 'Fixture', W, H };

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; position: relative; aspect-ratio: ${W} / ${H}; width: 100%; }
        canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
        .read { position: absolute; left: 6%; bottom: 8%; max-width: min(28rem, 70%); padding: 12px 16px;
          background: var(--scrim); color: var(--ink); border-radius: 4px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      </style>
      <canvas role="img"></canvas>
      <div class="read" part="reading"><slot></slot></div>
      <p class="sr" aria-live="off"></p>`;
    this.canvas = root.querySelector('canvas');
    this.readLayer = root.querySelector('.read');
    this.text = root.querySelector('.sr');
    this.ctx = this.canvas.getContext('2d');
    // On the host, so a pointer over the reading layer still maps onto the drawing.
    this.addEventListener('pointerdown', e => this.#pointer(e));
    this.addEventListener('pointermove', e => this.#pointer(e));
  }

  get register() {
    return this.getAttribute('register') || this.closest('[data-register]')?.dataset.register || 'warm';
  }
  get theme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  get playing() { return this.#playing; }

  connectedCallback() {
    this.#seed = Number(this.getAttribute('seed')) || 1;
    this.canvas.setAttribute('aria-label', this.getAttribute('label') || 'A kolam line drawn around a grid of dots');
    this.readLayer.hidden = !this.childElementCount;
    this.#resize();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || this.register === 'quiet' || this.hasAttribute('paused')) this.still();
    else { this.#draw(); this.play(); }
    requestAnimationFrame(() => {
      this.dispatchEvent(new CustomEvent('sg-ready', { bubbles: true }));
    });
  }
  disconnectedCallback() { this.pause(); }

  attributeChangedCallback(name) {
    if (!this.isConnected) return;
    if (name === 'seed') this.reseed(Number(this.getAttribute('seed')) || 1);
    else this.#draw();
  }

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
  replay() { this.#time = 0; this.#draw(); this.play(); }
  reseed(seed = this.#seed + 1) { this.#seed = seed; this.#draw(); }
  set() { this.#draw(); }
  still() { this.pause(); this.#time = 1e6; this.#draw(); }
  seek(t) { this.pause(); this.#time = t; this.#draw(); }
  destroy() { this.pause(); this.remove(); }

  #pointer(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    this.lastPointer = { x, y, inside: x >= 0 && x <= W && y >= 0 && y <= H, type: e.pointerType };
  }

  #resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = this.clientWidth || W;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(w * dpr * H / W);
    this.scale = this.canvas.width / W;
  }

  #draw() {
    const { ctx, scale } = this;
    const pal = PALETTES[this.theme];
    const reg = this.register;
    this.style.setProperty('--scrim', this.theme === 'dark' ? 'rgb(23 26 43 / .82)' : 'rgb(243 236 223 / .86)');
    this.style.setProperty('--ink', pal.ink);
    const m = model({ time: this.#time, seed: this.#seed, register: reg });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pal.dot;
    for (const d of m.dots) { ctx.beginPath(); ctx.arc(d.x, d.y, reg === 'quiet' ? 2 : 3.2, 0, Math.PI * 2); ctx.fill(); }
    const upto = Math.max(1, Math.round(m.progress * (m.pts.length - 1)));
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = reg === 'playful' ? pal.accent : pal.ink;
    ctx.lineWidth = reg === 'quiet' ? 1 : reg === 'warm' ? 2.2 : 3;
    ctx.beginPath();
    ctx.moveTo(m.pts[0].x, m.pts[0].y);
    for (let i = 1; i <= upto; i++) ctx.lineTo(m.pts[i].x, m.pts[i].y);
    ctx.stroke();
    if (reg !== 'quiet' && m.progress < 1) {
      const tip = m.pts[upto];
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, reg === 'playful' ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    }
    this.text.textContent = `Kolam ${Math.round(m.progress * 100)}% drawn, ${m.n} by ${m.n} dots, seed ${this.#seed}.`;
  }
}

if (!customElements.get('sg-fixture-scene')) customElements.define('sg-fixture-scene', FixtureScene);
