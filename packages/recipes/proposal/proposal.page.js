// A proposal, from Markdown to a whole page. Pure: runs in Node at build time
// (build.mjs) and in a test. The Markdown is Folio's (packages/folio/md); this
// adds what makes it a proposal: a cover with the scene, who it is for and from,
// its date and how long it holds, a status stamp while it is a draft, one
// section per ## heading, tables that stack on a phone, and a way to keep a
// signed copy.
//
//   const { html, warnings } = proposalPage(src, { renderers, exists, base: '/packages/' });
//
// Front matter: title, for, from, date, valid-until (YYYY-MM-DD), status, lang,
// register, palette, theme, description.

import { render, inline, isoDate, sayDate } from '../../folio/md/index.js';
import { STRINGS } from './proposal.core.js';

export { STRINGS };

const FRONT = ['title', 'for', 'from', 'date', 'valid-until', 'status', 'lang', 'register', 'palette', 'theme', 'description'];
const REGISTERS = ['quiet', 'warm', 'playful'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const text = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/**
 * Markdown tables get a label on every cell from its column heading, so on a
 * phone each row can stack into a small card and still say what each value is.
 */
export function stackTables(html) {
  return html.replace(/<table>\n<thead>([\s\S]*?)<\/thead>([\s\S]*?)<\/table>/g, (all, head, body) => {
    const labels = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => text(m[1]));
    const rows = body.replace(/<tr>([\s\S]*?)<\/tr>/g, (_, cells) => {
      let i = 0;
      return `<tr>${cells.replace(/<td([^>]*)>/g, (__, a) => `<td${a} data-label="${esc(labels[i++] ?? '')}">`)}</tr>`;
    });
    return `<div class="proposal-table"><table data-cols="${labels.length}"${labels[0] === '' ? ' data-row-heads' : ''}>\n<thead>${head}</thead>${rows}</table></div>`;
  });
}

/** The rendered Markdown split into its cover (everything before the first ##), and one section per ##. */
export function sections(html) {
  const parts = html.split(/(?=<h2 id=")/);
  const head = /^<h2/.test(parts[0]) ? '' : parts.shift();
  const scene = /^\s*(<sg-scene\b[\s\S]*?<\/sg-scene>)/.exec(head);
  return {
    scene: scene ? scene[1] : '',
    lede: scene ? head.slice(scene[0].length).trim() : head.trim(),
    sections: parts.map(p => ({ id: /^<h2 id="([^"]+)"/.exec(p)[1], html: p.trim() })),
  };
}

/** The cover's meta: who it is for and from, when it was written, how long it holds. */
export function metaHTML(front) {
  const until = front['valid-until'] && isoDate(front['valid-until']) ? `<time datetime="${esc(front['valid-until'])}">${esc(sayDate(front['valid-until']))}</time>` : front['valid-until'] ? esc(front['valid-until']) : '';
  const rows = [[STRINGS.for, front.for && esc(front.for)], [STRINGS.from, front.from && esc(front.from)], [STRINGS.date, front.date && esc(front.date)], [STRINGS.holds, until]].filter(r => r[1]);
  return rows.length ? `<dl class="proposal-meta">\n${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}\n</dl>` : '';
}

/** The status while the proposal is a draft ("internal review, not for sending"), as a stamp that reads as words. */
export function statusHTML(status) {
  if (!status) return '';
  const [lead, ...rest] = String(status).split(/,\s*/);
  const say = lead.charAt(0).toUpperCase() + lead.slice(1);
  return `<sg-stamp class="proposal-status" tone="warning" seed="status"><p role="status"><strong>${esc(say)}</strong>${rest.length ? ` <span>${esc(rest.join(', '))}</span>` : ''}</p></sg-stamp>`;
}

/**
 * The whole proposal page.
 * @param {string} src  the Markdown
 * @param {{ renderers?: object, exists?: (p: string) => boolean, base?: string, register?: string,
 *   script?: string, inlineScript?: string }} [o]
 *   base: where packages/ is, as the page will see it ('/packages/' for the builder, '../../' beside the recipe).
 *   register: overrides the front matter's, scenes included.
 * @returns {{ html: string, warnings: string[], front: object, title: string }}
 */
export function proposalPage(src, o = {}) {
  const base = o.base ?? '/packages/';
  const exists = o.exists ?? (() => true);
  const r = render(src, { renderers: o.renderers ?? {} });
  const f = r.front, warnings = [];
  for (const k of Object.keys(f)) if (!FRONT.includes(k)) warnings.push(`front matter: ${k} is not used. A proposal reads ${FRONT.join(', ')}.`);
  const register = o.register ?? f.register ?? 'warm';
  if (!REGISTERS.includes(register)) throw new Error(`register must be quiet, warm or playful (it is "${register}")`);
  if (f['valid-until'] && !isoDate(f['valid-until'])) warnings.push(`front matter: valid-until should be a date written YYYY-MM-DD, like 2026-09-30 (it is "${f['valid-until']}").`);

  let body = stackTables(r.html);
  // a paragraph that opens with a superscript number is a footnote (Folio Markdown has no footnote syntax)
  body = body.replace(/<p>(?=[¹²³⁴⁵⁶⁷⁸⁹⁰])/g, '<p class="proposal-footnote">');
  // one register for the whole document: a scene follows the page unless the page says otherwise
  body = body.replace(/(<sg-scene\b[^>]*?) register="[^"]*"/g, `$1 register="${register}"`);
  // in a document the drawing is a picture: only playful makes it a thing to play with (and a tab stop)
  if (register !== 'playful') body = body.replace(/<sg-scene\b(?![^>]*\binteractive=)/g, '<sg-scene interactive="false"');
  const parts = sections(body);
  const where = p => (base !== '/packages/' && p.startsWith('/packages/recipes/proposal/') ? p.replace('/packages/recipes/proposal/', './') : p.replace(/^\/packages\//, base));

  // the modules the directives asked for, and the recipe's own
  const js = [], css = [];
  const want = (list, p) => { if (p && !list.includes(p)) { if (exists(p)) list.push(p); else warnings.push(`${p} is not in this project, so its plain version stands.`); } };
  for (const q of r.requires) { want(js, q.js); if (q.css && exists(q.css)) want(css, q.css); }
  for (const p of ['/packages/components/stamp/stamp.js', '/packages/recipes/proposal/proposal.js']) want(js, p);
  for (const p of ['/packages/components/stamp/stamp.css', '/packages/recipes/proposal/price-table.css', '/packages/recipes/proposal/timeline.css', '/packages/recipes/proposal/proposal.css']) want(css, p);

  const title = f.title ?? r.title ?? 'Proposal';
  const sectionsHTML = parts.sections.map(s => `<section class="proposal-section" aria-labelledby="${s.id}" data-section="${s.id}">\n${s.html}\n</section>`).join('\n');
  const keep = /<sg-signature\b/.test(body)
    ? `\n<div class="proposal-keep" data-folio-chrome hidden>\n<p class="proposal-keep__said" role="status">${STRINGS.unsigned}</p>\n<button type="button" class="proposal-keep__print">${STRINGS.keep}</button>\n</div>`
    : '';
  const withKeep = keep ? sectionsHTML.replace(/(<\/sg-signature>\n(?:<\/div>\n)?)/, `$1${keep}\n`) : sectionsHTML;

  const html = `<!doctype html>
<html lang="${esc(f.lang ?? 'en')}" data-register="${register}"${f.palette ? ` data-palette="${esc(f.palette)}"` : ''}${f.theme ? ` data-theme="${esc(f.theme)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(text(inline(title)))}</title>
${f.description ? `<meta name="description" content="${esc(f.description)}">\n` : ''}${o.inlineScript ? `<script>${o.inlineScript}</script>\n` : ''}<link rel="stylesheet" href="${where('/packages/tokens/fonts.css')}">
<link rel="stylesheet" href="${where('/packages/tokens/tokens.css')}">
${css.map(h => `<link rel="stylesheet" href="${where(h)}">`).join('\n')}
</head>
<body class="proposal-page">
<main class="folio-doc proposal">
<header class="proposal-cover">
<div class="proposal-cover__art">
${parts.scene || `<h1>${inline(title)}</h1>`}
${statusHTML(f.status)}
</div>
${metaHTML(f)}
</header>
${parts.lede ? `<div class="proposal-lede">\n${parts.lede}\n</div>\n` : ''}${withKeep}
</main>
<script type="module">
${js.map(p => `import '${where(p)}';`).join('\n')}
</script>
</body>
</html>
`;
  return { html, warnings, front: f, title };
}
