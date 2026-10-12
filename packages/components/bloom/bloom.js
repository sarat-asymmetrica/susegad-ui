// <sg-bloom>: a flower head laid out by Vogel's model, so a count can be drawn honestly (37 people, 37 florets),
// a head can grow one floret at a time with nothing jumping, and every seed has its own flower. Zendu (the
// marigold) first, drawn face-on as SVG.
//
//   <sg-bloom seed-from="Maria Fernandes" size="lg"></sg-bloom>                       a decorative head, hidden from assistive tech
//   <sg-bloom seed-from="Maria Fernandes" label="Maria's bloom"></sg-bloom>            a picture that stands for something
//   <sg-bloom count="37" label="people registered"></sg-bloom>                         37 florets, and "37 people registered" in text
//   <sg-bloom count="37">37 people registered, and the list is open.</sg-bloom>        your own words, the picture follows them
//
// Attributes: kind (zendu), count (the florets to draw, 0 to 400; a full head of 144 when absent; when set, the
// number is also written beside the flower), seed or seed-from (any text, a name for instance), label, size
// (a number of pixels, sm, md, lg, or a CSS length), register.
// Event: sg-bloom-grown, once the florets of a growing head have all arrived.
//
// Quiet: single-ink dots, still. Warm: the zendu palette, still. Playful: the head grows from the centre out, and
// a press gives the outer ring a small shiver. Reduced motion and Save-Data show the finished head.

import { SgElement, defineComponent } from '../../core/component.js';
import { countOf, seedOf, sizeOf, describe, KINDS } from './bloom.core.js';

const own = el => el.classList.contains('sg-bloom-n') || el.localName === 'svg';

export class SgBloom extends SgElement {
  static native = null;
  static observedAttributes = ['register', 'kind', 'count', 'seed', 'seed-from', 'size', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #text = null; #mo = null;

  connected() {
    this.#sync();
    // words the author changes later (a server swap) change what the picture is to assistive technology
    this.#mo = new MutationObserver(() => { if (this.#words() !== this.#hadWords) this.update(); });
    this.#mo.observe(this, { childList: true, characterData: true, subtree: true });
  }
  disconnected() { this.#mo?.disconnect(); this.#mo = null; }

  #hadWords = false;
  /** Text the author wrote inside the element; the picture and the number the element writes do not count. */
  #words() {
    let t = '';
    for (const n of this.childNodes) if (n.nodeType === 3 || (n.nodeType === 1 && !own(n))) t += n.textContent;
    return t.trim() !== '';
  }

  update() { this.#sync(); super.update(); }

  /** The number (and label) written beside the picture, and the size, both from the attributes. */
  #sync() {
    const d = describe({ count: countOf(this.getAttribute('count')), label: this.getAttribute('label') ?? '', hasText: (this.#hadWords = this.#words()) });
    this.style.setProperty('--sg-bloom-size', sizeOf(this.getAttribute('size')));
    if (d.text) {
      this.#text ??= Object.assign(document.createElement('span'), { className: 'sg-bloom-n' });
      if (this.#text.textContent !== d.text) this.#text.textContent = d.text;
      if (this.#text.parentNode !== this) this.append(this.#text);
    } else if (this.#text?.parentNode) this.#text.remove();
  }

  state() {
    const count = countOf(this.getAttribute('count'));
    const d = describe({ count, label: this.getAttribute('label') ?? '', hasText: this.#hadWords });
    const kind = this.getAttribute('kind');
    return {
      kind: KINDS.includes(kind) ? kind : 'zendu',
      count: count ?? undefined,
      seed: seedOf(this.getAttribute('seed-from'), this.getAttribute('seed')),
      role: d.role, name: d.name,
      motion: this.motion, visible: this.visible,
    };
  }
}

defineComponent('sg-bloom', SgBloom);
