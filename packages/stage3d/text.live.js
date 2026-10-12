// The textured-quad painter: a layout's line boxes drawn as words in z-space, beside a 3D object in the same scene and camera.
// A live file (it needs three and a canvas); the plan it draws comes from text.core.js, and the lines from the type tier, which
// this file never imports: it paints what it is given and breaks no line (decision 0029).
//
// One small canvas texture per line, drawn with the very font string the layout measured, at the screen's density; a texture is
// drawn again only when its text, font, ink or density change (a line that only moves costs nothing). The words stay in the
// DOM as the real text; the caller makes their ink transparent only while these quads are on screen, and brings it back when
// they are not (a lost context, forced colours, a failed load): see `visible`.

import { baselineOf, worldAt, depthScale, CAM_D } from './text.core.js';

const bucket = n => Math.ceil(n / 64) * 64;

// The canvas's own pixels, premultiplied, straight to the screen: no colour management, so a word is exactly what the 2D canvas drew
// (and the vendored three build, which holds only the names stage3d uses, needs no new ones for this).
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }';

/**
 * @param {any} THREE  the module loadThree() resolved
 * @param {{ scene: any, camera: any, z?: number, D?: number, invalidate?: () => void }} o
 *   `z` is the plane the words stand in, behind the object's back surface by default, so depth really orders them (and anything
 *   that reached the object would be hidden by it); `invalidate` is called when a late font makes the textures draw again.
 */
export function createTextQuads(THREE, { scene, camera, z = -0.6, D = CAM_D, invalidate }) {
  const group = new THREE.Group(), geo = new THREE.PlaneGeometry(1, 1), items = [], metrics = new Map();
  group.renderOrder = 1;
  scene.add(group);
  let last = null, dead = false;

  /**
   * Where the DOM puts the baseline of a line in a box this tall, in this font: asked of the engine itself with a hidden probe, once
   * per font and height (engines round the font's ascent, descent and half-leading differently, and a quad one pixel off its span
   * is a word that does not sit on its own shadow). Falls back to the CSS model from the canvas's font metrics.
   */
  function baselineFor(ctx, font, h) {
    const key = `${font}|${h}`;
    let b = metrics.get(key);
    if (b === undefined) {
      try {
        const box = document.createElement('div'), probe = document.createElement('i');
        Object.assign(box.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', whiteSpace: 'pre', font, lineHeight: `${h}px` });
        Object.assign(probe.style, { display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline' });
        box.append('x', probe); document.body.append(box);
        b = probe.getBoundingClientRect().bottom - box.getBoundingClientRect().top;
        box.remove();
      } catch { b = NaN; }
      if (!Number.isFinite(b) || b <= 0 || b >= h * 2) {
        ctx.font = font;
        const t = ctx.measureText('Hg');
        b = baselineOf(h, t.fontBoundingBoxAscent ?? t.actualBoundingBoxAscent, t.fontBoundingBoxDescent ?? t.actualBoundingBoxDescent);
      }
      metrics.set(key, b);
    }
    return b;
  }
  function make() {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('text.live: no 2D canvas for the word textures');
    const material = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, premultipliedAlpha: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    const it = { canvas, ctx, material, mesh, tex: null, key: '', cw: 0, ch: 0, q: null };
    items.push(it);
    return it;
  }
  function retex(it) {
    it.tex?.dispose();
    const t = new THREE.Texture(it.canvas);
    t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true; t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    it.tex = it.material.uniforms.map.value = t;
  }

  /** Put the plan on screen. `o.f` is the picture frame, `o.origin` the paragraph's top left corner in canvas px and `o.page` the same corner in page px (where the DOM paragraph's box really is), `o.font` and `o.ink` CSS strings. */
  function set(plan, o) {
    if (dead) return;
    last = { plan, o };
    const { f, origin, page, font, ink } = o, dpr = f.dpr, k = depthScale(z, D);
    plan.forEach((q, i) => {
      const it = items[i] ?? make(), cw = bucket(q.texW), ch = q.texH;
      if (it.cw !== cw || it.ch !== ch) { it.canvas.width = it.cw = cw; it.canvas.height = it.ch = ch; it.key = ''; retex(it); }
      if (it.key !== q.key) {
        const g = it.ctx;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
        g.font = font; g.fillStyle = ink; g.textBaseline = 'alphabetic'; g.textRendering = 'geometricPrecision';
        g.fillText(q.text, q.pad, baselineFor(g, font, q.h));
        it.tex.needsUpdate = true; it.key = q.key;
      }
      // on a whole CSS pixel by the baseline in page px, where the engine puts the DOM's text (see snapBoxes). A texel is then a pixel and the word sits on its span
      const base = baselineFor(it.ctx, font, q.h), pg = page ?? { x: 0, y: 0 };
      const left = origin.x + (Math.round((pg.x + q.x) * dpr) / dpr - pg.x) - q.pad, top = origin.y + (Math.round(pg.y + q.y + base) - pg.y) - base;
      const wpx = cw / dpr, hpx = ch / dpr, c = worldAt(left + wpx / 2, top + hpx / 2, f, z, D);
      it.mesh.position.set(c.x, c.y, z);
      it.mesh.scale.set((wpx / f.h) * k, (hpx / f.h) * k, 1);
      it.mesh.visible = true; it.q = { ...q, left, top, wpx, hpx };
      it.mesh.updateMatrixWorld();
    });
    for (let i = plan.length; i < items.length; i++) { items[i].mesh.visible = false; items[i].q = null; }
  }

  // a face that arrives late is not in the textures drawn before it: draw them again
  const again = () => { if (last && !dead) { for (const it of items) it.key = ''; set(last.plan, last.o); invalidate?.(); } };
  document.fonts?.addEventListener?.('loadingdone', again);

  let scratch = null;
  return {
    set,
    /** The baseline's distance from the top of a line box this tall, in this font, as the engine puts it. */
    baseline: (font, h) => baselineFor((scratch ??= document.createElement('canvas').getContext('2d')), font, h),
    /** The same plan on a new frame (the object's scale on screen changed): nothing is drawn again, only moved. */
    refit(f) { if (last) set(last.plan, { ...last.o, f }); },
    /** The words on screen now, in reading order (a check reads this against the DOM's spans). */
    texts: () => items.filter(it => it.mesh.visible && it.q).map(it => it.q.text),
    /** Each quad's logical text box as the camera projects it, in canvas px: { k, text, left, top, w, h }. */
    screen() {
      const V = new THREE.Vector3(), out = [];
      for (const it of items) {
        if (!it.mesh.visible || !it.q) continue;
        V.set(-0.5, 0.5, 0).applyMatrix4(it.mesh.matrixWorld).project(camera);
        out.push({ k: it.q.k, text: it.q.text, left: (V.x * 0.5 + 0.5) * last.o.f.wc + it.q.pad, top: (1 - (V.y * 0.5 + 0.5)) * last.o.f.hc, w: it.q.w, h: it.q.h });
      }
      return out;
    },
    /** Show or hide the quads (the caller keeps the DOM ink in step with this). */
    set visible(v) { group.visible = !!v; },
    get visible() { return group.visible; },
    dispose() {
      dead = true;
      document.fonts?.removeEventListener?.('loadingdone', again);
      for (const it of items) { it.tex?.dispose(); it.material.dispose(); }
      geo.dispose(); scene.remove(group); items.length = 0;
    },
  };
}
