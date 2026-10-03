// Mosaico: the canvas renderer. Ported from the sketchbook plate (read only,
// never edited): each tile is painted once into its own sprite (pigment,
// wear, chips, the odd crack), set into a grouted floor layer, and lifted out
// of it while it turns; the late window light is cached overlays; the ant is
// the plate's own. The port adds the registers, a floor that is a pure
// function of the seed and the hand's turns, the laying as a function of time,
// tiles that never turn under the page's words (the ant turns round there),
// the floor at night for a dark page, the governor, and a redraw only when
// the eye could see a change.

import { stage, rng, makeNoise, clamp, lerp, TAU, ease, ink, grainPattern } from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import {
  W, H, T, COLS, ROWS, ORDER, layTime, DROP, LAY_END, floorAt, antPlace, rippleTurns,
} from './model.js';

const GAP = 1.6, BAND = 0.17;
const CHALK = '#e9e0cb', RED = '#9a3d2b', INDIGO = '#2d3b5e', OCHRE = '#c7963c', GROUT = '#5e5446', BED = '#3f372d';

// ── A tile, painted once (the plate's own) ────────────────────────────────

/** Samples of a quarter circle about corner (cx, cy), inside the tile. */
function quarter(cx, cy, rad, from, n = 24) {
  return Array.from({ length: n + 1 }, (_, s) => { const a = from + (s / n) * (Math.PI / 2); return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; });
}
const hashTile = id => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000; return h; };

/** One tile, orientation 0, in tile units (0..T). Everything it wears is baked in. */
function drawTile(g, tile) {
  const r = rng(`tile:${tile.id}`), nz = makeNoise(hashTile(tile.id));
  g.save();
  g.beginPath(); g.rect(0, 0, T, T); g.clip();
  g.fillStyle = CHALK; g.fillRect(0, 0, T, T);
  // the bands
  for (const [cx, cy, from] of [[0, 0, 0], [T, T, Math.PI]]) {
    const outer = quarter(cx, cy, T * (0.5 + BAND), from), inner = quarter(cx, cy, T * (0.5 - BAND), from).reverse();
    g.fillStyle = RED; g.beginPath(); [...outer, ...inner].forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
  }
  // pigment that went on unevenly and has worn since: a soft noise wash
  const S = 20, m = document.createElement('canvas'); m.width = m.height = S;
  const mg = m.getContext('2d'), img = mg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = nz.fbm(x * 0.16, y * 0.16, 0.5, 3), q = (y * S + x) * 4;
    const light = v > 0;
    img.data[q] = light ? 250 : 60; img.data[q + 1] = light ? 240 : 40; img.data[q + 2] = light ? 222 : 30;
    img.data[q + 3] = Math.min(255, Math.abs(v) * 255 * (light ? 0.55 + tile.wear * 0.5 : 0.35));
  }
  mg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(m, -4, -4, T + 8, T + 8);
  // feet have worn the middle paler
  const wr = g.createRadialGradient(T * r.range(0.4, 0.6), T * r.range(0.4, 0.6), 4, T / 2, T / 2, T * 0.7);
  wr.addColorStop(0, `rgba(245,236,216,${0.1 + tile.wear * 0.16})`); wr.addColorStop(1, 'rgba(245,236,216,0)');
  g.fillStyle = wr; g.fillRect(0, 0, T, T);
  // indigo edges to the bands and the pale line down the middle
  let s = r() * 100;
  for (const [cx, cy, from] of [[0, 0, 0], [T, T, Math.PI]]) {
    ink(g, quarter(cx, cy, T * (0.5 - BAND) + 1.2, from), { width: 2.2, color: INDIGO, alpha: 0.85, jitter: 0.35, taper: 0, seed: s++ });
    ink(g, quarter(cx, cy, T * (0.5 + BAND) - 1.2, from), { width: 2.2, color: INDIGO, alpha: 0.85, jitter: 0.35, taper: 0, seed: s++ });
    ink(g, quarter(cx, cy, T * 0.5, from), { width: 2.4, color: '#f1e6cc', alpha: 0.85, jitter: 0.3, taper: 0, seed: s++ });
  }
  // an ochre quarter-dot in every corner, so four tiles make one dot
  for (const [cx, cy, from] of [[0, 0, 0], [T, 0, Math.PI / 2], [T, T, Math.PI], [0, T, -Math.PI / 2]]) {
    const q = quarter(cx, cy, T * 0.085, from, 10);
    g.fillStyle = OCHRE; g.beginPath(); g.moveTo(cx, cy); q.forEach(p => g.lineTo(...p)); g.closePath(); g.fill();
    ink(g, q, { width: 1.3, color: INDIGO, alpha: 0.7, jitter: 0.2, taper: 0, seed: s++ });
  }
  // grain
  g.globalAlpha = 0.16; g.fillStyle = grainPattern(g, '#3a2a1a', { lo: 0, hi: 0.9 }); g.fillRect(0, 0, T, T);
  g.globalAlpha = 1;
  // a crack in some tiles
  if (r() < 0.22) {
    const pts = []; let x = r.pick([0, T]), y = r.range(10, T - 10), a = x ? Math.PI : 0;
    for (let n = 0; n < 12; n++) { pts.push([x, y]); a += r.range(-0.5, 0.5); x += Math.cos(a) * 7; y += Math.sin(a) * 7; }
    ink(g, pts, { width: 0.7, color: '#2a2018', alpha: 0.5, jitter: 0.5, taper: 12, seed: s++ });
  }
  // bevelled edges catch the light at the top left
  g.fillStyle = 'rgba(255,250,236,0.35)'; g.fillRect(0, 0, T, 1.4); g.fillRect(0, 0, 1.4, T);
  g.fillStyle = 'rgba(30,20,10,0.3)'; g.fillRect(0, T - 1.6, T, 1.6); g.fillRect(T - 1.6, 0, 1.6, T);
  // chips knocked out of the edges, down to the grout
  const chips = r.int(0, 3);
  for (let c = 0; c < chips; c++) {
    const side = r.int(0, 3), along = r.range(12, T - 12), w = r.range(3, 9), d = r.range(2, 5);
    const local = [[-w, 0], [-w * 0.3, d], [w * 0.4, d * 0.7], [w, 0]].map(([u, v]) => [[along + u, v], [T - v, along + u], [along + u, T - v], [v, along + u]][side]);
    const out = side === 0 ? [[along + w, -2], [along - w, -2]] : side === 1 ? [[T + 2, along + w], [T + 2, along - w]] : side === 2 ? [[along + w, T + 2], [along - w, T + 2]] : [[-2, along + w], [-2, along - w]];
    const chip = [...local, ...out];
    g.fillStyle = '#8a7f6c'; g.beginPath(); chip.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
    ink(g, local, { width: 0.6, color: '#2a2018', alpha: 0.5, jitter: 0.2, taper: 2, seed: s++ });
  }
  g.restore();
}

function tileSprite(tile, px) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(T * px);
  const g = c.getContext('2d'); g.setTransform(px, 0, 0, px, 0, 0);
  drawTile(g, tile);
  return c;
}

/** Grout and the mortar bed: the floor with no tiles on it. */
function drawBed(g) {
  g.fillStyle = GROUT; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.3; g.fillStyle = grainPattern(g, '#1a140e', { lo: 0, hi: 1 }); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}

// ── Light through a barred window (the plate's own; a lamp-lit night for dark pages) ──

/** A soft mask, 1 in the light and 0 outside, drawn small and stretched, which softens it as a real sun does. */
function lightMask() {
  const s = 4, mw = Math.ceil(W / s), mh = Math.ceil(H / s);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const g = c.getContext('2d');
  g.scale(1 / s, 1 / s);
  const along = (u, v) => { const top = [lerp(470, 830, u), -30], bot = [lerp(150, 510, u), H + 30]; return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)]; };
  const quadUV = (u0, u1, v0, v1) => { g.beginPath(); [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].forEach(([u, v], i) => (i ? g.lineTo(...along(u, v)) : g.moveTo(...along(u, v)))); g.fill(); };
  g.fillStyle = '#fff'; quadUV(0, 1, 0, 1);
  g.fillStyle = '#000';
  for (const u of [0.2, 0.4, 0.6, 0.8]) quadUV(u - 0.022, u + 0.022, 0, 1);
  quadUV(0, 1, 0.46, 0.5);
  const t1 = document.createElement('canvas'); t1.width = Math.ceil(mw / 4); t1.height = Math.ceil(mh / 4);
  const t1g = t1.getContext('2d'); t1g.imageSmoothingQuality = 'high'; t1g.drawImage(c, 0, 0, t1.width, t1.height);
  const out = document.createElement('canvas'); out.width = mw; out.height = mh;
  const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
  og.filter = 'blur(1.2px)'; og.globalAlpha = 0.75; og.drawImage(c, 0, 0);
  og.filter = 'none'; og.globalAlpha = 0.25; og.drawImage(t1, 0, 0, mw, mh);
  return out;
}

function lightLayers(st, dark) {
  const mask = lightMask();
  // shade everywhere the light is not, plus a vignette and one sheet of grain
  const shade = st.layer(g => {
    g.fillStyle = dark ? 'rgb(92,98,138)' : 'rgb(196,184,190)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out'; g.imageSmoothingEnabled = true;
    g.globalAlpha = dark ? 0.55 : 1; g.drawImage(mask, 0, 0, W, H); g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(W * 0.55, H * 0.45, H * 0.3, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, dark ? 'rgba(20,24,50,0)' : 'rgba(90,70,80,0)'); vg.addColorStop(1, dark ? 'rgba(20,24,50,0.6)' : 'rgba(90,70,80,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  });
  const glow = st.layer(g => {
    g.drawImage(mask, 0, 0, W, H);
    g.globalCompositeOperation = 'source-in';
    const gr = g.createLinearGradient(0, 0, W, H);
    // by day the late sun; at night the same window, lit pale by the moon
    if (dark) { gr.addColorStop(0, 'rgba(170,190,240,0.22)'); gr.addColorStop(1, 'rgba(140,160,220,0.12)'); }
    else { gr.addColorStop(0, 'rgba(255,200,130,0.42)'); gr.addColorStop(1, 'rgba(255,170,95,0.22)'); }
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  });
  const grain = st.layer(g => { g.globalAlpha = 0.07; g.fillStyle = grainPattern(g, '#3a2f22', { lo: 0, hi: 0.9 }); g.fillRect(0, 0, W, H); });
  return { shade, glow, grain };
}

function drawAnt(g, x, y, ang, t, walking, k = 3) {
  g.save();
  g.translate(x, y); g.rotate(ang); g.scale(k, k);
  // its shadow, long in the late light
  g.fillStyle = 'rgba(30,20,10,0.18)'; g.beginPath(); g.ellipse(-0.6, 1.6, 5.4, 1.8, 0, 0, TAU); g.fill();
  g.strokeStyle = '#1a0e08'; g.lineWidth = 0.42; g.lineCap = 'round';
  const gait = walking ? t * 24 : 0;
  g.beginPath();
  for (let n = 0; n < 3; n++) for (const side of [-1, 1]) {
    const swing = Math.sin(gait + n * Math.PI + (side > 0 ? Math.PI : 0)) * 0.9;
    const bx = -0.6 + n * 0.7;
    g.moveTo(bx, 0); g.lineTo(bx + (n - 1) * 1.2 + swing, side * 2.1); g.lineTo(bx + (n - 1) * 1.9 + swing, side * 3.1);
  }
  const feel = walking ? 0 : Math.sin(t * 7) * 0.5;
  g.moveTo(2.8, -0.4); g.quadraticCurveTo(4, -1.8 - feel, 4.9, -1.6 + feel);
  g.moveTo(2.8, 0.4); g.quadraticCurveTo(4, 1.8 + feel, 4.9, 1.6 - feel);
  g.stroke();
  g.fillStyle = '#20120b';
  for (const [ex, rx, ry] of [[-3.1, 2.2, 1.6], [0, 1.25, 0.85], [2.3, 1.1, 1.05]]) { g.beginPath(); g.ellipse(ex, 0, rx, ry, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,210,170,0.3)'; g.beginPath(); g.ellipse(-3.5, -0.6, 0.8, 0.4, 0, 0, TAU); g.fill();
  // a grain of sugar from the tea things
  g.fillStyle = '#fbf6ea'; g.fillRect(4.3, -0.8, 1.5, 1.5);
  g.restore();
}

// ── The renderer ──────────────────────────────────────────────────────────

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function createRenderer(host, { register = 'warm', seed = 1, scene: sceneEl = null, invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let colors = null, sprites = new Map(), spriteKey = '', floorC = null, bedC = null, light = null, lightKey = '';
  let shown = new Array(COLS * ROWS).fill(null), lastKey = '', epoch = -1, inputs = [], hoverTile = -1, taps = 0;
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });
  st.onresize = () => { lastKey = ''; invalidate(); };

  let pumpFloor = null, pumping = false, dead = false;
  function pump() {
    pumping = false;
    if (dead || !pumpFloor) return;
    if (!paintSome(pumpFloor, 12)) { pumping = true; setTimeout(pump, 0); }
    lastKey = ''; invalidate();
  }
  const isDark = () => (colors ??= readColors(sceneEl ?? host, { dark: 'light-dark(#000000, #ffffff)' })).dark !== '#000000';

  /** Sprites are painted a few milliseconds' worth per frame, in laying order; a still waits for them all. */
  function paintSome(floor, budget) {
    const t0 = performance.now();
    for (const [i, j] of ORDER) {
      const tile = floor.at(i, j);
      if (sprites.has(tile.id)) continue;
      if (performance.now() - t0 > budget) return false;
      sprites.set(tile.id, tileSprite(tile, st.px));
    }
    return true;
  }

  function setTile(tile) {
    const g = floorC.getContext('2d'), px = st.px;
    g.setTransform(px, 0, 0, px, 0, 0);
    const x = tile.i * T, y = tile.j * T;
    g.save(); g.beginPath(); g.rect(x, y, T, T); g.clip();
    g.drawImage(bedC, x * px, y * px, T * px, T * px, x, y, T, T);
    g.translate(x + T / 2, y + T / 2); g.rotate(tile.k * Math.PI / 2);
    const s = T - GAP * 2;
    g.drawImage(sprites.get(tile.id), -s / 2, -s / 2, s, s);
    g.restore();
    shown[tile.j * COLS + tile.i] = tile.k;
  }
  function liftTile(tile) {
    const g = floorC.getContext('2d'), px = st.px;
    g.setTransform(px, 0, 0, px, 0, 0);
    const x = tile.i * T, y = tile.j * T;
    g.drawImage(bedC, x * px, y * px, T * px, T * px, x, y, T, T);
    g.fillStyle = BED; g.globalAlpha = 0.7; g.fillRect(x + 3, y + 3, T - 6, T - 6); g.globalAlpha = 1;
    shown[tile.j * COLS + tile.i] = -1;
  }

  function render(data, frame) {
    const dark = isDark(), still = frame.still, p = frame.pointer, calm = frame.calm || [];
    const time = data.time;
    if (frame.epoch !== epoch) { epoch = frame.epoch; inputs = []; hoverTile = -1; taps = 0; }
    // the tiles under the page's words: none of them turns, and the ant turns round at their edge
    const calmTiles = new Set();
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (calm.some(r => overlaps(r, { x: i * T + 4, y: j * T + 4, w: T - 8, h: T - 8 }))) calmTiles.add(j * COLS + i);
    // playful: entering a tile with the pointer turns it (the keyboard hand turns with Enter instead)
    if (data.look.touch && !still && p.inside && !p.keyboard && time > LAY_END) {
      const i = Math.floor(p.x / T), j = Math.floor(p.y / T), key = j * COLS + i;
      if (i >= 0 && j >= 0 && i < COLS && j < ROWS && key !== hoverTile) { hoverTile = key; inputs.push({ t: time, i, j, n: 1 }); }
    } else if (!p.inside) hoverTile = -1;
    const s = floorAt(data.seed, data.register, time, inputs, calmTiles, epoch);
    const floor = s.floor;
    // for the page and its checks: every tile's turn, and which tiles sit under words
    host.dataset.ks = floor.tiles.map(t => t.k).join('');
    host.dataset.calm = [...calmTiles].join(',');

    // layers that depend on size and theme
    const size = `${st.canvas.width}x${st.canvas.height}`;
    if (spriteKey !== `${size}|${data.seed}`) { spriteKey = `${size}|${data.seed}`; sprites = new Map(); floorC = null; }
    if (!floorC) { bedC = st.layer(drawBed); floorC = st.layer(g => g.drawImage(bedC, 0, 0, W, H)); shown.fill(null); lastKey = ''; }
    if (lightKey !== `${size}|${dark}`) { lightKey = `${size}|${dark}`; light = lightLayers(st, dark); lastKey = ''; }
    // tile images paint in slices off the frame (a timer, so a still page finishes too); each slice redraws
    pumpFloor = floor;
    const complete = sprites.size === floor.tiles.length || paintSome(floor, still ? 12 : 6);
    if (!complete && !pumping) { pumping = true; setTimeout(pump, 0); }

    // which tiles are dropping in, turning, or set in the floor
    const turning = new Map(s.turns.map(tr => [tr.j * COLS + tr.i, tr]));
    const air = [];
    for (const tile of floor.tiles) {
      const key = tile.j * COLS + tile.i, has = sprites.has(tile.id);
      if (!has) continue;
      const lay = still ? -1 : clamp((time - layTime(tile.i, tile.j)) / DROP);
      const tr = turning.get(key);
      if (tr) { if (shown[key] !== -1) liftTile(tile); air.push({ tile, tr }); continue; }
      if (lay < 1 && !still) { if (lay > 0) air.push({ tile, lay }); continue; }
      if (shown[key] !== tile.k) setTile(tile);
    }

    // redraw only when something the eye can see has changed
    const [ax, ay, aa] = antPlace(floor, s.ant);
    const showAnt = still || !data.look.walk ? 1 : clamp((time - LAY_END - 0.2) / 0.8);
    const busy = air.length > 0 || !complete || (showAnt > 0 && showAnt < 1);
    const key = `${ax.toFixed(1)},${ay.toFixed(1)}|${s.walking ? 'w' : Math.floor(time * 12)}|${frame.quality}|${dark}|${size}|${epoch}`;
    if (!busy && key === lastKey) return;
    lastKey = key;

    const g = st.begin();
    st.blit(floorC);
    // tiles in the air: dropping in, or turning
    const inAir = (tile, ang, lift) => {
      const cx = tile.i * T + T / 2, cy = tile.j * T + T / 2, sz = (T - GAP * 2) * (1 - 0.05 * lift);
      if ((frame.quality ?? 1) > 0.5) {
        g.save(); g.fillStyle = `rgba(20,12,6,${0.35 * lift})`;
        g.translate(cx + 7 * lift, cy + 9 * lift); g.rotate(ang); g.fillRect(-sz / 2, -sz / 2, sz, sz); g.restore();
      }
      g.save(); g.translate(cx, cy); g.rotate(ang);
      g.drawImage(sprites.get(tile.id), -sz / 2, -sz / 2, sz, sz);
      g.restore();
    };
    let antTurn = null;
    for (const a of air) {
      if (a.tr) {
        const u = clamp((time - a.tr.t0) / a.tr.dur);
        const back = (1 - ease.outBack(u)) * a.tr.n * Math.PI / 2;
        inAir(a.tile, a.tile.k * Math.PI / 2 - back, Math.sin(Math.PI * Math.min(1, u * 1.25)) * 0.9);
        if (a.tile.i === s.ant.i && a.tile.j === s.ant.j) antTurn = { tile: a.tile, back };
      } else {
        g.save(); g.globalAlpha = ease.outCubic(Math.min(1, a.lay * 2.5));
        inAir(a.tile, a.tile.k * Math.PI / 2, 1 - ease.outBounce(a.lay));
        g.restore();
      }
    }
    // the ant, riding a turning tile if it is on one
    if (showAnt > 0 && (still || time > LAY_END)) {
      let x = ax, y = ay, ang = aa;
      if (antTurn) {
        const cx = antTurn.tile.i * T + T / 2, cy = antTurn.tile.j * T + T / 2, c = Math.cos(-antTurn.back), sn = Math.sin(-antTurn.back);
        [x, y] = [cx + (ax - cx) * c - (ay - cy) * sn, cy + (ax - cx) * sn + (ay - cy) * c]; ang -= antTurn.back;
      }
      g.save(); g.globalAlpha = showAnt; drawAnt(g, x, y, ang, time, s.walking && !still, 3 * clamp(640 / (st.canvas.clientWidth || W), 1, 1.8)); g.restore();
    }
    // the keyboard hand, so a sighted keyboard user sees which tile Enter will turn
    if (p.keyboard && p.inside && data.look.touch) {
      const i = clamp(Math.floor(p.x / T), 0, COLS - 1), j = clamp(Math.floor(p.y / T), 0, ROWS - 1);
      ink(g, [[i * T + 6, j * T + 6], [i * T + T - 6, j * T + 6], [i * T + T - 6, j * T + T - 6], [i * T + 6, j * T + T - 6]], { width: 2.4, color: '#fbf6ea', alpha: 0.9, jitter: 0.4, closed: true, seed: 3 });
    }
    g.save();
    g.globalCompositeOperation = 'multiply'; st.blit(light.shade);
    g.globalCompositeOperation = 'screen'; st.blit(light.glow);
    g.globalCompositeOperation = 'source-over';
    if ((frame.quality ?? 1) > 0.75) st.blit(light.grain);
    g.restore();
    host.dataset.turns = String(s.turns.length);
    host.dataset.ant = `${s.ant.i},${s.ant.j}`;
    if (resolveReady && (complete || !still)) { resolveReady(); resolveReady = null; }
    lastTime = time;
  }
  let lastTime = 0;

  return {
    render,
    ready,
    setRegister() { lastKey = ''; },
    restyle() { colors = null; lastKey = ''; },
    /**
     * Playful. A click re-lays the patch round the pointer in a ripple (the plate's own);
     * Enter or Space turns the one tile under the keyboard hand by a quarter.
     */
    activate(p) {
      if (!p || lastTime <= LAY_END) return;
      if (p.keyboard) {
        const i = clamp(Math.floor(p.x / T), 0, COLS - 1), j = clamp(Math.floor(p.y / T), 0, ROWS - 1);
        inputs.push({ t: lastTime, i, j, n: 1 });
      } else inputs.push(...rippleTurns(sceneEl?.seed ?? seed, lastTime, p.x, p.y, taps));
      taps++;
      lastKey = ''; invalidate();
    },
    destroy() { dead = true; st.destroy(); },
  };
}
