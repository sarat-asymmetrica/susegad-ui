// <sg-gallery>: photographs, consent first. Every place a photograph goes is
// designed for the consent that hasn't arrived yet: a slot with consent="pending"
// shows a drawn frame with photo corners, its caption and the count ("2 photos,
// coming soon"), and never the image. A slot with no consent attribute or with
// consent="granted" shows the image, and opens it in the native <dialog>.
// The element never invents photographs or captions; the author writes the slots.
//
//   <sg-gallery register="warm" seed="homestay">
//     <figure class="sg-gallery-slot" consent="granted">
//       <img src="/posters/scene-chai.warm.light.jpg" alt="Morning chai on the veranda" width="760" height="475">
//       <figcaption>Morning chai on the veranda</figcaption>
//     </figure>
//     <figure class="sg-gallery-slot" consent="pending">
//       <figcaption>Two portraits by the window</figcaption>
//     </figure>
//   </sg-gallery>
//
// Attributes: register, seed (the frames' hand and the playful tilt).
// Slots: any element with class sg-gallery-slot; consent on it says what shows.
// The element adds: a drawn frame (aria-hidden SVG) and a p.sg-gallery-count
// ("2 photos, coming soon") to each pending slot, a button around each shown
// photograph, and one <dialog> per gallery. Without JavaScript the author's
// markup reads fine: photographs show, pending slots show whatever was written.

import { SgElement, defineComponent } from '../../core/component.js';
import { consentOf, pendingLine, columnsFor } from './gallery.core.js';
import { arrive } from '../../core/arrive.js';
import { langOf, langOfKey, strings, t } from '../../core/strings.js';
import { BY_LANG } from '../../core/strings.table.js';

const NS = 'http://www.w3.org/2000/svg';

export class SgGallery extends SgElement {
  static native = null; // slots are figures the author wrote; there is no single native child
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #dialog = null; #made = new Set(); #watch = null; #ro = null; #arrive = null;

  get slots() { return [...this.querySelectorAll('.sg-gallery-slot')]; }
  get pending() { return this.slots.filter(s => consentOf(s.getAttribute('consent')) === 'pending'); }

  connected() {
    // the author may flip consent after the page loads; keep in step
    this.#watch = new MutationObserver(() => this.refresh());
    this.#watch.observe(this, { subtree: true, attributes: true, attributeFilter: ['consent'] });
    this.#ro = new ResizeObserver(() => this.#columns());
    this.#ro.observe(this);
    this.#arrive = arrive(this, '.sg-gallery-slot');
    this.refresh();
  }

  disconnected() {
    this.#arrive?.stop(); this.#arrive = null;
    this.#watch?.disconnect(); this.#watch = null;
    this.#ro?.disconnect(); this.#ro = null;
    this.#made.forEach(n => n.remove()); this.#made.clear();
    this.#dialog = null;
  }

  attributeChangedCallback(name, old, now) { super.attributeChangedCallback(name, old, now); if (this.native !== null && old !== now) this.refresh(); }

  /** Put every slot in step with its consent, and the count in step with the slots. */
  refresh() {
    const slots = this.slots, line = pendingLine(this.pending.length);
    for (const slot of slots) {
      const consent = consentOf(slot.getAttribute('consent'));
      slot.dataset.consent = consent;
      if (consent === 'pending') this.#frame(slot, line);
      else this.#showned(slot);
    }
    this.#columns();
  }

  /** A consent-pending slot: never a control, never an image. The frame is an
   *  aria-hidden drawing; the caption and the count are real text. An img the
   *  author left in the slot is kept (so consent arriving later can restore
   *  it) but stripped of its src and hidden: it is never fetched again. */
  #frame(slot, line) {
    for (const img of slot.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      if (src) img.dataset.sggSrc = src;
      img.removeAttribute('src');
      img.setAttribute('hidden', '');
      img.setAttribute('aria-hidden', 'true');
      img.tabIndex = -1;
    }
    for (const btn of slot.querySelectorAll('button.sg-gallery-open')) { this.#made.delete(btn); btn.replaceWith(...btn.childNodes); }
    let count = slot.querySelector('.sg-gallery-count');
    if (!count) {
      count = this.ownerDocument.createElement('p');
      count.className = 'sg-gallery-count';
      this.#made.add(count);
      slot.append(count);
    }
    count.textContent = line;
    let frame = slot.querySelector('.sg-gallery-frame');
    if (!frame) {
      const svg = this.ownerDocument.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'sg-gallery-frame');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      this.#made.add(svg);
      slot.prepend(svg);
    }
  }

  /** A photograph the author chose to show: a real button opens it in the dialog.
   *  An img that a pending spell had stripped gets its src back here. */
  #showned(slot) {
    for (const stale of slot.querySelectorAll('.sg-gallery-frame, .sg-gallery-count')) if (this.#made.has(stale)) { this.#made.delete(stale); stale.remove(); }
    for (const btn of slot.querySelectorAll('button.sg-gallery-open')) { this.#made.delete(btn); btn.replaceWith(...btn.childNodes); }
    for (const img of slot.querySelectorAll('img')) {
      if (img.dataset.sggSrc && !img.getAttribute('src')) img.setAttribute('src', img.dataset.sggSrc);
      img.removeAttribute('hidden');
      img.removeAttribute('aria-hidden');
      img.removeAttribute('tabindex');
      delete img.dataset.sggSrc;
    }
    const img = slot.querySelector('img');
    if (!img || img.closest('button')) return;
    const btn = this.ownerDocument.createElement('button');
    btn.type = 'button';
    btn.className = 'sg-gallery-open';
    btn.setAttribute('aria-haspopup', 'dialog');
    if (slot.dataset.consent === 'granted') btn.setAttribute('aria-label', t(this.#words(), 'openLarger', img.alt));
    img.replaceWith(btn);
    btn.append(img);
    this.#made.add(btn);
    btn.addEventListener('click', () => this.#open(slot, img, btn));
  }

  /** The library's own words in the page's language (decision 0025): the shared table, English where it has no Konkani yet. */
  #words() { return strings(BY_LANG, langOf(this)); }

  /** The grid's columns, from the core, told to the CSS as a custom property. */
  #columns() {
    const n = columnsFor(this.clientWidth, this.slots.length);
    this.style.setProperty('--sg-gallery-cols', String(n));
  }

  /**
   * The native dialog: showModal() traps focus and Escape closes it, the
   * platform returns focus to the opener, and a close button is in there too.
   */
  #open(slot, img, opener) {
    const doc = this.ownerDocument;
    if (!this.#dialog) {
      this.#dialog = doc.createElement('dialog');
      this.#dialog.className = 'sg-gallery-dialog';
      const fig = doc.createElement('figure');
      this.#dialog.append(fig);
      const close = doc.createElement('button');
      close.type = 'button'; close.className = 'sg-gallery-close';
      this.#made.add(this.#dialog);
      this.#dialog.append(close);
      this.#dialog.addEventListener('close', () => this.update());
      this.append(this.#dialog);
    }
    const words = this.#words(), page = langOf(this);
    const closeBtn = this.#dialog.querySelector('.sg-gallery-close');
    closeBtn.textContent = t(words, 'close');
    // words with no translation yet are English, and say so
    const from = langOfKey(BY_LANG, page, 'close');
    if (from === 'en' && !/^en(-|$)/.test(page)) closeBtn.lang = 'en'; else closeBtn.removeAttribute('lang');
    const fig = this.#dialog.querySelector('figure');
    let pic = fig.querySelector('img');
    if (!pic) {
      pic = doc.createElement('img');
      const cap = doc.createElement('figcaption');
      fig.append(pic, cap);
    }
    const caption = slot.querySelector('figcaption');
    pic.src = img.currentSrc || img.src;
    pic.alt = img.alt;
    pic.width = img.naturalWidth || undefined;
    pic.height = img.naturalHeight || undefined;
    fig.querySelector('figcaption').textContent = caption?.textContent ?? img.alt;
    this.#dialog.setAttribute('aria-label', t(words, 'aPhotograph', fig.querySelector('figcaption').textContent));
    this.#dialog.querySelector('.sg-gallery-close').onclick = () => this.#dialog.close();
    this.#dialog.showModal();
    this.#dialog.querySelector('.sg-gallery-close').focus();
    this.update();
  }

  state() {
    return { seed: this.getAttribute('seed') || 'gallery', motion: this.motion, visible: this.visible, pending: this.pending.length };
  }
}

defineComponent('sg-gallery', SgGallery);
