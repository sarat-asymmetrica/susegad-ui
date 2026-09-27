import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shaderError, compileProgram, createGL, glSurface, createGovernor, FULLSCREEN_VERT } from '../index.js';

/** Just enough WebGL to exercise the helper's logic in Node. */
function fakeGL({ badFrag = false, uniforms = [] } = {}) {
  const log = [];
  let lost = false;
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, HIGH_FLOAT: 5,
    ARRAY_BUFFER: 6, STATIC_DRAW: 7, FLOAT: 8, TRIANGLES: 9, ACTIVE_UNIFORMS: 10,
    log,
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    createShader: type => ({ type }),
    shaderSource: (s, src) => { s.src = src; },
    compileShader: () => {},
    getShaderParameter: s => !(badFrag && s.type === 2),
    getShaderInfoLog: () => 'ERROR: 0:3: \'vec5\' : no such type\n',
    deleteShader: s => log.push(['deleteShader', s.type]),
    createProgram: () => ({}),
    attachShader: () => {}, bindAttribLocation: () => {}, linkProgram: () => {},
    getProgramParameter: (p, k) => (k === 10 ? uniforms.length : true),
    getActiveUniform: (p, i) => uniforms[i],
    getUniformLocation: (p, name) => ({ name }),
    deleteProgram: () => log.push(['deleteProgram']),
    createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
    enableVertexAttribArray: () => {}, vertexAttribPointer: () => {}, useProgram: () => {},
    deleteBuffer: () => log.push(['deleteBuffer']),
    viewport: (...a) => log.push(['viewport', ...a]),
    drawArrays: () => log.push(['drawArrays']),
    isContextLost: () => lost,
    getExtension: n => (n === 'WEBGL_lose_context' ? { loseContext: () => { lost = true; log.push(['loseContext']); } } : null),
  };
  for (const s of ['uniform1f', 'uniform2f', 'uniform1i', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniform1fv', 'uniformMatrix3fv']) {
    gl[s] = (loc, ...v) => log.push([s, loc.name, ...v]);
  }
  return gl;
}
function fakeCanvas(gl, w = 2000, h = 1000) {
  const listeners = {};
  return {
    width: w, height: h,
    getContext: () => gl,
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: t => { delete listeners[t]; },
    fire: (t, e = {}) => listeners[t]?.({ preventDefault() { e.prevented = true; }, ...e }),
    listeners,
  };
}
const quiet = fn => { const w = console.warn, seen = []; console.warn = m => seen.push(m); try { fn(); } finally { console.warn = w; } return seen; };

test('shaderError shows the log and the offending lines', () => {
  const src = 'precision highp float;\nuniform vec2 uRes;\nvec5 bad;\nvoid main() {}';
  const msg = shaderError('fragment', "ERROR: 0:3: 'vec5' : no such type\n", src);
  assert.match(msg, /^fragment shader did not compile/);
  assert.match(msg, />\s+3 \| vec5 bad;/);
  assert.match(msg, / {2,}2 \| uniform vec2 uRes;/);
  assert.match(msg, /4 \| void main/);
  assert.doesNotMatch(msg, /1 \| precision/);
  assert.match(shaderError('vertex', '', 'x'), /no log/);
});

test('compileProgram throws a readable error and cleans up', () => {
  const gl = fakeGL({ badFrag: true });
  assert.throws(() => compileProgram(gl, FULLSCREEN_VERT, 'a\nb\nvec5 c;'), /fragment shader did not compile[\s\S]*> +3 \| vec5 c;/);
  assert.deepEqual(gl.log.filter(l => l[0] === 'deleteShader').map(l => l[1]).sort(), [1, 2]);
});

test('createGL: null without WebGL, null (with a warning) on a bad shader', () => {
  assert.equal(createGL({ getContext: () => null }, { frag: '' }), null);
  assert.equal(createGL({ getContext: () => { throw new Error('nope'); } }, { frag: '' }), null);
  const warned = quiet(() => assert.equal(createGL(fakeCanvas(fakeGL({ badFrag: true })), { frag: 'void main(){}', label: 'tollem' }), null));
  assert.equal(warned.length, 1);
  assert.match(warned[0], /^tollem: drawing in 2D\. fragment shader did not compile/);
});

test('createGL: precision, uniform setters by type, draw and release', () => {
  const gl = fakeGL({ uniforms: [
    { name: 'uT', type: 0x1406 }, { name: 'uRes', type: 0x8B50 }, { name: 'uTouch[0]', type: 0x8B52, size: 4 },
    { name: 'uTex', type: 0x8B5E }, { name: 'uM', type: 0x8B5B },
  ] });
  let got = '';
  const G = createGL(fakeCanvas(gl, 300, 200), { frag: p => (got = p, `precision ${p} float; void main(){}`) });
  assert.ok(G);
  assert.equal(G.precision, 'highp'); assert.equal(got, 'highp');
  assert.equal(G.set('uT', 1.5), true);
  G.set('uRes', 300, 200);
  G.set('uTouch', new Float32Array(16));
  G.set('uTex', 0);
  G.set('uM', [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(G.set('uMissing', 1), false);
  const calls = gl.log.filter(l => l[0].startsWith('uniform')).map(l => l.slice(0, 2).join(' '));
  assert.deepEqual(calls, ['uniform1f uT', 'uniform2fv uRes', 'uniform4fv uTouch[0]', 'uniform1i uTex', 'uniformMatrix3fv uM']);
  assert.deepEqual(G.u('uT'), { name: 'uT' });
  G.draw();
  assert.deepEqual(gl.log.slice(-2), [['viewport', 0, 0, 300, 200], ['drawArrays']]);
  G.release();
  assert.deepEqual(gl.log.slice(-2), [['deleteBuffer'], ['deleteProgram']]);
});

test('createGL adds a precision line to a bare string shader', () => {
  const gl = fakeGL();
  const seen = [];
  gl.shaderSource = (s, src) => seen.push(src);
  createGL(fakeCanvas(gl), { frag: 'void main(){}' });
  assert.match(seen[1], /^precision highp float;\nvoid main/);
});

test('glSurface: pixel cap, governor scaling, context loss and release', () => {
  const gl = fakeGL(), canvas = fakeCanvas(gl), gov = createGovernor({ window: 5 });
  const events = [];
  const S = glSurface(canvas, { frag: 'void main(){}', governor: gov, maxPixels: 1e6, onlost: () => events.push('lost'), onrestored: ok => events.push(`restored ${ok}`) });
  assert.equal(S.ok, true);
  S.size(2000, 1000);
  assert.equal(canvas.width * canvas.height <= 1e6 + 3000, true, `${canvas.width}×${canvas.height}`);
  assert.equal(canvas.width, 1414);
  for (let i = 0; i < 5; i++) gov.sample(50);
  assert.equal(gov.level, 0.75);
  let seen = null;
  assert.equal(S.draw((w, h) => { seen = [w, h]; }), true);
  assert.deepEqual(seen, [canvas.width, canvas.height], 'uniforms see the refitted size');
  assert.equal(canvas.width, Math.round(1414.2136 * 0.75));

  const e = {};
  canvas.fire('webglcontextlost', e);
  assert.equal(e.prevented, true);
  assert.equal(S.ok, false);
  assert.equal(S.draw(), false, 'caller draws the 2D fallback');
  assert.equal(S.set('uT', 1), false);
  canvas.fire('webglcontextrestored');
  assert.equal(S.ok, true);
  assert.deepEqual(events, ['lost', 'restored true']);

  S.release();
  assert.equal(S.ok, false);
  assert.deepEqual(Object.keys(canvas.listeners), []);
  assert.ok(gl.log.some(l => l[0] === 'loseContext'));
  assert.ok(gl.log.some(l => l[0] === 'deleteProgram'));
});

test('glSurface reports no WebGL as ok = false', () => {
  const S = glSurface({ width: 10, height: 10, getContext: () => null, addEventListener() {}, removeEventListener() {} }, { frag: '' });
  assert.equal(S.ok, false);
  assert.equal(S.draw(), false);
  S.release();
});
