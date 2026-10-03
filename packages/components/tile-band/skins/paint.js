// Tile band: the painter. One function, drawTile, paints one tile into a cell of a 2D canvas:
// 'line' is the quiet look (cobalt hairline, flat, no fills) and 'glaze' is the warm and playful
// look (a glazed white tile, brush-painted cobalt with a bleed of pigment under each stroke, the
// pooling of the glaze at its edges, a sheen, a bevel and a fine crackle). A tile is a pure function
// of its spec (layBand's seeded numbers), so painting it again, as a turning tile is painted
// every frame, gives the same tile.
import { grainPattern } from '../../../engine/src/paper.js';
import { motif, pigmentOf, crackle, turnOf } from '../tile-band.core.js';

const rad = d => (d * Math.PI) / 180;
const ALPHA = { blue: 0.93, wash: 0.8, lemon: 0.96, leaf: 0.92 };

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} tile one tile of layBand()
 * @param {{ x: number, y: number, size: number, look: 'line'|'glaze', colors: Record<string,string>, tones: string,
 *   vertical: boolean, dpr: number, angle?: number, lift?: number }} o device pixels throughout
 *   `angle` is extra degrees of an unfinished turn; `lift` (0 to 1) shrinks the art as it is picked up.
 */
export function drawTile(g, tile, { x, y, size, look, colors, tones, vertical, dpr, angle = 0, lift = 0 }) {
  const k = size / 100, glaze = look === 'glaze';
  g.save();
  g.translate(x, y);
  g.beginPath(); g.rect(0, 0, size, size); g.clip();
  if (glaze) ground(g, tile, size, colors, dpr);

  // the art: set down a hair off true, as a hand does, and turned as the tile is turned
  g.save();
  const sc = tile.scale * (1 - 0.12 * lift);
  g.translate(size / 2 + tile.dx * k, size / 2 + tile.dy * k);
  g.rotate(rad(turnOf(tile, vertical) * 90 + tile.rot + angle));
  g.scale(k * sc, k * sc);
  g.translate(-50, -50);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const hair = dpr / (k * sc);
  for (const l of motif(tile.motif)) {
    const role = pigmentOf(l.role, tones), p = new Path2D(l.d);
    if (!glaze) {
      if (role === 'ground') continue;
      g.lineWidth = hair; g.strokeStyle = colors.ink; g.stroke(p);
      continue;
    }
    if (role === 'ground') { g.fillStyle = colors.ground; g.fill(p); g.lineWidth = 0.9 * tile.weight; g.strokeStyle = colors.ink; g.globalAlpha = 0.85; g.stroke(p); g.globalAlpha = 1; continue; }
    if (l.mode === 'stroke') {
      g.strokeStyle = colors.blue;
      g.globalAlpha = 0.16; g.lineWidth = l.w * 1.7 * tile.weight; g.stroke(p);
      g.globalAlpha = 0.95; g.lineWidth = l.w * tile.weight; g.stroke(p);
      g.globalAlpha = 1;
      continue;
    }
    const pigment = colors[role] ?? colors.blue;
    g.fillStyle = pigment; g.strokeStyle = pigment;
    g.globalAlpha = 0.18; g.lineWidth = 2.6 * tile.weight; g.stroke(p);   // the pigment bled under the brush
    g.globalAlpha = ALPHA[role] ?? 0.9; g.fill(p);
    g.globalAlpha = 0.9; g.lineWidth = 1.05 * tile.weight; g.strokeStyle = colors.ink; g.stroke(p);
    g.globalAlpha = 1;
  }
  g.restore();

  if (glaze) over(g, tile, size, k, dpr);
  else { g.lineWidth = dpr; g.strokeStyle = colors.ink; g.globalAlpha = 0.4; g.strokeRect(dpr / 2, dpr / 2, size - dpr, size - dpr); g.globalAlpha = 1; }
  g.restore();
}

/** The glazed body of the tile: white with a little give in its tone, grain, and a pooling at the edges. */
function ground(g, tile, size, colors, dpr) {
  g.fillStyle = colors.ground; g.fillRect(0, 0, size, size);
  g.fillStyle = tile.tint > 0 ? `rgba(255,252,236,${0.35 * tile.tint})` : `rgba(120,140,190,${-0.09 * tile.tint})`;
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.05; g.fillStyle = grainPattern(g, colors.ink, { lo: 0, hi: 0.7 }); g.fillRect(0, 0, size, size); g.globalAlpha = 1;
  const pool = g.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.78);
  pool.addColorStop(0, 'rgba(60,90,160,0)'); pool.addColorStop(1, `rgba(60,90,160,${0.05 + 0.1 * tile.pool})`);
  g.fillStyle = pool; g.fillRect(0, 0, size, size);
}

/** What lies over the painting: the crackle in the glaze, the sheen, the bevel and the grout. */
function over(g, tile, size, k, dpr) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const cracks = crackle(tile.crackle, { cracks: 2 + Math.round(tile.pool * 2) });
  for (const [pass, off, style, w] of [[0, 0, 'rgba(70,62,48,0.3)', 0.8], [1, 0.9, 'rgba(255,255,255,0.5)', 0.7]]) {
    g.strokeStyle = style; g.lineWidth = w * dpr;
    for (const line of cracks) {
      g.beginPath();
      line.forEach(([px, py], i) => (i ? g.lineTo(px * k + off * pass * dpr, py * k + off * pass * dpr) : g.moveTo(px * k + off * pass * dpr, py * k + off * pass * dpr)));
      g.stroke();
    }
  }
  const sheen = g.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.3)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(30,50,110,0.07)');
  g.fillStyle = sheen; g.fillRect(0, 0, size, size);
  const e = Math.max(1, dpr * 1.2);
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, 0, size, e); g.fillRect(0, 0, e, size);
  g.fillStyle = 'rgba(40,60,110,0.22)'; g.fillRect(0, size - e, size, e); g.fillRect(size - e, 0, e, size);
}
