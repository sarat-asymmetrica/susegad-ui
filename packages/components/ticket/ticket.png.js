// The ticket as a picture the person keeps. A canvas is drawn from the card's blocks (ticket.core.js
// cardBlocks) and turned into a PNG with packages/export/png.js, as decision 0023 says exports are made.
// The picture reads well with nothing around it: the same labels and values as the page, in the page's
// language, then the code with the id under it, and the line that ends the registration.
//
// It is always on paper: light ink on cream whatever theme the page is in, because a picture lives in a
// phone's photos or a printout, not in a dark page. The colours are read from the page's own tokens with
// the scheme forced to light, so a different palette gives a ticket in that palette.
// Browser only (a canvas); the layout arithmetic that does not need one (wrapLines) is pure.

import { canvasToPng } from '../../export/png.js';
import { encode } from '../qr/qr.core.js';
import { cardBlocks, fileName } from './ticket.core.js';

/**
 * Break a text into lines no wider than `max`, at spaces (and anywhere inside a word wider than the line).
 * `measure(text)` gives a width, so a canvas can be swapped for a fake. Pure.
 * @param {(s: string) => number} measure @param {string} text @param {number} max
 */
export function wrapLines(measure, text, max) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  const push = () => { if (line) lines.push(line); line = ''; };
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next) <= max) { line = next; continue; }
    push();
    if (measure(w) <= max) { line = w; continue; }
    for (const ch of w) { if (measure(line + ch) > max && line) push(); line += ch; }
  }
  push();
  return lines;
}

/** The sizes of the picture, in CSS pixels before the scale. */
export const LAYOUT = { width: 600, pad: 48, qr: 248, quiet: 4 };

/** Colours from the page's tokens, read as light. */
function palette(root) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;color-scheme:light';
  root.append(probe);
  const read = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
  const font = v => { probe.style.fontFamily = `var(${v})`; return getComputedStyle(probe).fontFamily; };
  const out = {
    paper: read('--sg-paper'), raised: read('--sg-paper-raised'), ink: read('--sg-ink'), soft: read('--sg-ink-soft'), rule: read('--sg-rule-strong'), accent: read('--sg-accent'),
    display: font('--sg-font-display'), body: font('--sg-font-body'), mono: font('--sg-font-mono'),
  };
  probe.remove();
  return out;
}

/**
 * Draw the ticket and return it as a PNG Blob.
 * @param {{ id: string, name: string, event: string, at: string }} ticket the record (ticket.core.js makeTicket)
 * @param {{ lang?: string, scale?: number, root?: HTMLElement }} [opts]
 * @returns {Promise<Blob>}
 */
export async function ticketToPng(ticket, { lang = 'en', scale = 2, root = document.body } = {}) {
  const blocks = cardBlocks(ticket, lang), c = palette(root);
  const FONTS = { title: `500 40px ${c.display}`, label: `500 18px ${c.body}`, value: `500 28px ${c.body}`, id: `600 36px ${c.mono}`, note: `400 20px ${c.body}`, done: `400 28px ${c.display}` };
  // canvas text does not start a font download: ask for each face, with the very words, so the right script is fetched
  await Promise.all(blocks.filter(b => FONTS[b.kind]).map(b => document.fonts.load(FONTS[b.kind], b.text).catch(() => [])));
  const { width, pad, qr: qrSize, quiet } = LAYOUT, inner = width - pad * 2;
  const measure = document.createElement('canvas').getContext('2d');
  const wrapped = b => { measure.font = FONTS[b.kind]; return wrapLines(s => measure.measureText(s).width, b.text, inner); };
  const GAP = { title: 28, label: 4, value: 20, qr: 14, id: 20, note: 22, done: 0 };
  const LINE = { title: 46, label: 24, value: 36, id: 44, note: 28, done: 38 };
  // first pass: how tall is it?
  let y = pad;
  for (const b of blocks) y += (b.kind === 'qr' ? qrSize : wrapped(b).length * LINE[b.kind]) + GAP[b.kind];
  const height = Math.ceil(y + pad - GAP.done);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale; canvas.height = height * scale;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = c.paper; g.fillRect(0, 0, width, height);
  g.strokeStyle = c.rule; g.lineWidth = 2; g.beginPath(); g.roundRect(14, 14, width - 28, height - 28, 22); g.stroke();
  g.textBaseline = 'alphabetic';
  y = pad;
  const centered = new Set(['id', 'note', 'done']);
  for (const b of blocks) {
    if (b.kind === 'qr') {
      const sym = encode(b.text, { ecc: 'M' }), n = sym.size + quiet * 2, m = qrSize / n, x0 = (width - qrSize) / 2;
      g.fillStyle = c.raised; g.fillRect(x0, y, qrSize, qrSize);
      g.fillStyle = c.ink;
      sym.rows.forEach((row, ry) => { for (let rx = 0; rx < sym.size; rx++) if (row[rx] === '1') g.fillRect(x0 + (rx + quiet) * m, y + (ry + quiet) * m, Math.ceil(m), Math.ceil(m)); });
      y += qrSize + GAP.qr;
      continue;
    }
    g.font = FONTS[b.kind];
    g.fillStyle = b.kind === 'label' || b.kind === 'note' ? c.soft : b.kind === 'done' ? c.accent : c.ink;
    g.textAlign = centered.has(b.kind) ? 'center' : 'left';
    const x = centered.has(b.kind) ? width / 2 : pad;
    for (const line of wrapped(b)) { y += LINE[b.kind]; g.fillText(line, x, y - 10); }
    y += GAP[b.kind];
  }
  return canvasToPng(canvas);
}

/** Hand a Blob to the person as a file: a link with a download name, pressed once. */
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true;
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

/** Make the picture and offer it. Resolves to the file name; rejects if the browser could not make a PNG. */
export async function savePicture(ticket, opts) {
  const blob = await ticketToPng(ticket, opts);
  download(blob, fileName(ticket));
  return fileName(ticket);
}
