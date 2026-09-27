#!/usr/bin/env node
// Build the storybook spread's narration: read story/spread.json (Kathakar's,
// read here, never edited), synthesise both languages, and write the audio
// track and WebVTT caption/highlight file this recipe ships.
//
//   node packages/recipes/storybook-spread/build.mjs             # from the cache, stub on a miss
//   node packages/recipes/storybook-spread/build.mjs --provider sarvam
//
// Every call goes through the narration fixture cache (packages/narration/
// fixtures/), so a repeat build costs nothing and this script is safe to
// run as part of `npm test` setup or CI: with no key and nothing cached, it
// falls back to the stub provider and says so, rather than failing the build.

import { readFile, writeFile } from 'node:fs/promises';
import { synthesizePhrases } from '../../narration/index.js';
import stubProvider from '../../narration/providers/stub.js';
import sarvamProvider from '../../narration/providers/sarvam.js';

const HERE = new URL('./', import.meta.url);
const STORY = new URL('story/spread.json', HERE);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
  return args;
}

async function buildLanguage(story, langKey, provider) {
  const block = story[langKey];
  const speaker = story.speakers[block.language_code];
  const result = await synthesizePhrases(block.phrases, {
    lang: block.language_code,
    voice: speaker.speaker,
    model: speaker.model,
    pace: block.pace_base,
    provider,
  });
  await writeFile(new URL(`spread.${langKey}.wav`, HERE), result.audio);
  await writeFile(new URL(`spread.${langKey}.vtt`, HERE), result.vtt);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const story = JSON.parse(await readFile(STORY, 'utf8'));
  const wantSarvam = args.provider === 'sarvam';
  const provider = wantSarvam && process.env.SARVAM_API_KEY ? sarvamProvider : stubProvider;
  if (wantSarvam && provider === stubProvider) {
    console.warn('SARVAM_API_KEY is not set: building against the stub provider instead. This is a blocker for real narration, not a failure of the build.');
  }

  for (const langKey of ['en', 'mr']) {
    const r = await buildLanguage(story, langKey, provider);
    const misses = r.calls.filter(c => !c.fromCache).length;
    console.log(`${langKey} (${story[langKey].language_code}): ${r.durationSec.toFixed(1)}s, ${r.phrases.length} phrases, ${misses} new call(s), provider ${provider.name}`);
  }
}

main().catch(err => { console.error(err.message); process.exitCode = 1; });
