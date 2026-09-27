// poster.js: `poster-scene="paus"` renders a Susegad scene's finished still
// as the player's poster — a drawing, not a flat colour or a video frame
// grab. Mounts a throwaway, invisible <sg-scene>, calls its still(), copies
// the canvas it drew, and tears the scene down: this is a one-shot render,
// not a second live scene sitting behind the player.

import { whenSceneDefined } from '../core/index.js';

/**
 * @param {string} name a scene name, e.g. "paus" @param {{ width?: number, height?: number, register?: string, seed?: number|string }} [opts]
 * @returns {Promise<string|null>} a `data:image/png` URL, or null if the scene never painted (no canvas, e.g. an SVG scene)
 */
export async function renderPosterScene(name, { width, height, register = 'warm', seed } = {}) {
  try { await whenSceneDefined(name); } catch { return null; }
  const host = document.createElement('sg-scene');
  host.setAttribute('name', name);
  host.setAttribute('register', register);
  host.setAttribute('paused', '');
  if (seed !== undefined) host.setAttribute('seed', String(seed));
  host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:600px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);
  await customElements.whenDefined('sg-scene');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // mount, lay out, first paint
  host.still();
  await new Promise(r => requestAnimationFrame(r));
  const src = host.shadowRoot?.querySelector('canvas');
  let dataUrl = null;
  if (src && src.width && src.height) {
    const out = document.createElement('canvas');
    out.width = width || src.width; out.height = height || src.height;
    out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
    dataUrl = out.toDataURL('image/png');
  }
  host.destroy();
  host.remove();
  return dataUrl;
}
