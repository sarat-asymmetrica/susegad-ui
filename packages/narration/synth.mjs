#!/usr/bin/env node
// Fill the fixture cache from a script, calling the network only on a
// cache miss. Takes a JSON file of either a plain string (split with
// splitPhrases) or an array of phrase objects, `{ beat?, text, pace?,
// pause_after? }`, the shape `story/spread.json`'s `en`/`mr` blocks use.
//
//   node packages/narration/synth.mjs script.json --lang en-IN --voice shubh
//   node packages/narration/synth.mjs script.json --lang en-IN --provider sarvam --model bulbul:v3
//
// Prints one line per phrase (hit or a fresh call) and a summary: how many
// phrases, how many were already cached, and the total audio duration, so
// a caller can see exactly what it is about to spend before running it
// again with --provider sarvam.

import { readFile } from 'node:fs/promises';
import { synthesizeScript, synthesizePhrases } from './index.js';
import stubProvider from './providers/stub.js';
import sarvamProvider from './providers/sarvam.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i++; }
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptPath = args._[0];
  if (!scriptPath) {
    console.error('usage: node packages/narration/synth.mjs <script.json> --lang <code> [--voice v] [--model m] [--pace p] [--provider stub|sarvam] [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const lang = args.lang;
  if (!lang) { console.error('--lang is required, e.g. en-IN or mr-IN'); process.exitCode = 1; return; }
  const provider = args.provider === 'sarvam' ? sarvamProvider : stubProvider;
  const pace = args.pace ? Number(args.pace) : undefined;

  const raw = JSON.parse(await readFile(scriptPath, 'utf8'));
  const run = Array.isArray(raw)
    ? phrases => synthesizePhrases(phrases, { lang, voice: args.voice, model: args.model, pace, provider })
    : text => synthesizeScript(text, { lang, voice: args.voice, model: args.model, pace, provider });

  if (args['dry-run']) {
    console.log(`dry run: would synthesize with provider "${provider.name}", lang ${lang}, ${Array.isArray(raw) ? raw.length : 'auto-split'} phrase(s). Nothing was called.`);
    return;
  }

  const result = await run(raw);
  for (const p of result.phrases) {
    console.log(`${p.fromCache ? 'cached' : 'called'}  ${p.beat ? `[${p.beat}] ` : ''}${p.durationSec.toFixed(2)}s  "${p.text}"`);
  }
  const misses = result.calls.filter(c => !c.fromCache).length;
  console.log(`\n${result.phrases.length} phrase(s), ${misses} network call(s), ${result.durationSec.toFixed(1)}s of audio total.`);
}

main().catch(err => { console.error(err.message); process.exitCode = 1; });
