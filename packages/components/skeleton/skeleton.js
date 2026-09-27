// <sg-skeleton>: a placeholder for a region whose content is on its way.
//
//   <sg-skeleton busy shape="card" lines="2" label="your bookings">
//     …the real content, rendered here when it arrives…
//   </sg-skeleton>
//
// While `busy`, the element is aria-busy, its content is hidden, and a hidden
// line of text says what is loading. When `busy` goes, the content shows at
// once, "Your bookings loaded" is announced, and the skin plays its arrival.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, nextPhase } from './skeleton.core.js';

export { STRINGS, layout, outline, nextPhase, SHAPES } from './skeleton.core.js';

export class SgSkeleton extends SgElement {
  static observedAttributes = ['register', 'busy', 'shape', 'lines', 'label', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #status = null; #phase = null;

  get busy() { return this.hasAttribute('busy'); }
  set busy(v) { this.toggleAttribute('busy', !!v); }

  connected() {
    this.#status = this.querySelector(':scope > .sg-skeleton-status') ?? Object.assign(document.createElement('span'), { className: 'sg-skeleton-status' });
    this.#status.setAttribute('role', 'status');
    this.prepend(this.#status);
    this.#sync(true);
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (old !== now && this.#status) this.#sync(false);
  }

  #sync(first) {
    const label = this.getAttribute('label') || '';
    const phase = nextPhase(this.#phase, this.busy, this.motion);
    const arrived = this.#phase === 'busy' && phase !== 'busy';
    this.#phase = phase;
    this.setAttribute('aria-busy', String(this.busy));
    // while busy, anyone reading the region hears what is loading; the arrival is announced once
    if (this.busy) this.#status.textContent = STRINGS.loading(label);
    else if (arrived && !first) { this.#status.textContent = STRINGS.loaded(label); this.emit('sg-loaded', { label }); }
    else if (first) this.#status.textContent = '';
  }

  state() {
    return {
      busy: this.busy,
      phase: this.#phase,
      shape: this.getAttribute('shape') || 'text',
      lines: parseInt(this.getAttribute('lines'), 10) || 3,
      seed: this.getAttribute('seed') || 1,
      visible: this.visible,
    };
  }
}

defineComponent('sg-skeleton', SgSkeleton);
