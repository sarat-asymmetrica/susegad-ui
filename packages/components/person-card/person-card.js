// <sg-person-card>: one person, and what they are building. The name, the
// role, the one line about their work and a link are plain markup that reads
// fine without JavaScript. With it, the card draws an initials disc instead of
// a photo: no photo until the person gives one and their consent is recorded.
//
//   <sg-person-card data-track="AI for Kids">
//     <article aria-labelledby="p1">
//       <h3 id="p1">Priyanka Naik</h3>
//       <p class="sg-person-role">Teacher, Aldona</p>
//       <p class="sg-person-building">A Konkani storybook reader</p>
//       <p class="sg-person-link"><a href="https://example.com/priyanka">Her notes</a></p>
//     </article>
//   </sg-person-card>
//
// The initials disc (aria-hidden: the heading is read as usual) is added by the
// element from the heading's words, so author and element cannot disagree. A
// photo may be added only by the author, with consent recorded (see the docs):
// put `<img class="sg-person-photo" alt="...">` inside the article and the disc
// steps aside. Attributes: data-track (the directory reads it), seed, register.
// Events: sg-person-ready when the disc is drawn.

import { SgElement, defineComponent } from '../../core/component.js';
import { initialsOf, STRINGS } from './person.core.js';

export { STRINGS };

export class SgPersonCard extends SgElement {
  static native = 'article';
  static observedAttributes = ['register', 'seed', 'data-track'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    if (!this.native) console.warn('sg-person-card: put the person in an <article>.');
    const img = this.native?.querySelector('img.sg-person-photo');
    if (img && !img.getAttribute('alt')) {
      img.alt = STRINGS.photoAlt(this.name);
    }
    this.toggleAttribute('data-photo', !!img);
    this.#disc();
    this.update();
  }
  disconnected() {}

  /** The heading's words: the card is named by the person, and the disc is cut from the same words. */
  get name() { return this.native?.querySelector('h1, h2, h3, h4')?.textContent.trim() ?? ''; }
  /** The initials the disc shows, from the pure core. */
  get initials() { return initialsOf(this.name); }

  /** The initials disc: one element, owned by the element, cut from the heading. */
  #disc() {
    const box = this.native;
    if (!box) return;
    let disc = box.querySelector('.sg-person-initials');
    if (this.hasAttribute('data-photo')) { disc?.remove(); return; }
    if (!disc) {
      disc = this.ownerDocument.createElement('span');
      disc.className = 'sg-person-initials';
      disc.setAttribute('aria-hidden', 'true');
      const first = box.firstElementChild;
      first ? first.before(disc) : box.append(disc);
      this.emit('sg-person-ready', {});
    }
    disc.textContent = this.initials;
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (this.native && old !== now && (name === 'seed' || name === 'data-track')) this.update();
  }

  state() {
    return {
      initials: this.initials,
      name: this.name,
      seed: this.getAttribute('seed') || this.name || 'person',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-person-card', SgPersonCard);
