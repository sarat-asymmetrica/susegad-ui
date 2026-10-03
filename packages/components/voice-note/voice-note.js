// <sg-voice-note>: a voice message the way a phone shows it, with the
// transcript always on show. It enhances a native <audio controls>; without
// JavaScript the browser's own controls play it and the transcript is text.
//
//   <sg-voice-note peaks="0.2 0.6 0.9 …">
//     <audio controls preload="metadata" src="note.m4a">
//       <track kind="captions" src="note.vtt" srclang="en" default>
//     </audio>
//     <p class="sg-voice-transcript">…what was said…</p>
//   </sg-voice-note>
//
// Content sound: it plays only when its own play button is pressed (decision
// 0015). An autoplay attribute is removed.
//
// Attributes: peaks (real loudness, 0..1, from peaks.mjs at build time; without
// it the waveform is a seeded stand-in and data-waveform says "stand-in"),
// label (what the message is, for the button: "from Maya"), register.
// Events: sg-voice-play, sg-voice-pause.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, parsePeaks, standInPeaks, scrubberFraction, timeFromFraction, formatTime, timeText, activeCue, cuesFrom } from './voice-note.core.js';

export class SgVoiceNote extends SgElement {
  static native = 'audio';
  static observedAttributes = ['register', 'peaks', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = []; #button = null; #range = null; #time = null; #cues = []; #spans = []; #current = -1; #seeking = false;

  connected() {
    const audio = this.native;
    if (!audio) { console.warn('sg-voice-note: put an <audio controls> inside.'); return; }
    if (audio.hasAttribute('autoplay')) {
      audio.removeAttribute('autoplay');
      audio.pause();
      console.warn('sg-voice-note: autoplay removed. A voice note plays only when its play button is pressed.');
    }
    if (!this.querySelector('.sg-voice-transcript')) console.warn(STRINGS.noTranscript);
    this.#spans = [...this.querySelectorAll('.sg-voice-transcript [data-start]')];
    this.#cues = cuesFrom(this.#spans.map(s => ({ start: s.dataset.start, end: s.dataset.end })));
    this.#build(audio);
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    this.querySelector(':scope > .sg-voice-bar')?.remove();
    this.native?.setAttribute('controls', '');
    delete this.dataset.enhanced;
  }

  get peaks() {
    const real = parsePeaks(this.getAttribute('peaks'));
    return real ?? standInPeaks(this.native?.currentSrc || this.native?.getAttribute('src') || this.textContent.slice(0, 40));
  }

  #build(audio) {
    const doc = this.ownerDocument;
    const bar = doc.createElement('div');
    bar.className = 'sg-voice-bar';
    const button = this.#button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sg-voice-play';
    const wave = doc.createElement('div');
    wave.className = 'sg-voice-wave';
    const range = this.#range = doc.createElement('input');
    Object.assign(range, { type: 'range', min: '0', max: '1000', step: '1', value: '0' });
    range.setAttribute('aria-label', STRINGS.seek);
    const time = this.#time = doc.createElement('span');
    time.className = 'sg-voice-time';
    time.setAttribute('aria-hidden', 'true'); // the range's value text says the same to assistive technology
    wave.append(range);
    bar.append(button, wave, time);
    audio.after(bar);
    audio.removeAttribute('controls');
    this.dataset.enhanced = '';
    this.dataset.waveform = parsePeaks(this.getAttribute('peaks')) ? 'measured' : 'stand-in';

    const on = (t, ev, fn) => { t.addEventListener(ev, fn); this.#off.push(() => t.removeEventListener(ev, fn)); };
    on(button, 'click', () => {
      if (audio.paused) { const p = audio.play(); p?.catch?.(() => {}); } else audio.pause();
      this.emit('sg-voice-press', { playing: !audio.paused });
    });
    on(range, 'input', () => { this.#seeking = true; audio.currentTime = timeFromFraction(range.value / 1000, audio.duration); this.#sync(); });
    on(range, 'change', () => { this.#seeking = false; });
    for (const ev of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ended']) on(audio, ev, () => this.#sync());
    on(audio, 'play', () => { this.#sync(); this.emit('sg-voice-play', {}); });
    on(audio, 'pause', () => { this.#sync(); this.emit('sg-voice-pause', {}); });
    this.#sync();
  }

  #sync() {
    const a = this.native, d = a.duration, t = a.currentTime || 0;
    const playing = !a.paused && !a.ended;
    const label = this.getAttribute('label');
    this.#button.setAttribute('aria-label', `${playing ? STRINGS.pause : STRINGS.play}${label ? `, ${label}` : ''}`);
    this.#button.dataset.state = playing ? 'playing' : 'paused';
    const f = scrubberFraction(t, d);
    if (!this.#seeking) this.#range.value = String(Math.round(f * 1000));
    this.#range.setAttribute('aria-valuetext', timeText(t, d));
    // The length at rest, the time played while playing: what a phone shows.
    this.#time.textContent = formatTime(playing || t > 0 ? t : d);
    // The phrase being spoken, once the note has started; none at rest.
    const cue = (playing || t > 0) && activeCue(this.#cues, t), i = cue ? +cue.text : -1;
    if (i !== this.#current) {
      this.#spans[this.#current]?.removeAttribute('data-current');
      this.#spans[i]?.setAttribute('data-current', '');
      this.#current = i;
    }
    this.update();
  }

  state() {
    const a = this.native;
    return {
      peaks: this.peaks,
      measured: this.dataset.waveform === 'measured',
      fraction: a ? scrubberFraction(a.currentTime, a.duration) : 0,
      playing: !!a && !a.paused && !a.ended,
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-voice-note', SgVoiceNote);
