// <sg-narration>: the highlight driver. Given an <audio> and a WebVTT track
// (native <track kind="captions">, so captions are always present and need
// no JavaScript), it marks the current word with `aria-current="true"` as
// the audio plays. It never autoplays and never carries the play control
// itself: the play control is its own button, because the button press is
// the consent (decision 0015). No live-region chatter — the words are
// already visible as captions; a word gaining `aria-current` says nothing
// extra to a screen reader.
//
//   <sg-narration lang="en-IN">
//     <audio controls preload="none">
//       <source src="spread.wav" type="audio/wav">
//       <track kind="captions" src="spread.vtt" default>
//     </audio>
//     <p class="sg-narration-text">
//       <span data-word>Rain</span> <span data-word>came</span> …
//     </p>
//   </sg-narration>
//
// Word spans are optional. Without them, the element still drives captions
// (the browser does that on its own) and fires `sg-word` so a page can
// render its own highlight, for example over an SVG letterform.
//
// Offline fallback: when neither an <audio src> nor a cached fixture is
// reachable, call `speakFallback(el, { lang })`, which uses the browser's
// `speechSynthesis` with `boundary` events where the engine fires them, or
// leaves the captions as the only narration where it doesn't. The element
// says in `dataset.sgNarrationMode` which one is active ("audio" or
// "speech-synthesis" or "captions-only"), in plain words a page can show.

import { SgElement, defineComponent } from '../core/component.js';
import { parseVtt } from './vtt.js';

/** Binary search for the phrase (or null) covering `t` seconds. */
function phraseAt(phrases, t) {
  let lo = 0, hi = phrases.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = phrases[mid];
    if (t < p.start) hi = mid - 1;
    else if (t >= p.end) lo = mid + 1;
    else return p;
  }
  return null;
}

/** The current word (or null) inside a phrase, by linear scan (a phrase is short). */
function wordAt(phrase, t) {
  if (!phrase) return null;
  for (const w of phrase.words) if (t >= w.start && t < w.end) return w;
  return phrase.words[phrase.words.length - 1] ?? null;
}

export class SgNarration extends SgElement {
  static observedAttributes = ['register', 'lang'];

  #audio = null;
  #track = null;
  #phrases = [];
  #order = []; // flat list of matched span indexes, in playback order, so a repeated word still lines up
  #current = null;
  #currentPhraseIndex = -1;
  #raf = 0;

  connected() {
    this.#audio = this.querySelector('audio');
    if (!this.#audio) return;
    this.#wireTrack();
    this.#audio.addEventListener('play', this.#onPlay);
    this.#audio.addEventListener('pause', this.#stop);
    this.#audio.addEventListener('ended', this.#stop);
    this.#audio.addEventListener('seeked', this.#onSeeked);
  }

  disconnected() {
    this.#stop();
    this.#audio?.removeEventListener('play', this.#onPlay);
    this.#audio?.removeEventListener('pause', this.#stop);
    this.#audio?.removeEventListener('ended', this.#stop);
    this.#audio?.removeEventListener('seeked', this.#onSeeked);
  }

  #wireTrack() {
    const track = this.#audio.querySelector('track[kind="captions"], track[kind="subtitles"]');
    if (!track) return;
    // Fetched independently of the browser's own track loading (whose 'load'
    // event races the custom element's upgrade and can fire before this
    // listener exists): the file is small, and reading it twice costs
    // nothing a user notices.
    fetch(track.src)
      .then(r => r.text())
      .then(text => { this.#phrases = parseVtt(text); })
      .catch(err => console.warn('sg-narration: could not read its captions track; highlighting is off, captions still show natively.', err));
  }

  /**
   * The `[data-word]` spans, queried live rather than cached at connect: a
   * page may build them (`wrapWords`, in the storybook-spread recipe) after
   * this element has already connected, since the story text can arrive
   * asynchronously.
   */
  #spans() { return [...this.querySelectorAll('[data-word]')]; }

  #onPlay = () => { cancelAnimationFrame(this.#raf); this.#tick(); };
  #stop = () => { cancelAnimationFrame(this.#raf); };
  /** A scrub, forward or back: forget the last matched span so #mark searches from the start again. */
  #onSeeked = () => {
    for (const s of this.#spans()) s.removeAttribute('aria-current');
    this.#order = []; this.#current = null; this.#currentPhraseIndex = -1;
    this.#tick();
  };

  #tick = () => {
    if (!this.#audio || this.#audio.paused) return;
    const index = this.#phrases.findIndex(p => this.#audio.currentTime >= p.start && this.#audio.currentTime < p.end);
    const phrase = index >= 0 ? this.#phrases[index] : null;
    if (index !== this.#currentPhraseIndex) {
      this.#currentPhraseIndex = index;
      // A page drives scene params (e.g. rain intensity) off this, one event
      // per phrase — a scene cue is per beat, not per word.
      if (phrase) this.emit('sg-phrase', { index, start: phrase.start, end: phrase.end });
    }
    const word = wordAt(phrase, this.#audio.currentTime);
    if (word !== this.#current) {
      this.#mark(word);
      this.#current = word;
      if (word) this.emit('sg-word', { word: word.word, start: word.start, end: word.end });
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  /** Mark the matching `[data-word]` span, in playback order, aria-hidden-friendly. */
  #mark(word) {
    const spans = this.#spans();
    if (!spans.length) return;
    for (const s of spans) s.removeAttribute('aria-current');
    if (!word) return;
    // Walk forward from the last matched index so repeated words (common in
    // a children's story) still line up with playback order.
    const strip = s => s.trim().replace(/^[("'“‘]+|[)"'”’,;:.!?।॥]+$/gu, '');
    const from = this.#order.length ? this.#order[this.#order.length - 1] + 1 : 0;
    for (let i = from; i < spans.length; i++) {
      if (strip(spans[i].textContent) === strip(word.word)) {
        spans[i].setAttribute('aria-current', 'true');
        this.#order.push(i);
        return;
      }
    }
  }

  state() { return { lang: this.getAttribute('lang') || '', motion: this.motion }; }
}

defineComponent('sg-narration', SgNarration);

// ── Offline fallback ────────────────────────────────────────────────────

/**
 * Speak `text` with the browser's own voice when no audio is available
 * (no key at build time, or a network-free demo). Word highlighting works
 * only where the engine fires `boundary` events (`onWord`, called with each
 * event's `charIndex`); where it doesn't, or where `speechSynthesis` is
 * missing entirely, the captions already on the page are the only
 * narration, which the charter requires regardless.
 * @param {string} text
 * @param {{ lang?: string, onWord?: (charIndex: number) => void, onDone?: () => void }} [opts]
 * @returns {'speech-synthesis'|'captions-only'} which mode this call started; not a promise of boundary events, only that speech was attempted
 */
export function speakFallback(text, { lang = 'en-IN', onWord, onDone } = {}) {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    onDone?.();
    return 'captions-only';
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.addEventListener('boundary', e => onWord?.(e.charIndex));
  utter.addEventListener('end', () => onDone?.());
  speechSynthesis.speak(utter);
  return 'speech-synthesis';
}
