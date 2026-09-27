// The fixture cache: every synthesised phrase is stored under a hash of its
// request, alongside the request itself (never the key), so tests and the
// demo read only from disk and the network is only ever called on a miss.
// Node-only (uses node:fs); the pure hashing key can still be computed
// anywhere `node:crypto` runs.
//
// The cache directory is never something a project ships or a registry
// build has to prove is copied: it holds no source, only a disposable
// cache that `writeFixture` creates on demand (mkdir, recursive), and it's
// gitignored here for the same reason. `FIXTURES_DIR` names this package's
// own default (a sibling `fixtures/` folder); every function also takes an
// explicit `dir`, documented below, for a caller that wants its cache
// somewhere else — a test that needs an isolated cache, or a builder's
// project that wants it outside `node_modules`-adjacent source.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** This package's default cache directory. Ships only its README; the cache itself is created on first write. */
export const FIXTURES_DIR = new URL('./fixtures/', import.meta.url);

/**
 * The cache key for a request: a stable hash of exactly the fields that
 * change the audio. `pace` and `model` default in, so two requests that
 * differ only in an explicit vs. an implicit default still share a fixture.
 * @param {{ text: string, lang: string, voice?: string, model?: string, pace?: number }} req
 * @returns {string}
 */
export function fixtureKey({ text, lang, voice = null, model = null, pace = null }) {
  const normalized = JSON.stringify({ text, lang, voice, model, pace });
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

const dirFor = (key, base) => new URL(`${key}/`, base);

/**
 * Read a cached phrase, or null on a miss. Never throws on a missing file.
 * @param {string} key
 * @param {{ dir?: URL }} [opts] the cache directory; defaults to `FIXTURES_DIR`
 * @returns {Promise<{ audio: Uint8Array, request: object } | null>}
 */
export async function readFixture(key, { dir = FIXTURES_DIR } = {}) {
  const entryDir = dirFor(key, dir);
  try {
    const [audio, requestJson] = await Promise.all([
      readFile(new URL('audio.wav', entryDir)),
      readFile(new URL('request.json', entryDir), 'utf8'),
    ]);
    return { audio: new Uint8Array(audio), request: JSON.parse(requestJson) };
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Write a phrase to the cache. `request` is the plain synthesis request
 * (text, lang, voice, model, pace) with no key or other secret in it.
 * Creates `dir` (and the entry's own subfolder) if it doesn't exist yet —
 * the cache is never assumed to pre-exist.
 * @param {string} key
 * @param {{ audio: Uint8Array|ArrayBuffer, request: object }} entry
 * @param {{ dir?: URL }} [opts] the cache directory; defaults to `FIXTURES_DIR`
 */
export async function writeFixture(key, { audio, request }, { dir = FIXTURES_DIR } = {}) {
  const entryDir = dirFor(key, dir);
  await mkdir(entryDir, { recursive: true });
  const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio;
  await writeFile(new URL('audio.wav', entryDir), bytes);
  await writeFile(new URL('request.json', entryDir), `${JSON.stringify(request, null, 2)}\n`);
}

/** A cache directory as a plain filesystem path, for tools that need one (e.g. a static server). Defaults to `FIXTURES_DIR`. */
export const fixturesPath = (dir = FIXTURES_DIR) => fileURLToPath(dir);
