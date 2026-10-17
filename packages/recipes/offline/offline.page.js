// The offline page as a string: the same markup in every language, from the words in recipe.strings.js.
// Pure, so a build script (the event template's pages.mjs) can write it and a test can read it.
//
// The page is shown by the worker at the address of whatever page was asked for ("/gom-deva/unvisited/"),
// so it cannot use paths relative to itself: every file it needs is addressed from `base`, the folder the
// site is served from ("/" by default). Without JavaScript it still says everything; the two buttons are
// hidden until retry.js has run, so there is never a button that does nothing.

import { strings } from '../../core/strings.js';
import { BY_LANG } from './recipe.strings.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ESC[c]);

/**
 * @param {{ lang: string, base?: string, register?: string, siteName?: string, styles?: string[], look?: string, script?: string }} o
 *   styles: stylesheet paths from `base`, in order (tokens, then the recipe's, then the site's); look: a script path from
 *   `base` read before first paint (the template's look.js, which lets ?register= pick a look); script: where
 *   retry.js is, from `base` (default: where the CLI copies it)
 */
export function offlinePage({ lang, base = '/', register = 'quiet', siteName = '', styles = [], look = '', script = 'susegad/recipes/offline/retry.js' }) {
  const S = strings(BY_LANG, lang), b = base.endsWith('/') ? base : `${base}/`;
  const li = k => `        <li>${esc(S[k])}</li>`;
  return `<!doctype html>
<html lang="${esc(lang)}" data-register="${esc(register)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(S.title)}${siteName ? ` | ${esc(siteName)}` : ''}</title>
${look ? `<script src="${b}${esc(look)}"></script>\n` : ''}${styles.map(h => `<link rel="stylesheet" href="${b}${esc(h)}">`).join('\n')}
<script type="module" src="${b}${esc(script)}"></script>
</head>
<body>
<main class="sg-offline" id="main">
  <h1>${esc(S.title)}</h1>
  <p class="sg-offline-lede">${esc(S.lede)}</p>
  <div class="sg-offline-lists">
    <section aria-labelledby="off-works">
      <h2 id="off-works">${esc(S.worksHeading)}</h2>
      <ul>
${li('works1')}
${li('works2')}
      </ul>
    </section>
    <section aria-labelledby="off-not">
      <h2 id="off-not">${esc(S.notHeading)}</h2>
      <ul>
${li('not1')}
${li('not2')}
${li('not3')}
      </ul>
    </section>
  </div>
  <p class="sg-offline-actions">
    <button type="button" class="sg-offline-button" data-offline="retry" hidden>${esc(S.retry)}</button>
    <button type="button" class="sg-offline-button sg-offline-plain" data-offline="back" hidden>${esc(S.back)}</button>
  </p>
</main>
</body>
</html>
`;
}
