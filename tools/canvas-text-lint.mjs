// The scene rule, checked: no text inside a canvas (docs/requests/2026-10-02-lighter-gate.md,
// C row 3, and docs/requests/2026-09-27-studio-scenes.md: "no text inside any canvas. Step
// labels, message text and names live in the page.")
//
//   node tools/canvas-text-lint.mjs [paths...]     none: every file in scope
//
// Scope: every render.js and every file under a skins/ folder in packages/ (scenes, surfaces,
// stage3d, transitions), where drawn words would hide from the DOM and screen readers.
//
//   ALLOWED   the decided exceptions, one line of reason each. New exceptions land here
//             with the owner's decision; a file not on the list and drawing text fails.
//
// Exit 1 when anything violates; every hit is printed with its line.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The decided exceptions: file (repo-rooted) -> why drawing on the canvas is decided. */
export const ALLOWED = new Map([
  ['packages/scenes/chai/render.js', 'the three plates are labelled under the drawings at rest; the labels are part of the printed sheet (owner, 2026-10-04)'],
  ['packages/scenes/ghat/render.js', 'the survey sheet\'s hand lettering: contour numbers and place names are drawn by hand in the fiction of the survey sheet (owner, 2026-10-04)'],
  ['packages/scenes/kairi/render.js', 'the block-print sketch labels the border\'s name as the pencil sharpens (owner, 2026-10-04)'],
  ['packages/scenes/khazan/render.js', 'the sluice gate\'s progress text ("in step · 34%") is a drawn instrument read of the oscillators; a value the page sets is also the scene status line, so a screen reader hears it (index.js status, tested) (owner, 2026-10-04)'],
  ['packages/scenes/mankurad/render.js', 'the short story\'s captioned pencil text, part of the drawn page (owner, 2026-10-04)'],
  ['packages/scenes/prahar/render.js', 'the prahar ruler names each watch and its raga in English and Devanagari, drawn as the ruler itself; an hour the page sets is also the scene status line, "Evening, Yaman, 19:10" (index.js status, tested) (owner, 2026-10-04)'],
  ['packages/scenes/tinto/render.js', 'the market sheet\'s stall names and prices are the drawn notice board\'s own lettering (owner, 2026-10-04)'],
  ['packages/components/date-range/skins/drawing.js', 'the calendar skin draws the month grid it is; its day numerals are the control, not page copy (owner, 2026-10-04)'],
  ['packages/components/signature/skins/paint.js', 'the signature pad\'s hint is drawn on the pad itself (owner, 2026-10-04)'],
]);

const PATTERN = /\b(fillText|strokeText)\b/;

/** The violations of one file's text: { line, what } per hit. */
export function lintText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    const m = PATTERN.exec(line);
    if (m) hits.push({ line: i + 1, what: m[1] });
  });
  return hits;
}

/** Every file in the lint's scope, repo-rooted. */
export function scope() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name === 'render.js' || p.includes('/skins/')) out.push(p);
    }
  };
  walk('packages');
  return out;
}

export function lintFiles(paths, allowed = ALLOWED) {
  const findings = [];
  for (const p of paths) {
    const abs = path.join(REPO, p);
    if (!fs.existsSync(abs)) { findings.push({ file: p, line: 0, what: 'file not found' }); continue; }
    if (allowed.has(p)) continue;
    for (const h of lintText(fs.readFileSync(abs, 'utf8'))) findings.push({ file: p, ...h });
  }
  return findings;
}

const argv = process.argv.slice(2);
const { pathToFileURL } = await import('node:url');
const runAsMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runAsMain) {
  const files = argv.length ? argv : scope();
  const findings = lintFiles(files);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.what} on a canvas`);
  console.log(`${files.length} file(s) scanned, ${findings.length} finding(s), ${ALLOWED.size} allowed exception(s)`);
  process.exit(findings.length ? 1 : 0);
}
