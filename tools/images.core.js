// Decision 0023 as code: pure, so it runs in Node on a list of files and a list of texts.
//
//   checkImages({ files: [{ path, size }], texts: [{ path, text }] }) -> { errors, warnings }
//
// Paths are posix and relative to the root being checked (the repo, or a built site). Errors:
//   no-gif          a GIF file, or a reference to one, in packages/, apps/, docs/readme/ or a README
//   raster-cap      a raster image in packages/ above CAP_BYTES
//   poster-siblings a poster (a file in a posters/ folder, or named *poster*) without its AVIF and WebP beside it
// Warnings (the picture is fine, the habit is not):
//   img-outside-picture   an <img> with a JPG or PNG src that is not inside <picture>
//   img-size              an <img> with a raster src that declares neither width and height nor an aspect-ratio

export const CAP_BYTES = 300 * 1024;
export const RASTER = /\.(png|jpe?g|gif|webp|avif)$/i;
const SOURCE_FORMAT = /\.(png|jpe?g)$/i; // the formats a poster is made from; AVIF and WebP are what it needs beside it
const POSTER = /(^|\/)posters\//i;
const GIF_SCOPE = /^(packages|apps)\/|^docs\/readme\/|(^|\/)readme(\.[a-z-]+)?\.md$/i;
const TEXT_SCOPE = /^(packages|apps)\/.*\.(html?|md)$|^docs\/readme\/.*\.(html?|md)$|(^|\/)readme(\.[a-z-]+)?\.md$/i;

const stemOf = p => p.replace(/\.[^./]+$/, '');
const lineOf = (text, i) => text.slice(0, i).split('\n').length;
const local = u => !/^([a-z][a-z0-9+.-]*:|\/\/|data:)/i.test(u);

/** The <img> tags of a text as { tag, src, at, inPicture }, with the extent of each <picture> taken into account. */
export function imgTags(text) {
  const pictures = [...text.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)].map(m => [m.index, m.index + m[0].length]);
  return [...text.matchAll(/<img\b[^>]*>/gi)].map(m => {
    const tag = m[0], src = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
    return { tag, src, at: m.index, inPicture: pictures.some(([a, b]) => m.index >= a && m.index < b) };
  });
}

export function checkImages({ files = [], texts = [] } = {}) {
  const errors = [], warnings = [];
  const have = new Set(files.map(f => f.path.toLowerCase()));
  const err = (rule, path, message) => errors.push({ rule, path, message });
  const warn = (rule, path, message) => warnings.push({ rule, path, message });

  for (const { path, size } of files) {
    const p = path.replaceAll('\\', '/');
    if (!RASTER.test(p)) continue;
    if (/\.gif$/i.test(p) && GIF_SCOPE.test(p)) err('no-gif', p, 'a GIF: make it an animated WebP, or a short muted <video> (decision 0023)');
    if (/^packages\//.test(p) && size > CAP_BYTES) err('raster-cap', p, `${(size / 1024).toFixed(0)} KB is over the ${CAP_BYTES / 1024} KB cap for a raster in packages/`);
    if (POSTER.test(p) || /poster/i.test(p.split('/').pop())) {
      if (SOURCE_FORMAT.test(p)) {
        const stem = stemOf(p).toLowerCase();
        for (const ext of ['avif', 'webp']) if (!have.has(`${stem}.${ext}`)) err('poster-siblings', p, `a poster needs its .${ext} beside it (decision 0023)`);
      }
    }
  }

  for (const { path, text } of texts) {
    const p = path.replaceAll('\\', '/');
    if (!TEXT_SCOPE.test(p)) continue;
    for (const m of text.matchAll(/(?:src|srcset|href)\s*=\s*["']([^"']+?\.gif)(?=[?#"'\s])|\]\(\s*<?([^)\s>]+?\.gif)(?=[?#)>\s])/gi)) {
      const url = m[1] ?? m[2];
      if (local(url)) err('no-gif', p, `line ${lineOf(text, m.index)} refers to ${url}, a GIF (decision 0023)`);
    }
    for (const t of imgTags(text)) {
      if (!RASTER.test(t.src.split(/[?#]/)[0]) || !local(t.src)) continue;
      const line = lineOf(text, t.at);
      if (!t.inPicture && SOURCE_FORMAT.test(t.src.split(/[?#]/)[0])) warn('img-outside-picture', p, `line ${line}: <img src="${t.src}"> is not inside <picture> (AVIF, then WebP, then this)`);
      const sized = (/\bwidth\s*=/i.test(t.tag) && /\bheight\s*=/i.test(t.tag)) || /aspect-ratio/i.test(t.tag);
      if (!sized) warn('img-size', p, `line ${line}: <img src="${t.src}"> declares no width and height, so the page shifts when it loads`);
    }
  }
  const order = (a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule) || a.message.localeCompare(b.message);
  return { errors: errors.sort(order), warnings: warnings.sort(order) };
}
