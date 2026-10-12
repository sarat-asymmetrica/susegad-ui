// Greeting card: a bloom grown from a guest's name, the name, and a line of text, drawn on one canvas and
// exported as a picture. PNG to keep, JPG to share (decision 0023). Every export reports the type it really
// produced, and the file is named after those bytes, never after what was asked for.
//
//   import { drawCard, exportCard, mountCard } from './recipe.js';
//   await drawCard(canvas, { name: 'Maria Fernandes', line: 'We look forward to seeing you.' });
//   const { blob, type, filename } = await exportCard(canvas, 'share', 'Maria Fernandes');
//
// The same name always draws the same card: the bloom is seeded from it, the paper is seeded, and nothing on
// the card depends on the page's theme or register. Only `register: 'quiet'` changes the card, to a head of
// plain dots.

import '../../components/bloom/bloom.js';
import { paper } from '../../engine/index.js';
import { canvasToPng, svgToPng } from '../../export/png.js';
import { CARD, PURPOSES, JPEG_QUALITY, PALETTE, sniff, fileName, wrap, fitSize, seedFor, layout } from './card.core.js';

const FONT = { display: '"Castoro", "Mukta", Georgia, serif', body: '"Mukta", system-ui, sans-serif' };

/** The bloom as a picture: an off-screen <sg-bloom> draws it, and its SVG is rasterised by the export package. */
async function bloomImage(name, register, size) {
  const host = document.createElement('div');
  host.hidden = true;
  const el = document.createElement('sg-bloom');
  el.setAttribute('register', register === 'quiet' ? 'quiet' : 'warm');
  el.setAttribute('seed-from', seedFor(name));
  host.append(el);
  document.body.append(host);
  try {
    if (!el.querySelector('svg')) await new Promise(r => el.addEventListener('sg-skin', r, { once: true }));
    const svg = /** @type {SVGSVGElement} */ (el.querySelector('svg').cloneNode(true));
    svg.setAttribute('color', PALETTE.dots); // the dots are currentColor
    return await createImageBitmap(await svgToPng(svg, { width: size, height: size }));
  } finally { host.remove(); }
}

/**
 * Draw a card on `canvas`. Resolves when it is finished (the fonts have loaded, the bloom is down).
 * @param {HTMLCanvasElement} canvas
 * @param {{ name: string, line?: string, register?: 'quiet' | 'warm' | 'playful' }} o
 */
export async function drawCard(canvas, { name, line = '', register = 'warm' }) {
  const { width, height } = CARD, L = layout(CARD);
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  await Promise.all([document.fonts.load(`400 80px ${FONT.display}`, name), document.fonts.load(`400 40px ${FONT.body}`, line)]).catch(() => {});
  paper(g, width, height, { base: PALETTE.paper, seed: 11, mottle: 0.035, grain: 0.015, fibers: 30, vignette: 0.06 });
  g.drawImage(await bloomImage(name, register, L.bloom.size), L.bloom.x, L.bloom.y, L.bloom.size, L.bloom.size);

  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const nameText = String(name ?? '').trim();
  const measureAt = (t, s) => { g.font = `400 ${s}px ${FONT.display}`; return g.measureText(t).width; };
  const size = fitSize(nameText, measureAt, L.name.maxWidth, { max: 104, min: 56 });
  g.fillStyle = PALETTE.ink;
  let extra = 0; // how far a name of several lines pushes the rule and the line down
  if (measureAt(nameText, size) <= L.name.maxWidth) { g.font = `400 ${size}px ${FONT.display}`; g.fillText(nameText, L.name.x, L.name.y); }
  else {
    // too long for one line at the smallest size: as many lines as it needs (three at most), never squeezed glyphs
    const small = 68; g.font = `400 ${small}px ${FONT.display}`;
    const lines = wrap(nameText, t => g.measureText(t).width, L.name.maxWidth, 3), lead = Math.round(small * 1.15);
    lines.forEach((t, i) => g.fillText(t, L.name.x, L.name.y + i * lead));
    extra = (lines.length - 1) * lead;
  }

  g.strokeStyle = PALETTE.rule; g.lineWidth = 2;
  g.beginPath(); g.moveTo(width / 2 - L.rule.half, L.rule.y + extra); g.lineTo(width / 2 + L.rule.half, L.rule.y + extra); g.stroke();

  g.font = `400 ${L.line.size}px ${FONT.body}`; g.fillStyle = PALETTE.soft;
  wrap(line, t => g.measureText(t).width, L.line.maxWidth).forEach((t, i) => g.fillText(t, L.line.x, L.line.y + extra + i * L.line.leading));
}

/** A canvas to a Blob of `type`. A browser that cannot encode it gives PNG, which is why the caller reads the bytes. */
const toBlob = (canvas, type) => new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas.toBlob gave no image'))), type, JPEG_QUALITY));

/**
 * Export a finished card. `purpose` is 'save' (PNG, lossless) or 'share' (JPG, which messaging apps handle
 * predictably); a MIME type is taken as it stands. The result says what it really is: `type` is read from the
 * bytes, `asked` is what was requested, and `filename` carries the extension of `type`.
 * @param {HTMLCanvasElement} canvas @param {'save' | 'share' | string} purpose @param {string} name
 * @returns {Promise<{ blob: Blob, bytes: Uint8Array, type: string, asked: string, filename: string }>}
 */
export async function exportCard(canvas, purpose, name) {
  const asked = PURPOSES[purpose] ?? purpose;
  const blob = asked === 'image/png' ? await canvasToPng(canvas) : await toBlob(canvas, asked);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = sniff(bytes) ?? blob.type;
  return { blob, bytes, type, asked, filename: fileName(name, type) };
}

/** A card's bytes as a hex SHA-256, to tell two cards apart or show they are the same. */
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Wire a card maker: `#name` and `#line` inputs, a `canvas#card`, buttons `#save` and `#share`, a `#status`
 * region. Redraws as the person types (after a short pause) and says plainly what was made.
 */
export function mountCard(root = document) {
  const $ = id => root.querySelector(`#${id}`);
  const canvas = $('card'), nameEl = $('name'), lineEl = $('line'), status = $('status');
  const register = () => document.documentElement.getAttribute('data-register') ?? 'warm';
  let timer = 0, drawn = null;
  const redraw = async () => {
    const o = { name: nameEl.value.trim() || 'Your name', line: lineEl.value, register: register() };
    drawn = o;
    await drawCard(canvas, o);
    canvas.setAttribute('aria-label', `Greeting card for ${o.name}${o.line ? `: ${o.line}` : ''}`);
  };
  const queue = () => { clearTimeout(timer); timer = setTimeout(redraw, 160); };
  nameEl.addEventListener('input', queue); lineEl.addEventListener('input', queue);
  $('maker').addEventListener('submit', e => e.preventDefault()); // Enter in a field makes no request

  async function make(purpose) {
    clearTimeout(timer);
    await redraw();
    const out = await exportCard(canvas, purpose, drawn.name);
    const file = new File([out.blob], out.filename, { type: out.type });
    if (purpose === 'share' && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: drawn.name }); status.textContent = `Shared ${out.filename}.`; return out; }
      catch (e) { if (e?.name === 'AbortError') { status.textContent = 'Sharing cancelled.'; return out; } /* otherwise fall through to the download */ }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(out.blob), download: out.filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const kind = out.type === 'image/png' ? 'PNG' : out.type === 'image/jpeg' ? 'JPG' : out.type;
    status.textContent = `Made ${out.filename}, a ${kind} of ${Math.max(1, Math.round(out.blob.size / 1024))} KB${out.type !== out.asked ? ` (this browser could not make ${out.asked}, so it made ${kind})` : ''}.`;
    return out;
  }
  $('save').addEventListener('click', () => make('save'));
  $('share').addEventListener('click', () => make('share'));
  return redraw();
}
