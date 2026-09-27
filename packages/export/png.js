// png.js: a canvas (or an SVG scene, rasterised first) to a PNG Blob.
// The pixel work is the browser's own `toBlob`; this just gives scenes and
// SVG a single, consistent way in.

/** A canvas element to a `image/png` Blob. @param {HTMLCanvasElement} canvas @returns {Promise<Blob>} */
export function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob gave no PNG'))), 'image/png');
  });
}

/**
 * Rasterise an inline `<svg>` element to a PNG Blob, at `width` × `height`
 * device pixels (pass a `scale` to render sharper than the SVG's own
 * viewBox size, e.g. for a print-resolution export).
 * @param {SVGSVGElement} svg @param {{ width?: number, height?: number, scale?: number, background?: string }} [opts]
 */
export async function svgToPng(svg, { width, height, scale = 1, background = null } = {}) {
  const box = svg.viewBox?.baseVal;
  const w = Math.round((width ?? box?.width ?? svg.clientWidth ?? 300) * scale);
  const h = Math.round((height ?? box?.height ?? svg.clientHeight ?? 150) * scale);
  const xml = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('svgToPng: the SVG did not decode as an image'));
    i.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (background) { g.fillStyle = background; g.fillRect(0, 0, w, h); }
  g.drawImage(img, 0, 0, w, h);
  return canvasToPng(canvas);
}

/** A PNG Blob to a `image/png` data URL, for inlining (a Folio document, a poster). */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
