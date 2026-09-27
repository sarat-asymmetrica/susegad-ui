// The Sarvam adapter: text to speech over Bulbul. Confirmed against
// docs.sarvam.ai on 24 September 2026 (docs/briefs/wave-4.md) — endpoint,
// fields and the documented model strings. Bulbul V4 was announced (30 July
// 2026) but isn't a documented model string yet; the default stays
// `bulbul:v3` unless a caller asks for `bulbul:v4` and Sarvam accepts it (see
// the Wave 4 progress note for the one test call this adapter's build made).
//
// The key is read from `SARVAM_API_KEY` at call time only. It is never
// logged, returned in `meta`, or written to disk.

import { defineProvider } from './index.js';

const ENDPOINT = 'https://api.sarvam.ai/text-to-speech';
const MAX_CHARS = 2500; // bulbul:v3's documented limit

async function synthesize({ text, lang, voice = 'shubh', model = 'bulbul:v3', pace = 1 }) {
  if (!lang) throw new Error('sarvam.synthesize needs a lang, e.g. "en-IN" or "mr-IN"');
  if (text.length > MAX_CHARS) throw new Error(`phrase is ${text.length} characters; bulbul takes up to ${MAX_CHARS} — split it with splitPhrases() first`);
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not set');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
    body: JSON.stringify({
      text,
      language_code: lang,
      model,
      speaker: voice,
      pace,
      speech_sample_rate: 24000,
      output_audio_codec: 'wav',
    }),
  });

  if (!res.ok) {
    // Sarvam's error message, not the request headers (never the key).
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { try { detail = await res.text(); } catch { /* ignore */ } }
    throw new Error(`Sarvam text-to-speech answered ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }

  const body = await res.json();
  const b64 = body?.audios?.[0];
  if (!b64) throw new Error('Sarvam text-to-speech returned no audio');
  const audio = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return {
    audio,
    mime: 'audio/wav',
    meta: { provider: 'sarvam', model, voice, lang, pace, requestId: body.request_id ?? null },
  };
}

export default defineProvider({ name: 'sarvam', synthesize });
