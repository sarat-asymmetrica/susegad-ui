// <sg-doodle>: single-line food drawings, as if done with a marker. Inline SVG in currentColor, so a doodle
// takes the colour of the text around it and costs no requests. A motif is one or two strokes, never filled;
// a band is a seeded row of motifs, edge to edge, for a section divider.
//
//   <sg-doodle motif="lemon"></sg-doodle>                              a decoration: aria-hidden
//   <sg-doodle motif="fork-twirl" label="A fork twirling spaghetti"></sg-doodle>   an image with a name
//   <sg-doodle band seed="kitchen"></sg-doodle>                        a divider, drawn from every motif
//   <sg-doodle band seed="supper" motifs="lemon basil tomato"></sg-doodle>
//
// Attributes: motif (fork-twirl | ravioli | gnocchi | lemon | tomato | basil | whisk | rolling-pin | wheat |
// steam), band, seed, motifs (a few names to draw a band from), label, register. Size: --sg-doodle-size (default
// 4rem, 3.25rem for a band on a phone); a band fits whole cells to its width. Colour: currentColor.
// Event: sg-doodle-drawn, once, when a warm or playful doodle has finished drawing itself.

import { SgElement, defineComponent } from '../../core/component.js';
import { MOTIFS, speak } from './doodle.core.js';

export class SgDoodle extends SgElement {
  static observedAttributes = ['register', 'motif', 'band', 'seed', 'motifs', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() { this.#name(); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'label') this.#name();
  }

  /** Decoration by default; a label makes the whole thing one image with that name. */
  #name() {
    const label = this.getAttribute('label')?.trim();
    if (label) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); this.removeAttribute('aria-hidden'); }
    else { this.removeAttribute('role'); this.removeAttribute('aria-label'); this.setAttribute('aria-hidden', 'true'); }
  }

  state() {
    const motif = this.getAttribute('motif')?.trim();
    const only = (this.getAttribute('motifs') ?? '').split(/[\s,]+/).filter(m => MOTIFS.includes(m));
    return {
      band: this.hasAttribute('band'),
      motif: MOTIFS.includes(motif) ? motif : null,
      seed: this.getAttribute('seed') || 'doodle',
      only: only.length ? only : MOTIFS,
      motion: this.motion,
      visible: this.visible,
    };
  }

  /** What a doodle is, in words: for tools and tests. */
  get subject() { return this.getAttribute('label') || speak(this.getAttribute('motif') ?? 'doodle band'); }
}

defineComponent('sg-doodle', SgDoodle);
