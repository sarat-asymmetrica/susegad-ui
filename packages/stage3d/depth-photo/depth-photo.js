// <sg-depth-photo>: a photograph with a depth map, seen through a camera.
// The <img> inside is the picture: its alt is what a screen reader hears, and
// it is what shows with no JavaScript, no WebGL, or before anything loads.
// JavaScript lays a canvas over it that racks focus by depth, dollies the
// camera, and (in warm and playful) moves the water inside a mask.
//
//   <sg-depth-photo depth="depth.png" layers="layers.png" horizon="0.334" shore="0.478"
//                   keep="0.47 0.6" focus="0.2">
//     <img src="photo.jpg" alt="A paper plate of sev puri on a laterite ledge, the bay behind it">
//   </sg-depth-photo>
//
// Params (attributes, or set({ … })): focus 0..1 (0 the horizon, 1 the nearest
// thing), aperture, dolly 0..1 along dolly-path "dx dy forward pitchDeg",
// parallax, sea, clarity. Also keep "u v" (the photo point kept in view),
// horizon and shore (the water band, for the layers map), renderer
// auto|live|2d|still, treatment photo|drawn (a child img or canvas with
// data-treatment="drawn" is the drawing), duration (seconds, for export).
//
// The frame contract (packages/story/frame.js): duration, renderFrame(t), canvasFor(w, h).
// Events: sg-ready after the first drawn frame; sg-tier { tier, reason } when the tier is chosen.

import { SgElement, defineComponent } from '../../core/component.js';
import { createGovernor } from '../../engine/src/governor.js';
import { loadThree, webglInfo, liteDevice, watchVisible, decoded, chooseTier, follow } from '../stage3d.js';
import { coerce, defaults, frameState, placeOnStage, blurPx, parseVec } from './depth-photo.core.js';
import { create2DRenderer } from './depth-photo.2d.js';
import { clampTime, settle } from './story-shims.js';

const ATTRS = ['focus', 'aperture', 'dolly', 'parallax', 'sea', 'clarity'];
const GRADE = {
  light: { exposure: 1, ink: [0.1, 0.09, 0.12], paper: [0.99, 0.975, 0.95] },
  dark: { exposure: 0.9, ink: [0.07, 0.065, 0.08], paper: [0.95, 0.93, 0.9] },
};
const isDark = el => {
  const t = el.closest('[data-theme]')?.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia?.('(prefers-color-scheme: dark)').matches;
};

export class SgDepthPhoto extends SgElement {
  static native = 'img:not([data-treatment="drawn"])';
  static observedAttributes = ['register', ...ATTRS, 'dolly-path', 'keep', 'treatment', 'renderer', 'data-theme'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #p = defaults(); #canvas = null; #r = null; #tier = null; #src = null; #ready = false;
  #raf = 0; #last = 0; #clock = 0; #visible = true; #off = []; #gov = null; #dirty = true;
  #pointer = [0, 0]; #pointerTo = [0, 0]; #starting = null; #size = [0, 0];
  #durationDefault = 12; #startedFor = '';
  // A guard for machines far slower than the governor's window can see (it
  // ignores frames over 250 ms): three slow frames in a row halve the pixels.
  #slowRun = 0; #rescue = 1; #lastLook = 0; #lostOff = null; #lost = false;

  /** The skin's pointer target, [-1..1, -1..1]; playful sets it. */
  set pointerTarget(p) { this.#pointerTo = p; this.#kick(); }
  get tier() { return this.#tier; }
  get params() { return { ...this.#p }; }
  get canvas() { return this.#canvas; }
  get duration() { const d = parseFloat(this.getAttribute('duration')); return d > 0 ? d : this.#durationDefault; }

  connected() {
    this.#canvas = Object.assign(document.createElement('canvas'), { className: 'sg-depth-photo-canvas' });
    this.#canvas.setAttribute('aria-hidden', 'true');
    this.prepend(this.#canvas);
    if (!this.native) console.warn('sg-depth-photo: put an <img> with alt text inside; it is the picture for everyone the canvas cannot reach.');
    for (const a of ATTRS) if (this.hasAttribute(a)) Object.assign(this.#p, coerce({ [a]: this.getAttribute(a) }));
    this.#gov = createGovernor({ onchange: () => { this.#sizeUp(true); } });
    const ro = new ResizeObserver(() => this.#sizeUp());
    ro.observe(this);
    this.#off.push(() => ro.disconnect(), watchVisible(this, v => { this.#visible = v; this.#kick(); }));
    this.#start();
  }

  disconnected() {
    cancelAnimationFrame(this.#raf); this.#raf = 0;
    this.#lostOff?.();
    this.#off.splice(0).forEach(f => f());
    this.#r?.dispose(); this.#r = null;
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (old === now || !this.#canvas) return;
    if (ATTRS.includes(name)) this.set({ [name]: now ?? defaults()[name] });
    else if (name === 'renderer' || name === 'register') this.#start();
    else if (name === 'treatment') this.#applyTreatment();
    else this.#kick(true);
  }

  /** Merge params and draw on the next frame. Numbers are clamped; unreadable ones are ignored. */
  set(params) {
    Object.assign(this.#p, coerce(params));
    this.#kick(true);
  }

  /** The skin tells the element the register or motion may have changed; the tier is chosen again only if it did. */
  registerChanged() { if (this.#startedFor !== `${this.register}|${this.motion}`) this.#start(); }

  /** Grade for the current theme (the skin calls this when the theme changes). */
  regrade() { this.#r?.setGrade(GRADE[isDark(this) ? 'dark' : 'light']); this.#kick(true); }

  /** Where photo point (u, v) at depth d sits in this element, in CSS px, for the current frame. */
  place(u, v, d) { return placeOnStage(this.#state(), u, v, d, this.#size[0], this.#size[1]); }

  /** The blur radius in CSS px of a point at depth d, for the current frame. */
  blurAt(d) { return blurPx(this.#state(), d, this.#size[1]); }

  /** Draw exactly time t on this element's canvas; resolves when the canvas holds it (the frame contract). */
  async renderFrame(t) {
    await this.#starting;
    this.#p.t = clampTime(t, 1e6);
    if (!this.#r) return this.#canvas;
    // the pointer is live input, not part of the timeline: a frame for time t is drawn at rest
    // (the next live frame leans again), so the same t always gives the same pixels
    this.#r.draw(this.#state(this.#p, undefined, undefined, [0, 0]));
    await settle(this.#canvas);
    return this.#canvas;
  }

  /**
   * An off-screen target at exactly width x height device pixels (the frame
   * contract). Uses three when this element could, else the 2D renderer.
   */
  async canvasFor(width, height, { register = this.register, keep = null, split = true, debug = false, far = true } = {}) {
    await this.#starting;
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const src = await this.#sources();
    let r = null;
    if (this.#tier === 'live') {
      const THREE = await loadThree();
      if (THREE) { const { createGLRenderer } = await import('./depth-photo.gl.js'); r = createGLRenderer(THREE, canvas, src); }
    }
    r ??= create2DRenderer(canvas, src);
    r.setGrade(GRADE[isDark(this) ? 'dark' : 'light']);
    r.debug?.({ split, debug, far });
    r.setMaxLook?.(Infinity); // an export draws the photo at its own resolution
    r.resize(width, height, 1, 1, width * height);
    if (r.kind === '2d') { canvas.width = width; canvas.height = height; }
    const p = { ...this.#p };
    const self = this;
    return {
      canvas, width, height, duration: this.duration,
      set(params) { Object.assign(p, coerce(params)); },
      /** Where photo point (u, v, depth d) sits in this target, in its pixels. */
      place(u, v, d) { return placeOnStage(self.#state(p, width / height, register, [0, 0], keep), u, v, d, width, height); },
      async renderFrame(t) {
        p.t = clampTime(t, 1e6);
        r.draw(self.#state(p, width / height, register, [0, 0], keep));
        await settle(canvas);
        return canvas;
      },
      release() { r.dispose(); },
    };
  }

  /** Stop moving and show the finished frame. */
  still() { this.#p.sea = 0; this.#kick(true); }

  // ── inside ────────────────────────────────────────────────────────────────

  #state(p = this.#p, va = this.#size[0] / Math.max(1, this.#size[1]), register = this.register, pointer = this.#pointer, keep = null) {
    return frameState(p, {
      register, va: va || 0.75, pa: this.#r?.pa ?? 0.75, pointer,
      keep: parseVec(keep ?? this.getAttribute('keep'), [0.5, 0.5]),
      path: parseVec(this.getAttribute('dolly-path'), [0, -0.06, 0.28, -3]),
      fovY: parseFloat(this.getAttribute('fov')) || 50,
    });
  }

  async #sources() {
    if (!this.#src) {
      const img = await decoded(this.native);
      const depth = await decoded(this.getAttribute('depth'));
      const layers = this.getAttribute('layers') ? await decoded(this.getAttribute('layers')).catch(() => null) : null;
      this.#src = {
        look: img, photo: img, depth, layers,
        horizon: parseFloat(this.getAttribute('horizon')) || 0.33,
        shore: parseFloat(this.getAttribute('shore')) || 0.48,
      };
    }
    this.#src.look = await this.#currentLook();
    return this.#src;
  }

  /** The photo, or the drawing when treatment="drawn" and a drawing is inside. */
  async #currentLook() {
    const drawn = this.querySelector('[data-treatment="drawn"]');
    if (this.getAttribute('treatment') !== 'drawn' || !drawn) return this.#src.photo;
    return drawn instanceof HTMLImageElement ? decoded(drawn) : drawn;
  }

  async #applyTreatment() {
    // before the renderer exists, #start picks the treatment up itself
    if (!this.#src || !this.#r) return;
    const look = await this.#currentLook();
    if (look === this.#src.look || !this.#r) return;
    this.#src.look = look;
    this.#r.setSource(look);
    this.#kick(true);
  }

  /** Choose the tier (again) and build its renderer. */
  #start() {
    this.#startedFor = `${this.register}|${this.motion}`;
    const run = async () => {
      const motion = this.motion === 'state' ? 'still' : this.motion; // a scene's quiet is a still
      const forced = this.getAttribute('renderer');
      const { available: webgl, software } = webglInfo();
      let tier = this.#lost ? '2d' : chooseTier({ webgl, software, motion, lite: liteDevice(), forced: forced === 'auto' ? null : forced });
      let reason = this.#lost ? 'the WebGL context was lost'
        : forced && forced !== 'auto' ? `forced ${forced}`
        : tier === 'live' ? 'WebGL2 and motion allowed'
        : motion === 'still' ? 'still: quiet or reduced motion'
        : !webgl ? 'no WebGL2'
        : software ? 'software WebGL (no GPU)'
        : 'Save-Data or low memory';
      let src;
      try { src = await this.#sources(); } catch (e) {
        tier = 'still'; reason = e.message;
      }
      let r = null;
      if (tier === 'live') {
        const THREE = await loadThree();
        if (THREE) {
          try { const { createGLRenderer } = await import('./depth-photo.gl.js'); r = createGLRenderer(THREE, this.#canvas = this.#freshCanvas(), src); }
          catch (e) { console.warn('sg-depth-photo: the live renderer failed, drawing in 2D.', e); }
        }
        if (!r) { tier = '2d'; reason = THREE ? 'the live renderer failed' : 'three.js did not load'; }
      }
      if (tier === '2d') r = create2DRenderer(this.#canvas = this.#freshCanvas(), src);
      this.#lostOff?.(); // disposing the old renderer loses its context on purpose; that is not a crash
      this.#r?.dispose();
      this.#r = r;
      this.#tier = tier;
      this.dataset.tier = tier;
      if (r) {
        // the treatment may have changed while three was loading
        const look = await this.#currentLook();
        if (look !== src.look) { src.look = look; r.setSource(look); }
        r.setGrade(GRADE[isDark(this) ? 'dark' : 'light']);
        // a real context loss (the GPU reset, the tab starved): carry on in 2D rather than go blank
        const canvas = this.#canvas, lost = e => { e.preventDefault(); this.#lostOff = null; this.#r = null; this.#lost = true; this.#start(); };
        canvas.addEventListener('webglcontextlost', lost, { once: true });
        this.#lostOff = () => canvas.removeEventListener('webglcontextlost', lost);
      }
      this.emit('sg-tier', { tier, reason });
      this.#sizeUp(true);
    };
    this.#starting = (this.#starting ?? Promise.resolve()).then(run, run);
    return this.#starting;
  }

  /** A new canvas for a new renderer: a canvas that once held WebGL can never give a 2D context. */
  #freshCanvas() {
    const old = this.#canvas, c = old.cloneNode(false);
    old.replaceWith(c);
    delete this.dataset.drawn;
    return c;
  }

  #sizeUp(force = false) {
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h || !this.#r) return;
    if (!force && w === this.#size[0] && h === this.#size[1]) return;
    this.#size = [w, h];
    const maxPixels = (parseFloat(this.getAttribute('max-pixels')) || 1.0e6) * this.#rescue;
    this.#r.resize(w, h, devicePixelRatio || 1, this.#gov?.level ?? 1, maxPixels);
    this.#kick(true);
  }

  #kick(changed = false) {
    if (changed) this.#dirty = true;
    if (!this.#raf && this.#r) this.#raf = requestAnimationFrame(now => this.#frame(now));
  }

  #frame(now) {
    this.#raf = 0;
    if (!this.#r) return;
    const raw = this.#last ? (now - this.#last) / 1000 : 0;
    const dt = Math.min(0.1, raw);
    this.#last = now;
    const live = this.#tier === 'live' && this.#visible;
    const s0 = this.#state();
    const moving = live && (s0.sea > 0 || s0.swell > 0);
    if (moving) this.#clock += dt;
    // the water is slow: 30 new pictures a second are plenty, and halve the cost
    const seaDue = moving && now - this.#lastLook >= 1000 / 30 - 2;
    if (seaDue) { this.#p.t = this.#clock; this.#lastLook = now; }
    const pointerMoving = live && Math.hypot(this.#pointer[0] - this.#pointerTo[0], this.#pointer[1] - this.#pointerTo[1]) > 1e-4;
    if (pointerMoving) this.#pointer = this.#pointer.map((v, i) => follow(v, this.#pointerTo[i], dt, 0.35));
    if (seaDue || pointerMoving || this.#dirty) {
      const t0 = performance.now();
      this.#r.draw(this.#state());
      this.#dirty = false;
      if (live && dt) {
        this.#gov.sample(raw * 1000);
        this.#slowRun = raw > 0.12 ? this.#slowRun + 1 : 0;
        if (this.#slowRun >= 3 && this.#rescue > 0.125) { this.#rescue /= 2; this.#slowRun = 0; this.#sizeUp(true); }
      }
      if (!this.#ready || this.dataset.drawn === undefined) {
        // wait for the pixels before hiding the <img>: an opaque WebGL canvas is black until its first frame
        settle(this.#canvas);
        this.dataset.drawn = '';
        if (!this.#ready) { this.#ready = true; this.emit('sg-ready', { tier: this.#tier, ms: performance.now() - t0 }); }
      }
    } else this.#last = 0;
    if (moving || pointerMoving) this.#kick();
  }
}

defineComponent('sg-depth-photo', SgDepthPhoto);
