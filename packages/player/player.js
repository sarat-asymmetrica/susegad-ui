// <sg-player>: the Susegad player. Enhances a native <video> or <audio> with
// controls, so the no-JS path is the browser's own player, fully working.
// With JavaScript it adds a drawn scrubber, captions in our type (always
// on, from a <track>), a poster that is a drawing, video treatments (a
// shader pass in our look) and timed ink annotations on the moving frame.
//
//   <sg-player poster-scene="paus" treatment="ink">
//     <video controls preload="metadata">
//       <source src="clip.webm" type="video/webm">
//       <track kind="captions" src="clip.vtt" srclang="en" default>
//     </video>
//   </sg-player>
//
// Content sound plays only on its own play press (decision 0015): the
// element never unmutes or starts audio on its own. `autoplay` is honoured
// only muted, and only when the viewer hasn't asked for reduced motion.

import { SgElement, defineComponent } from '../core/component.js';
import { readColors } from '../core/colors.js';
import { hexToRgb } from '../engine/index.js';
import { formatTime, scrubberFraction, timeFromFraction, keyCommand, seekStep, activeCue, cuesToPlain } from './player.core.js';
import { drawAnnotations } from './annotations.js';
import { normalizeAnnotations, parseAnnotationTrack } from './annotations.core.js';
import { createTreatment, isTreatment } from './treatments.js';
import { renderPosterScene } from './poster.js';
import { parseVttTime } from '../narration/vtt.js';

export const STRINGS = {
  play: 'Play', pause: 'Pause', mute: 'Mute', unmute: 'Unmute',
  captionsOn: 'Turn captions off', captionsOff: 'Turn captions on',
  seek: 'Seek',
};

/** Strip a WebVTT cue's karaoke `<HH:MM:SS.mmm>` word tags for plain caption text. */
const captionText = raw => raw.replace(/<[^>]+>/g, '');

let uid = 0;

export class SgPlayer extends SgElement {
  static observedAttributes = ['register', 'treatment', 'poster-scene', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #media = null; #frame = null; #bar = null; #seek = null; #playBtn = null; #muteBtn = null; #ccBtn = null;
  #timeEl = null; #durEl = null; #captionBox = null; #posterEl = null; #annotCanvas = null; #annotCtx = null;
  #track = null; #captionsOn = true; #annotations = []; #treatment = null; #treatCanvas = null;
  #raf = 0; #destroyed = false; #off = [];

  connected() {
    const el = this.native = this.querySelector('video, audio');
    if (!el) return;
    this.#media = el;
    this.#buildBar();
    this.#wireCaptions();
    this.#wireKeyboard();
    this.#applyAutoplayPolicy();
    if (this.hasAttribute('poster-scene') && el.tagName === 'VIDEO') this.#mountPoster();
    if (el.tagName === 'VIDEO') this.#mountAnnotationLayer();
    if (this.hasAttribute('annotations-src')) this.#loadAnnotations(this.getAttribute('annotations-src'));
    // attributeChangedCallback fires for attributes already on the element
    // before connected() ever runs (the custom elements spec calls it during
    // upgrade, ahead of connectedCallback), so #applyTreatment's early
    // `if (!this.#media) return` skips that first call; apply it explicitly
    // here once #media is actually set.
    if (this.hasAttribute('treatment')) this.#applyTreatment(this.getAttribute('treatment'));
    const onTime = () => this.update();
    for (const evt of ['timeupdate', 'durationchange', 'play', 'pause', 'volumechange', 'progress']) el.addEventListener(evt, onTime);
    this.#off = [() => { for (const evt of ['timeupdate', 'durationchange', 'play', 'pause', 'volumechange', 'progress']) el.removeEventListener(evt, onTime); }];
    this.update();
  }

  disconnected() {
    this.#destroyed = true;
    cancelAnimationFrame(this.#raf);
    this.#off?.forEach(f => f());
    this.#treatment?.destroy();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (!this.#media) return;
    if (name === 'treatment') this.#applyTreatment(now);
    if (name === 'poster-scene' && now) this.#mountPoster();
  }

  // ── the bar: native-first, JS-only enhancement (the native <controls> is the no-JS base) ──
  #buildBar() {
    const el = this.#media;
    el.removeAttribute('controls');
    el.classList.add('sg-player__media');
    // A <video> loses its default keyboard focusability once `controls` is
    // gone (that attribute is what makes Chrome treat it as focusable); the
    // bar's own buttons and range still work, but Space/arrows/M/C need the
    // media itself (or anything inside the player) reachable by Tab too.
    if (el.tagName === 'VIDEO' && !el.hasAttribute('tabindex')) el.tabIndex = 0;
    const label = this.getAttribute('label');
    if (label) el.setAttribute('aria-label', label);

    // Video gets a frame: a relatively-positioned wrapper the poster, the
    // treatment canvas, and the ink annotations all overlay exactly — never
    // the bar below them. Audio has no visual overlay, so it needs none.
    if (el.tagName === 'VIDEO') {
      const frame = document.createElement('div');
      frame.className = 'sg-player__frame';
      el.replaceWith(frame);
      frame.append(el);
      this.#frame = frame;
    }

    const bar = document.createElement('div');
    bar.className = 'sg-player__bar';
    bar.setAttribute('part', 'bar');

    this.#playBtn = document.createElement('button');
    this.#playBtn.type = 'button'; this.#playBtn.className = 'sg-player__play';
    this.#playBtn.setAttribute('aria-label', STRINGS.play);
    this.#playBtn.addEventListener('click', () => this.#togglePlay());

    this.#timeEl = document.createElement('span');
    this.#timeEl.className = 'sg-player__time'; this.#timeEl.setAttribute('aria-hidden', 'true');
    this.#durEl = document.createElement('span');
    this.#durEl.className = 'sg-player__duration'; this.#durEl.setAttribute('aria-hidden', 'true');

    this.#seek = document.createElement('input');
    this.#seek.type = 'range'; this.#seek.min = '0'; this.#seek.max = '1000'; this.#seek.step = '1'; this.#seek.value = '0';
    this.#seek.className = 'sg-player__seek';
    this.#seek.setAttribute('aria-label', STRINGS.seek);
    this.#seek.addEventListener('input', () => { el.currentTime = timeFromFraction(+this.#seek.value / 1000, el.duration || 0); });

    this.#muteBtn = document.createElement('button');
    this.#muteBtn.type = 'button'; this.#muteBtn.className = 'sg-player__mute';
    // A stroke icon in currentColor, drawn like the rest of the player, not
    // a coloured platform emoji: a speaker body, two wave arcs (shown when
    // sound is on) and a slash (shown when muted), toggled by CSS reading
    // [data-state] rather than swapped as two different icons.
    this.#muteBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M2 6h2.4L8 3.3v9.4L4.4 10H2z" fill="currentColor"/>' +
      '<path class="sg-player__mute-wave sg-player__mute-wave--near" d="M10.3 6.2a2.6 2.6 0 0 1 0 3.6" fill="none" stroke="currentColor" stroke-linecap="round"/>' +
      '<path class="sg-player__mute-wave sg-player__mute-wave--far" d="M12 4.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-linecap="round"/>' +
      '<line class="sg-player__mute-slash" x1="9.6" y1="4" x2="14" y2="12" stroke="currentColor" stroke-linecap="round"/>' +
      '</svg>';
    this.#muteBtn.addEventListener('click', () => { el.muted = !el.muted; });

    this.#ccBtn = document.createElement('button');
    this.#ccBtn.type = 'button'; this.#ccBtn.className = 'sg-player__cc';
    this.#ccBtn.hidden = !this.#track;
    this.#ccBtn.addEventListener('click', () => this.#toggleCaptions());

    bar.append(this.#playBtn, this.#timeEl, this.#seek, this.#durEl, this.#ccBtn, this.#muteBtn);
    this.#bar = bar;
    this.append(bar);
  }

  #togglePlay() { this.#media.paused ? this.#media.play().catch(() => {}) : this.#media.pause(); }

  // ── captions: our type, over the frame, always in the DOM and on by default ──
  #wireCaptions() {
    const track = this.querySelector('track[kind="captions"], track[kind="subtitles"]');
    if (!track) return;
    this.#track = track;
    track.track.mode = 'hidden'; // the browser never draws its own captions UI; we draw ours
    this.#ccBtn.hidden = false;
    this.#ccBtn.setAttribute('aria-label', this.#captionsOn ? STRINGS.captionsOn : STRINGS.captionsOff);
    const box = document.createElement('div');
    box.className = 'sg-player__captions'; box.setAttribute('aria-hidden', 'true');
    (this.#frame ?? this).append(box);
    this.#captionBox = box;
    const paint = () => {
      if (this.#destroyed) return;
      this.#raf = requestAnimationFrame(paint);
      if (!this.#captionsOn) { if (box.textContent) box.textContent = ''; return; }
      const cue = activeCue(cuesToPlain(track.track.cues), this.#media.currentTime || 0);
      const text = cue ? captionText(cue.text) : '';
      if (box.textContent !== text) box.textContent = text;
    };
    this.#raf = requestAnimationFrame(paint);
  }
  #toggleCaptions() {
    this.#captionsOn = !this.#captionsOn;
    this.#ccBtn.setAttribute('aria-label', this.#captionsOn ? STRINGS.captionsOn : STRINGS.captionsOff);
    this.#captionBox.hidden = !this.#captionsOn;
  }

  // ── poster: a scene's still, not a flat colour or a frame grab ──
  async #mountPoster() {
    const name = this.getAttribute('poster-scene');
    if (!name || this.#media.tagName !== 'VIDEO') return;
    this.#posterEl?.remove();
    const url = await renderPosterScene(name, { register: this.register }).catch(() => null);
    if (!url || this.#destroyed) return;
    const div = document.createElement('div');
    div.className = 'sg-player__poster'; div.setAttribute('aria-hidden', 'true');
    div.style.backgroundImage = `url(${url})`;
    this.#frame.prepend(div);
    this.#posterEl = div;
    const hide = () => { div.classList.add('sg-player__poster--hidden'); };
    this.#media.addEventListener('play', hide, { once: true });
    if (!this.#media.paused) hide();
  }

  // ── ink annotations, registered on the moving frame ──
  #mountAnnotationLayer() {
    const c = document.createElement('canvas');
    c.className = 'sg-player__annotations'; c.setAttribute('aria-hidden', 'true');
    this.#frame.append(c);
    this.#annotCanvas = c; this.#annotCtx = c.getContext('2d');
    const resize = () => {
      const r = this.#media.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width)); c.height = Math.max(1, Math.round(r.height));
    };
    new ResizeObserver(resize).observe(this.#media);
    resize();
    const colors = readColors(this, { ink: 'var(--sg-pencil, #1d2742)' });
    const draw = () => {
      if (this.#destroyed) return;
      requestAnimationFrame(draw);
      const g = this.#annotCtx;
      g.clearRect(0, 0, c.width, c.height);
      if (this.#annotations.length) drawAnnotations(g, this.#annotations, this.#media.currentTime || 0, c.width, c.height, { color: colors.ink });
    };
    requestAnimationFrame(draw);
  }
  async #loadAnnotations(src) {
    try {
      const text = await fetch(src).then(r => r.text());
      this.#annotations = parseAnnotationTrack(text, parseVttTime);
    } catch (err) { console.warn('sg-player: could not read its annotations track.', err); }
  }
  /** Set annotations directly, e.g. `player.annotations = [{ type: 'circle', start: 1, end: 3, x: .5, y: .4 }]`. */
  set annotations(list) { this.#annotations = normalizeAnnotations(list); }
  get annotations() { return this.#annotations.map(a => ({ ...a })); }

  // ── video treatments: a shader pass in our look ──
  #applyTreatment(name) {
    this.#treatment?.destroy(); this.#treatment = null;
    this.#media.classList.remove('sg-player__media--treated');
    if (this.#treatCanvas) this.#treatCanvas.hidden = true;
    if (this.#media.tagName !== 'VIDEO' || !isTreatment(name)) return;
    if (!this.#treatCanvas) {
      const c = document.createElement('canvas');
      c.className = 'sg-player__treatment'; c.hidden = true; c.setAttribute('aria-hidden', 'true');
      this.#frame.insertBefore(c, this.#media.nextSibling);
      this.#treatCanvas = c;
    }
    const roles = readColors(this, { ink: 'var(--sg-pencil, #1d2742)', paper: 'var(--sg-surface, #f7f4eb)', accent: 'var(--sg-accent, #1d2742)' });
    // A brand-new WebGL canvas is opaque black (no alpha channel) until its
    // first real draw: stay on the plain video (or the poster, above it)
    // until the treatment reports it has actually drawn a frame, never
    // reveal that black canvas just because WebGL itself is available.
    const t = createTreatment(this.#media, this.#treatCanvas, {
      type: name, ink: hexToRgb(roles.ink), paper: hexToRgb(roles.paper), colorA: hexToRgb(roles.ink), colorB: hexToRgb(roles.accent),
    }, () => !this.#media.paused && this.motion !== 'still', () => {
      if (this.#treatment !== t) return; // a newer treatment has already replaced this one
      this.#media.classList.add('sg-player__media--treated');
      this.#treatCanvas.hidden = false;
    });
    this.#treatment = t;
    if (!t.ok) { this.#media.classList.remove('sg-player__media--treated'); this.#treatCanvas.hidden = true; }
  }

  // ── keyboard: space, arrows, M, C ──
  #wireKeyboard() {
    this.addEventListener('keydown', e => {
      if (e.target === this.#seek && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // the range handles its own arrows
      const cmd = keyCommand(e.key);
      if (!cmd) return;
      const el = this.#media;
      switch (cmd) {
        case 'toggle-play': this.#togglePlay(); break;
        case 'seek-back': el.currentTime = Math.max(0, (el.currentTime || 0) - seekStep(e.shiftKey)); break;
        case 'seek-fwd': el.currentTime = Math.min(el.duration || Infinity, (el.currentTime || 0) + seekStep(e.shiftKey)); break;
        case 'seek-start': el.currentTime = 0; break;
        case 'seek-end': if (el.duration) el.currentTime = el.duration; break;
        case 'toggle-mute': el.muted = !el.muted; break;
        case 'toggle-captions': if (this.#track) this.#toggleCaptions(); break;
        default: return;
      }
      e.preventDefault();
    });
  }

  // ── autoplay: muted only, only when the author asked and motion isn't reduced (0015, the charter) ──
  #applyAutoplayPolicy() {
    const el = this.#media;
    const wantsAutoplay = el.hasAttribute('autoplay');
    const reduced = this.motion === 'still';
    el.removeAttribute('autoplay');
    if (wantsAutoplay && el.tagName === 'VIDEO' && !reduced) { el.muted = true; el.play().catch(() => {}); }
  }

  state() {
    const el = this.#media;
    const duration = el?.duration || 0;
    const fraction = scrubberFraction(el?.currentTime || 0, duration);
    let buffered = 0;
    try { if (el?.buffered.length) buffered = scrubberFraction(el.buffered.end(el.buffered.length - 1), duration); } catch { /* no buffered range yet */ }
    return { fraction, buffered, duration, currentTime: el?.currentTime || 0, playing: !!el && !el.paused, muted: !!el?.muted, register: this.register };
  }

  update() {
    if (!this.#media) return;
    const s = this.state();
    if (this.#seek && document.activeElement !== this.#seek) this.#seek.value = String(Math.round(s.fraction * 1000));
    if (this.#seek) this.#seek.setAttribute('aria-valuetext', `${formatTime(s.currentTime)} of ${formatTime(s.duration)}`);
    if (this.#timeEl) this.#timeEl.textContent = formatTime(s.currentTime);
    if (this.#durEl) this.#durEl.textContent = formatTime(s.duration);
    if (this.#playBtn) { this.#playBtn.setAttribute('aria-label', s.playing ? STRINGS.pause : STRINGS.play); this.#playBtn.dataset.state = s.playing ? 'pause' : 'play'; }
    if (this.#muteBtn) { this.#muteBtn.setAttribute('aria-label', s.muted ? STRINGS.unmute : STRINGS.mute); this.#muteBtn.dataset.state = s.muted ? 'muted' : 'on'; }
    super.update();
  }
}

defineComponent('sg-player', SgPlayer);
