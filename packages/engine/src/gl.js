// gl.js: a small WebGL helper, grown from Tollem and Themb. Canvas edge.
//
// createGL() is one full-screen fragment program; glSurface() wraps it with
// what a scene needs around it: a fallback signal, resolution scaled by the
// pixel budget and the governor, context loss and restore, and a release()
// that gives the GPU back. Always keep a 2D drawing for when `ok` is false.

/** A triangle that covers the viewport; attribute aPos is bound to location 0. */
export const FULLSCREEN_VERT = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

/** Turn a driver log into a readable error: the log, then the offending source
 *  lines with a line either side. Pure. @param {string} stage @param {string} log @param {string} src */
export function shaderError(stage, log, src) {
  const lines = src.split('\n'), bad = new Set();
  for (const m of String(log).matchAll(/ERROR:\s*\d+:(\d+)/g)) bad.add(+m[1]);
  const show = [...new Set([...bad].flatMap(n => [n - 1, n, n + 1]))].filter(n => n >= 1 && n <= lines.length).sort((a, b) => a - b);
  const excerpt = show.map(n => `${bad.has(n) ? '>' : ' '}${String(n).padStart(4)} | ${lines[n - 1]}`).join('\n');
  return `${stage} shader did not compile:\n${String(log || 'no log').trim()}${excerpt ? '\n' + excerpt : ''}`;
}

/** Compile and link; throws an Error with a readable message on failure.
 *  @param {WebGLRenderingContext} gl @returns {WebGLProgram} */
export function compileProgram(gl, vert, frag) {
  const compile = (type, src, stage) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    const msg = shaderError(stage, gl.getShaderInfoLog(s), src);
    gl.deleteShader(s);
    throw new Error(msg);
  };
  const vs = compile(gl.VERTEX_SHADER, vert, 'vertex');
  let fs;
  try { fs = compile(gl.FRAGMENT_SHADER, frag, 'fragment'); } catch (e) { gl.deleteShader(vs); throw e; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`shader program did not link:\n${String(log || 'no log').trim()}`);
  }
  return prog;
}

// uniform type → setter suffix (f/i vectors, m = matrix)
const SETTER = {
  0x1406: '1f', 0x8B50: '2f', 0x8B51: '3f', 0x8B52: '4f',
  0x1404: '1i', 0x8B56: '1i', 0x8B5E: '1i', 0x8B60: '1i',
  0x8B53: '2i', 0x8B54: '3i', 0x8B55: '4i', 0x8B57: '2i', 0x8B58: '3i', 0x8B59: '4i',
  0x8B5A: 'm2', 0x8B5B: 'm3', 0x8B5C: 'm4',
};

/**
 * @typedef {{ gl: WebGLRenderingContext, program: WebGLProgram, precision: 'highp' | 'mediump',
 *   u: (name: string) => WebGLUniformLocation | null, set: (name: string, ...v: any[]) => boolean,
 *   draw: () => void, release: () => void }} GL
 *   set('uRes', w, h) or set('uTouch', array) picks the setter from the uniform's type
 *   and returns false for an unused uniform. release() keeps the context.
 */

/**
 * One full-screen fragment program on `canvas`. Returns null when WebGL is
 * missing or the shader fails (the reason goes to console.warn): draw in 2D then.
 * `frag` is a string or prec => string; a string without a precision line gets one.
 * @param {HTMLCanvasElement} canvas
 * @param {{ frag: string | ((prec: string) => string), vert?: string, attrs?: WebGLContextAttributes, label?: string }} opts
 * @returns {GL | null}
 */
export function createGL(canvas, { frag, vert = FULLSCREEN_VERT, attrs, label = 'susegad' }) {
  attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power', ...attrs };
  let gl = null;
  try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch { gl = null; }
  if (!gl) return null;
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precision = hp && hp.precision > 0 ? 'highp' : 'mediump';
  let src = typeof frag === 'function' ? frag(precision) : frag;
  if (!/^\s*precision\s/m.test(src)) src = `precision ${precision} float;\n${src}`;
  let prog;
  try { prog = compileProgram(gl, vert, src); } catch (e) {
    if (!gl.isContextLost()) console.warn(`${label}: drawing in 2D. ${e.message}`);
    return null;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  const info = new Map(), locs = new Map();
  for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const a = gl.getActiveUniform(prog, i);
    info.set(a.name.replace(/\[0\]$/, ''), { loc: gl.getUniformLocation(prog, a.name), type: a.type });
  }
  return {
    gl, program: prog, precision,
    u: name => { if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name)); return locs.get(name); },
    set(name, ...v) {
      const e = info.get(name), k = e && SETTER[e.type];
      if (!k) return false;
      const val = v.length > 1 ? v : v[0];
      if (k[0] === 'm') gl[`uniformMatrix${k[1]}fv`](e.loc, false, val);
      else if (typeof val === 'number' || typeof val === 'boolean') gl[`uniform${k}`](e.loc, +val);
      else gl[`uniform${k}v`](e.loc, val);
      return true;
    },
    draw() { gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    release() { gl.deleteBuffer(buf); gl.deleteProgram(prog); },
  };
}

/**
 * A WebGL layer that looks after itself. `ok` is the fallback signal: when it
 * is false, draw the 2D version. size(pw, ph) takes the device-pixel size the
 * layer covers; the backing store is capped at `maxPixels` and scaled by the
 * governor's level, and follows the governor on the next draw().
 * onlost() fires when the context is lost; onrestored(ok) when it comes back.
 * @param {HTMLCanvasElement} canvas
 * @param {{ frag: string | ((prec: string) => string), vert?: string, attrs?: WebGLContextAttributes, label?: string,
 *   governor?: { level: number } | null, maxPixels?: number,
 *   onlost?: () => void, onrestored?: (ok: boolean) => void }} opts
 */
export function glSurface(canvas, { governor = null, maxPixels = 1.6e6, onlost, onrestored, ...opts }) {
  let G = createGL(canvas, opts), pw = canvas.width || 1, ph = canvas.height || 1, lvl = -1, dead = false;
  const fit = () => {
    lvl = governor ? governor.level : 1;
    const k = Math.min(1, Math.sqrt(maxPixels / (pw * ph))) * lvl;
    const w = Math.max(1, Math.round(pw * k)), h = Math.max(1, Math.round(ph * k));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };
  const lost = e => { e.preventDefault(); G = null; onlost?.(); };
  const restored = () => { if (dead) return; G = createGL(canvas, opts); if (G) fit(); onrestored?.(!!G); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  if (G) fit();
  return {
    get ok() { return !!G; },
    get gl() { return G ? G.gl : null; },
    get scale() { return canvas.width / pw; },
    set: (name, ...v) => (G ? G.set(name, ...v) : false),
    size(w, h) { pw = Math.max(1, w); ph = Math.max(1, h); if (G) fit(); },
    /** Follow the governor, call `uniforms(width, height)` with the backing-store
     *  size (set uRes there), then draw. @returns {boolean} whether it drew */
    draw(uniforms) {
      if (!G) return false;
      if (governor && governor.level !== lvl) fit();
      uniforms?.(canvas.width, canvas.height);
      G.draw();
      return true;
    },
    release() {
      dead = true;
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      if (G) { const gl = G.gl; G.release(); gl.getExtension('WEBGL_lose_context')?.loseContext(); G = null; }
    },
  };
}
