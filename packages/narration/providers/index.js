// The provider interface every narration provider implements.
//
//   synthesize({ text, lang, voice, model, pace }) => { audio, mime, meta }
//
// `audio` is an ArrayBuffer or Uint8Array of WAV bytes (so `wav.js` can read
// its real duration); `mime` is the audio's media type; `meta` is whatever
// the provider wants to keep about the call (never the key). A provider
// throws a plain `Error` on failure; it never returns a fake result.

/**
 * @typedef {{ text: string, lang: string, voice?: string, model?: string, pace?: number }} SynthesizeRequest
 * @typedef {{ audio: ArrayBuffer|Uint8Array, mime: string, meta: Record<string, unknown> }} SynthesizeResult
 * @typedef {{ name: string, synthesize: (req: SynthesizeRequest) => Promise<SynthesizeResult> }} Provider
 */

/** A little structure so a provider module's shape is checked once, at the point it's defined. */
export function defineProvider({ name, synthesize }) {
  if (typeof name !== 'string' || !name) throw new Error('a provider needs a name');
  if (typeof synthesize !== 'function') throw new Error(`provider "${name}" needs a synthesize(req) function`);
  return { name, synthesize };
}
