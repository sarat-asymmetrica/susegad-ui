// The storybook spread: text beside a scene, narrated, word by word.
// Composes <sg-scene name="paus">, <sg-narration> (packages/narration),
// <sg-player> (packages/player) for the play bar, and the register.
// Importing this module registers all three custom elements; it wires
// nothing else until `mountStorybookSpread(el, opts)` is called (decision,
// see GOAL.md §1 recipes).
//
// Captions, one source of truth: <sg-player> draws its own caption line
// (the current phrase, aria-hidden, meant to sit over a video's frame) and
// <sg-narration> highlights the current word in the story paragraph beside
// it (not aria-hidden — it's the actual page content). Showing both at
// once for an audio player says the same sentence twice next to each
// other, with nothing to look at between them, so recipe.css hides
// .sg-player__captions here: the paragraph is the single visible source of
// truth, sg-player's captions button still exists and still works (it
// toggles a box that's simply zero-height in this layout, not removed),
// and captions themselves are still always present, natively, as the page
// text and the <track> both attest.

import '../../scenes/paus/index.js';
import '../../player/player.js';
import { speakFallback } from '../../narration/reader.js';

/**
 * Wrap each word of `el`'s direct text into a `[data-word]` span, leaving
 * existing markup (a quoted `<strong>`, say) alone. Pure DOM, no story
 * knowledge: it only needs to run once, before the narration starts, so
 * `sg-narration`'s highlight driver has something to mark. Safe to call on
 * a container with mixed text and element children; it recurses into
 * elements so a child like `<em>` keeps working.
 * @param {Element} el
 */
export function wrapWords(el) {
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) continue;
      const frag = document.createDocumentFragment();
      const parts = text.split(/(\s+)/); // keep the whitespace, so word spacing survives
      for (const part of parts) {
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        if (!part) continue;
        const span = document.createElement('span');
        span.dataset.word = '';
        span.textContent = part;
        frag.append(span);
      }
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      wrapWords(node);
    }
  }
}

/**
 * Mount the spread: word-wrap its text, then wire the language switch (a
 * `role="radiogroup"` of buttons, `data-lang` on each) to show one
 * language's `<sg-narration>` region at a time and hide the other, and wire
 * `sg-phrase` events from the active narration to the scene's `intensity`
 * param, per `story/spread.json`'s `scene_cues.cues`. The two languages'
 * phrase arrays share one beat order (`spread.json`'s `en.phrases` and
 * `mr.phrases` are the same length, beat for beat), so one `cues` array,
 * indexed by phrase position, drives the scene under either language.
 * @param {Element} root the recipe's outer element
 * @param {{ cues: { params: Record<string, unknown> }[], defaultLang?: 'en'|'mr' }} opts
 */
export function mountStorybookSpread(root, { cues, defaultLang = 'en' }) {
  const scene = root.querySelector('sg-scene');
  const regions = { en: root.querySelector('[data-lang-region="en"]'), mr: root.querySelector('[data-lang-region="mr"]') };
  const switches = [...root.querySelectorAll('[data-lang-switch] [data-lang]')];

  for (const region of Object.values(regions)) for (const p of region.querySelectorAll('[data-story-text]')) wrapWords(p);

  const fallbackNote = root.querySelector('[data-narration-unavailable]');
  for (const region of Object.values(regions)) {
    const audio = region.querySelector('audio');
    // No source could be read (missing fixture, offline, a stale demo copy
    // with no wav yet): fall back to the browser's own voice, or, failing
    // that, the static text and captions already on the page are the story.
    // A failing <source> fires `error` on the <source>, not the <audio>, and it doesn't
    // bubble, so listen in the capture phase. It may also have failed already, before
    // this runs (the demo mounts after a fetch), so check the network state as well.
    if (!audio) continue;
    let fellBack = false;
    // Content sound needs its own press (decision 0015), so a failed file never starts the
    // device's voice by itself: it swaps the player for a plain button that does.
    const fallBack = () => {
      if (fellBack) return;
      fellBack = true;
      region.toggleAttribute('data-voice-unavailable', true);
      if (fallbackNote && !region.hidden) fallbackNote.hidden = false;
      const player = audio.closest('sg-player') ?? audio;
      player.hidden = true;
      if (typeof speechSynthesis === 'undefined') return; // captions only: the words on the page are the story
      const mr = region.getAttribute('lang') === 'mr';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'spread__speak';
      button.textContent = mr ? 'या उपकरणाच्या आवाजात ऐका' : "Read it aloud with this device's voice";
      button.addEventListener('click', () => {
        speechSynthesis.cancel();
        const text = [...region.querySelectorAll('[data-story-text]')].map(p => p.textContent).join(' ');
        speakFallback(text, { lang: mr ? 'mr-IN' : 'en-IN' });
      });
      player.after(button);
    };
    audio.addEventListener('error', fallBack, { capture: true });
    if (audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fallBack();
  }

  function showLang(langKey) {
    for (const [key, region] of Object.entries(regions)) {
      const on = key === langKey;
      region.hidden = !on;
      const audio = region.querySelector('audio');
      if (!on) audio?.pause();
    }
    for (const btn of switches) btn.setAttribute('aria-pressed', String(btn.dataset.lang === langKey));
    if (fallbackNote) fallbackNote.hidden = !regions[langKey]?.hasAttribute('data-voice-unavailable');
  }

  function onPhrase(e) {
    const cue = cues?.[e.detail.index];
    if (!cue || !scene) return;
    for (const [param, value] of Object.entries(cue.params)) scene.set({ [param]: value });
  }

  for (const region of Object.values(regions)) {
    region.querySelector('sg-narration')?.addEventListener('sg-phrase', onPhrase);
  }
  for (const btn of switches) btn.addEventListener('click', () => showLang(btn.dataset.lang));

  // No separate captions toggle here: sg-player now owns track.mode (it
  // sets it to 'hidden' and draws its own box, which recipe.css suppresses
  // — see the note at the top of this file), and the story paragraph is
  // the page's real content, not an optional overlay, so there's nothing
  // honest for an on/off switch to do. sg-player's own CC button stays in
  // its bar (not this recipe's to remove) but has no visible target here.

  showLang(defaultLang);
}
