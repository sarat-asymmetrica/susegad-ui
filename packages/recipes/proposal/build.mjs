#!/usr/bin/env node
// Build a proposal: Markdown in, one sealed .folio.html out, with its PDFs.
//
//   node packages/recipes/proposal/build.mjs <proposal.md> [--out file.folio.html]
//        [--budget 1.5MB] [--register quiet|warm|playful] [--pdf] [--page-only]
//   node packages/recipes/proposal/build.mjs --index      rewrite the recipe's index.html
//
// The Markdown becomes a proposal page (proposal.page.js), and Folio builds and
// seals that page (packages/folio/build). The page asks for the reader's own
// paper, so it prints on A4 or Letter; --pdf prints one of each. --page-only
// writes the unsealed page beside the source and stops, for looking at it served.

import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inline } from '../../folio/md/index.js';
import { renderersFor } from '../../folio/build/renderers.mjs';
import { proposalPage } from './proposal.page.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');

/** The index page's few inline lines: ?register, ?theme and ?palette set the look, as in the other recipes. */
const URL_LOOK = "for (const [k, v] of new URLSearchParams(location.search)) if (['register', 'theme', 'palette'].includes(k)) { document.documentElement.setAttribute(`data-${k}`, v); if (k === 'register') addEventListener('DOMContentLoaded', () => document.querySelectorAll('sg-scene').forEach(s => s.setAttribute('register', v))); }";

/** The proposal page for a Markdown source, as the builder or a browser beside the recipe will read it. */
export async function page(src, { base = '/packages/', register, inlineScript } = {}) {
  const { renderers } = await renderersFor(ROOT, inline);
  const exists = p => existsSync(join(ROOT, p));
  return proposalPage(src, { renderers, exists, base, register, inlineScript });
}

/** Rewrite index.html from the sample proposal, with paths relative to the recipe. */
export async function writeIndex() {
  const src = await readFile(join(HERE, 'examples/sample/proposal.md'), 'utf8');
  const r = await page(src, { base: '../../', inlineScript: URL_LOOK });
  await writeFile(join(HERE, 'index.html'), r.html);
  return { file: join(HERE, 'index.html'), warnings: r.warnings };
}

/**
 * Build one proposal.
 * @param {string} input  the Markdown source
 * @param {{ out?: string, budget?: string, register?: string, pdf?: boolean, pageOnly?: boolean, log?: (s: string) => void }} [o]
 */
export async function buildProposal(input, o = {}) {
  const log = o.log ?? (s => console.log(s));
  const md = resolve(input);
  const name = basename(md, '.md') === 'proposal' ? basename(dirname(md)) : basename(md, '.md');
  const out = resolve(o.out ?? join(dirname(md), `${name}.folio.html`));
  const r = await page(await readFile(md, 'utf8'), { register: o.register });
  for (const w of r.warnings) log(`note: ${w}`);
  const srcPage = join(dirname(md), `.${name}.proposal-src.html`);
  await writeFile(srcPage, r.html);
  if (o.pageOnly) return { page: srcPage, warnings: r.warnings };

  const { build } = await import('../../folio/build/index.mjs');
  const { printPdf, closeBrowser } = await import('../../folio/build/browser.mjs');
  let report;
  try {
    report = await build(srcPage, { out, budget: o.budget ?? '1.5MB', page: 'auto', check: true, log });
  } finally {
    await rm(srcPage, { force: true });
  }
  const pdfs = [];
  if (o.pdf) {
    for (const size of ['A4', 'Letter']) {
      const file = out.replace(/\.folio\.html$/i, `.${size}.pdf`);
      await printPdf(out, file, { page: size });
      pdfs.push(file);
    }
    await closeBrowser();
  }
  return { ...report, pdfs, warnings: [...r.warnings, ...report.warnings] };
}

// ── the command ───────────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--index')) {
    const r = await writeIndex();
    for (const w of r.warnings) console.log(`note: ${w}`);
    console.log(`Wrote ${r.file}.`);
  } else if (!args[0] || args[0].startsWith('--')) {
    console.log('Usage: node packages/recipes/proposal/build.mjs <proposal.md> [--out file] [--budget 1.5MB] [--register r] [--pdf] [--page-only]');
    process.exit(2);
  } else {
    const r = await buildProposal(args[0], { out: opt('--out'), budget: opt('--budget'), register: opt('--register'), pdf: args.includes('--pdf'), pageOnly: args.includes('--page-only') });
    if (r.page) console.log(`Wrote ${r.page} (not sealed).`);
    else {
      console.log(`\n${r.table}\n`);
      for (const w of r.warnings) console.log(`note: ${w}`);
      const fine = r.load && !r.load.requests.length && !r.load.errors.length && !r.load.csp.length;
      console.log(`Wrote ${r.out} (${(r.bytes / 1024).toFixed(1)} KB)${r.pdfs.length ? ` and ${r.pdfs.join(', ')}` : ''}.`);
      console.log(`Sealed: sha256 ${r.digest}.`);
      if (r.load) console.log(fine ? `Opened with the network blocked: no requests, no errors, no policy violations; ${r.load.drawn} of ${r.load.scenes} scenes drew.` : `Opened with the network blocked and found problems:\n${JSON.stringify(r.load, null, 1)}`);
      if (!r.ok || !fine) process.exitCode = 1;
    }
  }
}
