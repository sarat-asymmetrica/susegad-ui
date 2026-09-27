// The matrix contact sheet: one HTML page, every cell's screenshot and verdict.
// Pure (report in, string out); tested in sheet.test.mjs.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cellHtml(c) {
  const label = `${c.view} · ${c.theme}${c.reduced ? ' · reduced motion' : ''}`;
  const problems = [
    ...(c.ready && !c.ready.ok ? [`not ready: ${c.ready.reason}`] : []),
    ...(c.errors?.harness ? [`harness: ${c.errors.harness}`] : []),
    ...(c.errors?.console ?? []).map(e => `console: ${e}`),
    ...(c.errors?.page ?? []).map(e => `page error: ${e}`),
    ...(c.errors?.requests ?? []).map(e => `request: ${e}`),
    ...(c.overflow && !c.overflow.pass ? [`horizontal overflow: ${c.overflow.scrollWidth}px in a ${c.overflow.innerWidth}px viewport`] : []),
    ...(c.pointer?.status === 'fail' ? [`pointer: ${c.pointer.reason}`] : []),
  ];
  const checks = [
    ['errors', c.errors ? String(c.errors.count) : '?'],
    ['overflow', c.overflow ? (c.overflow.pass ? 'none' : 'yes') : '?'],
    ['pointer', c.pointer?.status ?? '?'],
  ];
  return `
      <figure class="cell ${c.pass ? 'ok' : 'bad'}">
        <a href="${esc(c.shot)}"><img src="${esc(c.shot)}" alt="${esc(`${c.register}, ${label}`)}" loading="lazy"></a>
        <figcaption>
          <span class="where">${esc(label)}</span>
          <span class="mark">${c.pass ? 'pass' : 'fail'}</span>
          <dl>${checks.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${c.pointer?.status === 'not run' ? `<p class="note">Pointer not run: ${esc(c.pointer.reason)}</p>` : ''}
          ${problems.length ? `<ul class="problems">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        </figcaption>
      </figure>`;
}

/** @param {any} report the matrix index.json object */
export function renderSheet(report, slug) {
  const groups = new Map();
  for (const c of report.cells) {
    if (!groups.has(c.register)) groups.set(c.register, []);
    groups.get(c.register).push(c);
  }
  const t = report.target;
  const what = t.scene ? `scene ${t.scene}${t.seed != null ? `, seed ${t.seed}` : ''}` : `page ${t.url}${t.javascript === false ? ', JavaScript off' : ''}`;
  const { passed, cells } = report.summary;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Matrix: ${esc(slug)}</title>
<style>
  :root {
    color-scheme: light dark;
    --paper: #f4efe4; --card: #fbf8f1; --ink: #1d2742; --soft: #5d6378; --rule: #d9d1c0;
    --ok: #2f6b4f; --bad: #b8412a;
  }
  @media (prefers-color-scheme: dark) {
    :root { --paper: #15182a; --card: #1d2136; --ink: #ece3d0; --soft: #a8a491; --rule: #33384f; --ok: #7cc49c; --bad: #ec8a67; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 14px/1.5 system-ui, sans-serif; }
  header, section { max-width: 1400px; margin: 0 auto; padding: 0 16px; }
  header { padding-top: 32px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
  h1 { font: 500 28px/1.2 Georgia, 'Times New Roman', serif; margin: 0 0 4px; }
  .sub { color: var(--soft); margin: 0 0 12px; }
  .tally { font-variant-numeric: tabular-nums; }
  .tally b { color: ${passed === cells ? 'var(--ok)' : 'var(--bad)'}; }
  h2 { font: italic 400 22px/1.2 Georgia, serif; margin: 28px 0 12px; text-transform: capitalize; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 16px; align-items: start; }
  .cell { margin: 0; background: var(--card); border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; }
  .cell.bad { border-color: var(--bad); box-shadow: inset 0 3px 0 var(--bad); }
  .cell img { display: block; width: 100%; height: auto; max-height: 420px; object-fit: contain; object-position: top; background: var(--paper); border-bottom: 1px solid var(--rule); }
  figcaption { padding: 10px 12px 12px; display: grid; grid-template-columns: 1fr auto; gap: 6px 8px; }
  .where { font-weight: 600; }
  .mark { align-self: start; font: 600 11px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; padding: 4px 6px; border: 1.5px solid currentColor; border-radius: 3px; transform: rotate(-3deg); }
  .ok .mark { color: var(--ok); } .bad .mark { color: var(--bad); }
  dl { grid-column: 1 / -1; display: flex; gap: 14px; margin: 0; color: var(--soft); font-size: 12px; }
  dl div { display: flex; gap: 4px; } dt::after { content: ':'; } dd { margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
  .note, .problems { grid-column: 1 / -1; margin: 0; font-size: 12px; color: var(--soft); }
  .problems { padding-left: 16px; color: var(--bad); overflow-wrap: anywhere; }
  footer { max-width: 1400px; margin: 32px auto; padding: 0 16px; color: var(--soft); font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>Register matrix</h1>
  <p class="sub">${esc(what)} · Chromium ${esc(report.chromium)} · ${esc(report.date)} · shot ${esc(report.settleSeconds)} s after ready</p>
  <p class="tally"><b>${passed} of ${cells}</b> cells pass${report.summary.failed.length ? `. Failing: ${esc(report.summary.failed.join(', '))}` : ''}</p>
</header>
<main>
${[...groups].map(([reg, cs]) => `  <section aria-labelledby="r-${esc(reg)}">
    <h2 id="r-${esc(reg)}">${esc(reg)}</h2>
    <div class="grid">${cs.map(cellHtml).join('')}
    </div>
  </section>`).join('\n')}
</main>
<footer>Desktop is 1280 px at 1x. Phone is 390 px at 3x with touch. Written by tools/matrix.mjs; the numbers are in index.json beside this page.</footer>
</body>
</html>
`;
}
