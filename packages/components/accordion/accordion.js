// <sg-accordion>: frequently asked questions, built on the browser's own
// <details> and <summary>. The platform does the work: each summary is a
// button that opens and closes with Enter or Space, screen readers get the
// open and closed state for free, and several <details> sharing one `name`
// form an exclusive group, only one open at a time. This element adds the
// account: it copies its own `name` attribute onto any child that has none
// (a child that already carries a name keeps it), and it tells the page what
// is open, as items move.
//
//   <sg-accordion name="faq">
//     <details name="faq" open>
//       <summary>How do I get to Aldona?</summary>
//       <p>By car or bus from Panjim, about half an hour.</p>
//     </details>
//     <details name="faq">
//       <summary>Is breakfast included?</summary>
//       <p>Yes, served on the veranda until 10.</p>
//     </details>
//   </sg-accordion>
//
// A child that already carries its own `name` keeps it, so one accordion can
// hold an exclusive group and free-standing sections side by side. Without a
// `name` anywhere the items are simply independent; the platform still does
// all the opening and closing, with or without JavaScript.
//
// Attributes: name (an exclusive group for the children that have none),
// register. Events: sg-accordion-change { open, total, exclusive } whenever an
// item moves.

import { SgElement, defineComponent } from '../../core/component.js';
import { groupsOf, describeItems } from './accordion.core.js';

export class SgAccordion extends SgElement {
  static native = 'details';
  static observedAttributes = ['register', 'name'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    const items = this.#read();
    if (!items.length) console.warn('sg-accordion: put <details><summary>…</summary>…</details> children inside the element; there is nothing to open without them.');
    // An exclusive group for every child that has no name of its own.
    const group = this.getAttribute('name');
    if (group) {
      for (const d of this.details) if (!d.hasAttribute('name')) d.setAttribute('name', group);
    }
    // Two items of one group shipping open are already settled by the time we
    // see them: the browser keeps the first and drops the rest while parsing.
    // `resolveOpen` in the pure core does the same job in the open, for a
    // build step to check the source with.
    this.#listen();
    this.update();
  }
  disconnected() { this.#unlisten(); }
  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'name' && old !== now && this.isConnected) {
      if (old) for (const d of this.details) if (d.getAttribute('name') === old) d.removeAttribute('name');
      const group = now;
      if (group) for (const d of this.details) if (!d.hasAttribute('name')) d.setAttribute('name', group);
      this.update();
    }
  }

  /** Every <details> child, in the order the reader sees them. */
  get details() { return [...this.querySelectorAll(':scope > details')]; }
  /** Plain data for the skins and for tests: one row per item. */
  #read() {
    return this.details.map(d => ({ name: d.getAttribute('name'), open: d.hasAttribute('open'), label: d.querySelector(':scope > summary')?.textContent.trim() ?? '' }));
  }
  get items() { return this.#read(); }
  /** The account, recomputed live: { total, open, exclusive, groups }. */
  get account() { return describeItems(this.#read()); }

  #on = null; #watched = []; #last = null;
  #listen() {
    this.#unlisten();
    this.#on = () => this.update();
    for (const d of this.details) { d.addEventListener('toggle', this.#on); this.#watched.push(d); }
  }
  #unlisten() { for (const d of this.#watched) d.removeEventListener('toggle', this.#on); this.#watched = []; }

  update() {
    super.update();
    const a = this.account;
    this.dataset.openCount = String(a.open.length);
    this.toggleAttribute('data-any-open', a.open.length > 0);
    // Say something only when an item moved: both group-mates fire a toggle on
    // one turn, and the upgrade of the element re-reads the same account.
    const sig = JSON.stringify(a);
    if (sig !== this.#last) { this.#last = sig; this.emit('sg-accordion-change', { open: a.open, total: a.total, exclusive: a.exclusive }); }
  }

  state() {
    const items = this.#read();
    return {
      total: items.length,
      open: items.map((it, i) => (it.open ? i : -1)).filter(i => i >= 0),
      groups: [...groupsOf(items).keys()],
      motion: this.motion,
      seed: this.getAttribute('seed') || this.querySelector('summary')?.textContent.trim() || 'accordion',
    };
  }
}

defineComponent('sg-accordion', SgAccordion);
