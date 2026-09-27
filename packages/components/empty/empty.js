// <sg-empty>: what a place shows before there is anything in it.
//
//   <sg-empty scene="paus" scene-intensity="0.5">
//     <h2>No bookings yet</h2>
//     <p>When a guest books, their stay shows up here.</p>
//     <a href="/share">Share your listing</a>
//   </sg-empty>
//
// The heading, words and action are plain light-DOM content and work without
// JavaScript. The element names itself a region after its heading and gathers
// the content into a body; the skin adds the picture: a hairline drawing in
// quiet, a scene beside the words in warm (still for reduced motion) and a
// scene you can play with in playful.

import { SgElement, defineComponent } from '../../core/component.js';
import { sceneName, sceneParams } from './empty.core.js';

export { STRINGS, sceneName, sceneParams, illustration } from './empty.core.js';

let uid = 0;

export class SgEmpty extends SgElement {
  static observedAttributes = ['register', 'scene'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #mo = null;

  connected() {
    // gather the builder's content into one body, so a skin can place a picture beside it
    let body = this.querySelector(':scope > .sg-empty-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'sg-empty-body';
      body.append(...[...this.childNodes].filter(n => !(n.nodeType === 1 && n.matches('.sg-empty-art, sg-scene'))));
      this.append(body);
    }
    const h = body.querySelector('h1, h2, h3, h4, h5, h6, [role=heading]');
    if (h) {
      h.id ||= `sg-empty-${++uid}`;
      this.setAttribute('role', 'region');
      this.setAttribute('aria-labelledby', h.id);
    }
    // scene-* attributes are not known in advance, so watch them all
    this.#mo = new MutationObserver(() => this.update());
    this.#mo.observe(this, { attributes: true });
  }
  disconnected() { this.#mo?.disconnect(); }

  state() {
    return { scene: sceneName(this.getAttribute('scene')), params: sceneParams([...this.attributes].map(a => [a.name, a.value])) };
  }
}

defineComponent('sg-empty', SgEmpty);
