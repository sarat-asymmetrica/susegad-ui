// depth-photo.gl.js: the live renderer for <sg-depth-photo>, in three.js.
// Loaded only on the 'live' tier; `THREE` is passed in from loadThree().
//
// Two passes, both in the photo's own coordinates (v runs down; every texture
// has flipY off):
//  1. the look: the photo (or the drawing) graded into our world, with the sea
//     moving inside its mask and a fixed grain; drawn into a mipmapped target,
//     and only again when the water has moved or the source changed.
//  2. the stage: a grid mesh pushed back to each pixel's depth, seen through a
//     camera that projects it exactly onto the photo from rest, so a dolly or
//     a parallax move is true 3D. Drawn twice, as a near and a far layer, so
//     no triangle stretched across a depth edge (the rubber sheet) is ever seen. Its fragment gathers the look over the
//     pixel's circle of confusion (focus.core.js), so the focus racks by depth.

const LOOK_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`;

const LOOK_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uSrc, uLayers;
uniform float uHasLayers, uTime, uSea, uSwell, uHorizon, uShore, uPeriod, uGrain, uExposure;
uniform vec3 uInk, uPaper;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// the grade: blacks lifted toward the ink, highlights eased toward the paper,
// a touch less saturation, so the photograph sits beside our drawings
vec3 grade(vec3 c) {
  c *= uExposure;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.9);
  c = mix(uInk, uPaper, c);
  return c;
}

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(uSrc, uv).rgb;
  if (uHasLayers > 0.5 && uSea > 0.0) {
    float m = texture2D(uLayers, uv).r * uSea;
    if (m > 0.002) {
      float y = clamp((uv.y - uHorizon) / max(1e-4, uShore - uHorizon), 0.0, 1.0);
      // flow toward the viewer, faster nearer the shore; a slow noise varies it across the bay
      float wob = 0.75 + 0.5 * vnoise(vec2(uv.x * 5.0, y * 3.0 + uTime * 0.07));
      float amt = (0.0015 + 0.018 * pow(y, 1.4)) * wob;
      float ph0 = fract(uTime / uPeriod), ph1 = fract(uTime / uPeriod + 0.5);
      vec3 a = texture2D(uSrc, uv - vec2(0.0, amt * (ph0 - 0.5))).rgb;
      vec3 b = texture2D(uSrc, uv - vec2(0.0, amt * (ph1 - 0.5))).rgb;
      vec3 moving = mix(a, b, abs(ph0 * 2.0 - 1.0));
      // the swell: light bands rolling in, strongest where the water is nearest
      float band = sin(y * 26.0 - uTime * 1.25 + vnoise(vec2(uv.x * 3.0, uTime * 0.1)) * 2.0);
      moving *= 1.0 + uSwell * 0.035 * band * (0.3 + 0.7 * y);
      col = mix(col, moving, clamp(m, 0.0, 1.0));
    }
  }
  col = grade(col);
  col += (hash(uv * 1733.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

const STAGE_VERT = /* glsl */`
uniform sampler2D uDepth, uLayers;
uniform vec2 uTan, uCell;
uniform float uNear, uFar, uLayer, uHasLayers;
varying vec2 vUv;
varying float vD;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  // two layers from one depth map. The near layer takes the nearest depth within
  // one grid cell (dilate), so a triangle across a depth edge is stretched on its
  // far side, where the fragment shader drops it and the far layer shows through.
  // The far layer keeps the map's own depth, except around the subject (the
  // layers map's blue: a plate on a ledge), where it takes the farthest depth
  // (erode), so the subject's rim is a clean step onto what is behind it.
  float d = texture2D(uDepth, vUv).r;
  float subject = uHasLayers > 0.5 ? texture2D(uLayers, vUv).b : 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 q = vUv + vec2(float(i), float(j)) * uCell;
    float n = texture2D(uDepth, q).r;
    if (uLayer > 0.5) d = max(d, n);
    else if (uHasLayers > 0.5 && max(subject, texture2D(uLayers, q).b) > 0.02) d = min(d, n);
  }
  float z = 1.0 / (d * (1.0 / uNear - 1.0 / uFar) + 1.0 / uFar);
  vec3 p = vec3((vUv.x * 2.0 - 1.0) * uTan.x * z, (1.0 - vUv.y * 2.0) * uTan.y * z, -z);
  vD = d;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const STAGE_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uLook, uDepth;
uniform vec2 uCell;
uniform float uFocus, uMax, uBand, uGain, uCocToV, uPa, uTaps, uLookH, uClarity, uLayer, uSplit, uDebug;
varying vec2 vUv;
varying float vD;

float cocAt(float d) { return clamp((abs(d - uFocus) - uBand) / (1.0 - uBand), 0.0, 1.0) * uGain * uMax; }

void main() {
  float d0 = texture2D(uDepth, vUv).r;
  // a pixel farther than the near layer's surface is a stretched one: the near
  // layer drops it, and the far layer, drawn behind with nothing dropped, shows
  // what belongs there. (Dropping in both left holes where the depth map's edge
  // is soft and a pixel sits between the two.)
  if (uSplit > 0.5 && uLayer > 0.5 && vD - d0 > 0.03) {
    if (uDebug > 0.5) { gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); return; }
    discard;
  }
  // The far layer shows those pixels. Where its own texel is a near one (the
  // ledge's lip, the plate's rim, pushed back onto the far surface), it borrows
  // the colour of the nearest texel on the far side instead: a small inpaint
  // along the depth gradient, so no near pixel is ever smeared into the sea.
  vec2 uvS = vUv;
  if (uSplit > 0.5 && uLayer < 0.5 && d0 - vD > 0.03) {
    vec2 g = vec2(texture2D(uDepth, vUv + vec2(uCell.x, 0.0)).r - texture2D(uDepth, vUv - vec2(uCell.x, 0.0)).r,
                  texture2D(uDepth, vUv + vec2(0.0, uCell.y)).r - texture2D(uDepth, vUv - vec2(0.0, uCell.y)).r);
    vec2 dir = -normalize(g + vec2(1e-6)) * uCell * 0.75;
    for (int k = 1; k <= 12; k++) {
      vec2 q = vUv + dir * float(k);
      if (texture2D(uDepth, q).r - vD <= 0.03) { uvS = q; break; }
    }
    d0 = texture2D(uDepth, uvS).r;
  }
  float c0 = cocAt(d0);
  vec2 rv = vec2(uCocToV / uPa, uCocToV);           // stage-height fraction to photo uv
  // a blurred thing in front spreads over what is behind it (a lens does): look
  // around for nearer pixels whose blur reaches this far, and gather that wide
  float reach = uMax * uGain, R = c0;
  if (c0 < reach * 0.8 && d0 < 0.97) {   // a pixel already at full blur, or the nearest thing, needs no look
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7854 + (k < 4 ? 0.0 : 0.3927), rr = k < 4 ? 1.0 : 0.5;
      float dt = texture2D(uDepth, uvS + vec2(cos(a), sin(a)) * reach * rr * rv).r;
      if (dt > d0 + 0.03) R = max(R, min(cocAt(dt), reach * rr * 1.2));
    }
  }
  float rPx = R * uCocToV * uLookH;                  // the radius in look pixels
  vec3 col;
  if (rPx < 0.6) {
    col = texture2D(uLook, uvS).rgb;
    if (uClarity > 0.0) {
      vec2 px = 1.0 / vec2(uLookH * uPa, uLookH);
      vec3 blur = (texture2D(uLook, uvS + vec2(px.x, 0.0)).rgb + texture2D(uLook, uvS - vec2(px.x, 0.0)).rgb
                 + texture2D(uLook, uvS + vec2(0.0, px.y)).rgb + texture2D(uLook, uvS - vec2(0.0, px.y)).rgb) * 0.25;
      col += (col - blur) * uClarity * 1.6;
    }
  } else {
    // a disc of taps on a golden-angle spiral; a tap counts only if its own blur
    // reaches this far (a sharp plate never bleeds into the soft sea; a soft
    // plate in front does spread over a sharp sea), and the pixel itself always counts
    float taps = clamp(6.0 + rPx * 1.5, 8.0, uTaps);
    float lod = clamp(log2(rPx / sqrt(taps) * 1.6), 0.0, 5.0);
    float lod0 = clamp(log2(max(c0 * uCocToV * uLookH, 1.0) / sqrt(taps) * 1.6), 0.0, 5.0);
    vec3 acc = textureLod(uLook, uvS, lod0).rgb; float wsum = 1.0;
    for (int i = 0; i < 48; i++) {
      if (float(i) >= taps) break;
      float fi = float(i) + 0.5;
      float r = sqrt(fi / taps) * R;
      float a = fi * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r * rv;
      float ct = cocAt(texture2D(uDepth, uvS + o).r);
      float w = smoothstep(r - 0.15 * R, r + 0.05 * R, ct);
      acc += textureLod(uLook, uvS + o, lod).rgb * w; wsum += w;
    }
    col = acc / wsum;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * @param {any} THREE the three.js namespace
 * @param {HTMLCanvasElement} canvas
 * @param {{ look: HTMLImageElement|HTMLCanvasElement, depth: HTMLImageElement, layers?: HTMLImageElement|null,
 *   horizon?: number, shore?: number, ink?: number[], paper?: number[], grain?: number }} src
 */
export function createGLRenderer(THREE, canvas, src) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, powerPreference: 'default', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0xf4eee1, 1);
  canvas.__sgGL = renderer.getContext();

  const tex = img => {
    const t = new THREE.Texture(img);
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  };
  let lookSrc = tex(src.look);
  const depthTex = tex(src.depth);
  const layersTex = src.layers ? tex(src.layers) : null;

  const pa = (src.look.naturalWidth || src.look.width) / (src.look.naturalHeight || src.look.height);
  let lookH = 0, rt = null;
  const makeTarget = h => {
    rt?.dispose();
    lookH = h;
    rt = new THREE.WebGLRenderTarget(Math.round(h * pa), h, {
      depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    rt.texture.flipY = false;
    for (const m of mats) { m.uniforms.uLook.value = rt.texture; m.uniforms.uLookH.value = h; }
    lookDirty = true;
  };

  const lookMat = new THREE.ShaderMaterial({
    vertexShader: LOOK_VERT, fragmentShader: LOOK_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uSrc: { value: lookSrc }, uLayers: { value: layersTex }, uHasLayers: { value: layersTex ? 1 : 0 },
      uTime: { value: 0 }, uSea: { value: 0 }, uSwell: { value: 0 },
      uHorizon: { value: src.horizon ?? 0.33 }, uShore: { value: src.shore ?? 0.48 }, uPeriod: { value: 3.2 },
      uGrain: { value: src.grain ?? 0.018 }, uExposure: { value: 1 },
      uInk: { value: new THREE.Vector3(...(src.ink ?? [0.1, 0.09, 0.12])) },
      uPaper: { value: new THREE.Vector3(...(src.paper ?? [0.99, 0.975, 0.95])) },
    },
  });
  const lookScene = new THREE.Scene();
  lookScene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lookMat));
  const lookCam = new THREE.Camera();

  const stageUniforms = () => ({
    uLook: { value: null }, uDepth: { value: depthTex }, uTan: { value: new THREE.Vector2(1, 1) }, uCell: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 1 }, uFar: { value: 10 }, uFocus: { value: 0.2 }, uMax: { value: 0.016 }, uBand: { value: 0.05 },
    uGain: { value: 1 }, uCocToV: { value: 1 }, uPa: { value: pa }, uTaps: { value: 32 }, uLookH: { value: 1024 }, uClarity: { value: 0 },
    uLayer: { value: 1 }, uSplit: { value: 1 }, uDebug: { value: 0 },
    uLayers: { value: layersTex }, uHasLayers: { value: layersTex ? 1 : 0 },
  });
  const nearMat = new THREE.ShaderMaterial({ vertexShader: STAGE_VERT, fragmentShader: STAGE_FRAG, uniforms: stageUniforms() });
  const farMat = new THREE.ShaderMaterial({ vertexShader: STAGE_VERT, fragmentShader: STAGE_FRAG, uniforms: stageUniforms() });
  farMat.uniforms.uLayer.value = 0;
  const mats = [nearMat, farMat];
  // enough rows that the plate's rim and the ledge's edge keep their shape
  const COLS = 192, ROWS = Math.round(COLS / pa);
  const geo = new THREE.PlaneGeometry(1, 1, COLS, ROWS);
  const stageScene = new THREE.Scene();
  // near first, so the far layer only shades where the near one dropped a stretched pixel
  const nearMesh = new THREE.Mesh(geo, nearMat), farMesh = new THREE.Mesh(geo, farMat);
  nearMesh.renderOrder = 0; farMesh.renderOrder = 1;
  nearMesh.frustumCulled = farMesh.frustumCulled = false;
  stageScene.add(nearMesh, farMesh);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.2, 40);

  for (const m of mats) m.uniforms.uCell.value.set(1 / COLS, 1 / ROWS);
  const photoH = src.look.naturalHeight || src.look.height;
  let maxLook = Math.min(1280, Math.max(512, photoH));
  let lookDirty = true, lastLook = '', level = 1, w = 1, h = 1;
  makeTarget(1024);

  return {
    renderer, pa,
    get level() { return level; },
    /** Size in CSS px, the device pixel ratio, and a governor level (0.25..1) that scales pixels and taps. */
    resize(cssW, cssH, dpr = 1, lvl = 1, maxPixels = 1.0e6) {
      level = lvl; w = cssW; h = cssH;
      const k = Math.min(dpr, Math.sqrt(maxPixels / Math.max(1, cssW * cssH))) * (0.5 + 0.5 * lvl);
      renderer.setPixelRatio(k);
      renderer.setSize(cssW, cssH, false);
      for (const m of mats) m.uniforms.uTaps.value = Math.round(16 + 32 * lvl);
    },
    /** Swap the look's source (photo or drawing) without rebuilding anything else. */
    setSource(img) { lookSrc.dispose(); lookSrc = tex(img); lookMat.uniforms.uSrc.value = lookSrc; lookDirty = true; },
    setGrade({ exposure = 1, ink, paper } = {}) {
      lookMat.uniforms.uExposure.value = exposure;
      if (ink) lookMat.uniforms.uInk.value.set(...ink);
      if (paper) lookMat.uniforms.uPaper.value.set(...paper);
      lookDirty = true;
    },
    /** Draw one frame for a frameState() (depth-photo.core.js). */
    /** Test hooks: split = false draws one stretched sheet (the old way); debug paints the near layer's dropped pixels magenta. */
    /** The look target's tallest size: the photo's own height for an export, less on screen (the water redraws it). */
    setMaxLook(px) { maxLook = Math.max(384, Math.min(px, Math.max(512, photoH))); },
    debug({ split = true, debug = false, far = true } = {}) { for (const m of mats) { m.uniforms.uSplit.value = split ? 1 : 0; m.uniforms.uDebug.value = debug ? 1 : 0; } farMesh.visible = split && far; },
    draw(s) {
      // the look is sampled at about the resolution the stage shows the photo at: a
      // wide crop or a dolly shows less of it, bigger, so it needs more pixels (up to
      // the photo's own); more is wasted on the water every frame
      const bufH = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
      const shown = (s.win.top - s.win.bottom) / (2 * s.tanY) / (1 + Math.abs(s.cam.z) * 1.5);
      const want = Math.min(maxLook, Math.max(384, Math.round(bufH / shown * 1.1 / 128) * 128));
      if (Math.abs(want - lookH) >= 128) makeTarget(want);
      const moving = s.sea > 0 || s.swell > 0;
      const key = moving ? `${s.t}|${s.sea}|${s.swell}` : 'still';
      if (lookDirty || key !== lastLook) {
        const u = lookMat.uniforms;
        u.uTime.value = s.t; u.uSea.value = s.sea; u.uSwell.value = s.swell;
        renderer.setRenderTarget(rt);
        renderer.render(lookScene, lookCam);
        renderer.setRenderTarget(null);
        lookDirty = false; lastLook = key;
      }
      const tanX = s.tanY * pa, near = cam.near;
      for (const m of mats) m.uniforms.uTan.value.set(tanX, s.tanY);
      const { left, right, top, bottom } = s.win;
      cam.position.set(s.cam.x, s.cam.y, s.cam.z);
      cam.rotation.set(s.cam.pitch, 0, 0);
      cam.updateMatrixWorld();
      cam.projectionMatrix.makePerspective(left * near, right * near, top * near, bottom * near, near, cam.far);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      for (const m of mats) {
        const su = m.uniforms;
        su.uFocus.value = s.focus; su.uMax.value = s.blur.max; su.uBand.value = s.blur.band; su.uGain.value = s.blur.gain;
        // the stage shows (top - bottom) / (2 tanY) of the photo's height at rest
        su.uCocToV.value = (top - bottom) / (2 * s.tanY);
        su.uClarity.value = s.clarity;
      }
      renderer.render(stageScene, cam);
    },
    dispose() {
      lookSrc.dispose(); depthTex.dispose(); layersTex?.dispose(); rt?.dispose();
      lookMat.dispose(); nearMat.dispose(); farMat.dispose(); geo.dispose();
      lookScene.children[0].geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      delete canvas.__sgGL;
    },
  };
}
