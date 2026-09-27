// Folio sealing: a strict Content-Security-Policy, and an integrity hash of the
// whole file printed in its footer. Pure except for Node's crypto.
//
// The hash covers every byte of the file, with each place the hash itself is
// written replaced by 64 zeros, so it can sit inside the file it describes.
// `folio verify` and the document's own "check this document" button both
// recompute it the same way.

import { createHash } from 'node:crypto';

export const ZERO = '0'.repeat(64);
const MARK = /<meta name="folio-integrity" content="sha256-([0-9a-f]{64})">/;

/** sha256 of a string's UTF-8 bytes, as base64 (for CSP) or hex (for the seal). */
export const sha256 = (text, enc = 'base64') => createHash('sha256').update(text, 'utf8').digest(enc);

/**
 * The policy. Nothing may be fetched: scripts and styles only by hash, images,
 * fonts and media only from data: (and blob: made on the page), no forms sent,
 * no frames, no base URL.
 */
export function cspFor({ scripts = [], styles = [], styleAttrs = [] }) {
  const q = h => `'sha256-${h}'`;
  const styleSrc = [...new Set(styles)].map(q);
  if (styleAttrs.length) styleSrc.push("'unsafe-hashes'", ...[...new Set(styleAttrs)].map(q));
  return [
    "default-src 'none'",
    `script-src ${[...new Set(scripts)].map(q).join(' ') || "'none'"}`,
    `style-src ${styleSrc.join(' ') || "'none'"}`,
    'img-src data: blob:',
    'font-src data:',
    'media-src data: blob:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** Hashes of every inline <script> and <style> element in the markup, in order. */
export function inlineHashes(html) {
  const pick = tag => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))]
    .filter(m => !/\bsrc=/i.test(m[0].slice(0, m[0].indexOf('>'))))
    .map(m => sha256(m[1]));
  return { scripts: pick('script'), styles: pick('style') };
}

/** Put the policy first in <head>, where it must be to apply to everything after it. */
export function withCsp(html, policy) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '').replace(/<head([^>]*)>/i, (_, attrs) => `<head${attrs}>\n${meta}`);
}

/** The text the hash is taken over: the file with the hash replaced by zeros. */
export const canonical = (text, digest) => (digest ? text.split(digest).join(ZERO) : text);

/** Seal a document whose markup already holds ZERO wherever the hash will be written. */
export function seal(text) {
  if (!text.includes(`sha256-${ZERO}`)) throw new Error('The document has no place for its seal: add the folio-integrity meta.');
  const digest = sha256(text, 'hex');
  return { text: text.split(ZERO).join(digest), digest };
}

/**
 * Check a sealed file. Returns { ok, digest, actual, reason }.
 * `reason` says in plain words what was found.
 */
export function verify(text) {
  const m = MARK.exec(text);
  if (!m) return { ok: false, digest: null, actual: null, reason: 'This file has no Folio seal, so it cannot be checked.' };
  const digest = m[1];
  const actual = sha256(canonical(text, digest), 'hex');
  return digest === actual
    ? { ok: true, digest, actual, reason: 'The file matches its seal. It has not been changed since it was built.' }
    : { ok: false, digest, actual, reason: 'The file does not match its seal. It has been changed since it was built.' };
}

/** Group a hex digest into fours so a person can read it aloud and compare it. */
export const groupHex = hex => hex.match(/.{1,4}/g).join(' ');
