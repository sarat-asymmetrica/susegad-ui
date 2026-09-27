#!/usr/bin/env node
// folio: build a sealed single-file document, and check one.
//
//   folio build <page.html> [--out file.html] [--budget 1.5MB] [--page A4|Letter] [--pdf [file.pdf]]
//   folio verify <file.html>

import { readFile } from 'node:fs/promises';

const HELP = `folio: one sealed .html file from a page, and a way to check it.

  folio build <page.html> [options]
      --out <file>        where to write it (default: <page>.folio.html)
      --budget <size>     fail when larger, e.g. 1.5MB (default 3MB)
      --page A4|Letter|auto  the printed page (default A4; auto: the reader's paper)
      --pdf [file]        also print it to PDF through Chromium
      --no-check          skip opening it with the network blocked

  folio verify <file.html>
      Checks the file against the seal in its footer. Exits 0 when it matches, 1 when it does not.
`;

const [cmd, file, ...rest] = process.argv.slice(2);
const flag = name => { const i = rest.indexOf(name); return i < 0 ? undefined : rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true; };

if (!cmd || cmd === 'help' || cmd === '--help' || !file) {
  process.stdout.write(HELP);
  process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 2 : 0);
}

if (cmd === 'verify') {
  const { verify } = await import('../build/seal.mjs');
  const r = verify(await readFile(file, 'utf8'));
  console.log(r.reason);
  if (r.digest) console.log(`Seal:   ${r.digest}\nActual: ${r.actual}`);
  process.exit(r.ok ? 0 : 1);
}

if (cmd === 'build') {
  const { build } = await import('../build/index.mjs');
  let r;
  try {
    r = await build(file, {
    out: typeof flag('--out') === 'string' ? flag('--out') : undefined,
    budget: typeof flag('--budget') === 'string' ? flag('--budget') : undefined,
    page: ['Letter', 'auto'].includes(flag('--page')) ? flag('--page') : 'A4',
    pdf: flag('--pdf'),
    check: !rest.includes('--no-check'),
    });
  } catch (e) {
    if (e.name !== 'MarkdownError') throw e;
    console.log(`${file} has ${e.problems.length === 1 ? 'a problem' : `${e.problems.length} problems`} to fix:`);
    for (const p of e.problems) console.log(`  line ${p.line}: ${p.message}`);
    process.exit(1);
  }
  console.log(`\n${r.table}\n`);
  for (const w of r.warnings) console.log(`note: ${w}`);
  console.log(`Wrote ${r.out}${r.pdf ? ` and ${r.pdf}` : ''}.`);
  console.log(`Sealed: sha256 ${r.digest}. Runtime style hashes added to the policy: ${r.runtimeHashes}.`);
  if (r.load) {
    const fine = !r.load.requests.length && !r.load.errors.length && !r.load.csp.length;
    console.log(fine
      ? `Opened with the network blocked: no requests, no errors, no policy violations; ${r.load.drawn} of ${r.load.scenes} scenes drew.`
      : `Opened with the network blocked and found problems:\n${[...r.load.requests.map(u => `  asked for ${u}`), ...r.load.csp.map(e => `  policy: ${e}`), ...r.load.errors.map(e => `  error: ${e}`)].join('\n')}`);
    if (!fine) process.exitCode = 1;
  }
  if (!r.ok) { console.log(`Over budget: the parts above are what to trim.`); process.exitCode = 1; }
} else {
  process.stdout.write(HELP);
  process.exit(2);
}
