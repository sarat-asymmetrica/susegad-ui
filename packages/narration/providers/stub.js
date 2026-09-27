// The stub provider: a silent WAV of a plausible length, so every test and
// demo runs offline with no key and no network. Deterministic for the same
// request, which keeps its fixtures stable.

import { writeSilentWav } from '../wav.js';
import { defineProvider } from './index.js';

// A plain, unhurried reading pace: about 2.3 words a second at pace 1.
const WORDS_PER_SEC = 2.3;

async function synthesize({ text, lang = 'en-IN', voice = 'stub', model = 'stub', pace = 1 }) {
  const wordCount = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);
  const durationSec = Math.max(0.3, wordCount / (WORDS_PER_SEC * Math.max(0.1, pace)));
  const audio = writeSilentWav({ durationSec, sampleRate: 24000, channels: 1 });
  return { audio, mime: 'audio/wav', meta: { provider: 'stub', text, lang, voice, model, pace, durationSec } };
}

export default defineProvider({ name: 'stub', synthesize });
