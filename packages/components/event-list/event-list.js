// <sg-event-list>: a calendar of <sg-event-card>s that keeps itself honest. What
// is still to come is on top, soonest first. What has happened is put away in a
// closed "Before" drawer (a native <details>). When nothing is to come it says
// so in words, with your call to action beside it. And when the clock passes an
// event while the page is open, the card moves on its own.
//
//   <sg-event-list>
//     <h2>What's on</h2>
//     <sg-event-card …>…</sg-event-card>
//     <sg-event-card …>…</sg-event-card>
//     <p class="sg-event-empty">Nothing on the calendar right now. Ask about a private session.</p>   (optional)
//     <p class="sg-event-ask"><a href="https://wa.me/…">Ask about a private session</a></p>           (optional)
//   </sg-event-list>
//
// Without JavaScript the cards simply stack in the order written, and the empty
// lines stay hidden. Sort them soonest first when you write the page, or use
// partitionEvents() from event-card/event.core.js at build time.
//
// The empty line and the call to action show only when nothing is to come. If
// you write no .sg-event-empty, a default line is added.
// Attributes: now (an ISO time to count from, which stops the clock), timezone
// (the default for every card), register.
// Events: sg-event-list-change { upcoming, past } when a card moves.

import { SgElement, defineComponent } from '../../core/component.js';
import { ZONE, STRINGS, parseWhen } from '../event-card/event.core.js';
import { planList, sameOrder } from './event-list.core.js';

const MAX_WAIT = 2 ** 31 - 1;

export class SgEventList extends SgElement {
  static native = null;
  static observedAttributes = ['register', 'now', 'timezone'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #upcoming = null; #before = null; #beforeList = null; #summary = null; #empty = null; #made = []; #timer = 0; #was = true; #plan = null;
  #mo = null;

  connected() {
    const doc = this.ownerDocument;
    this.#upcoming = doc.createElement('div');
    this.#upcoming.className = 'sg-event-upcoming';
    this.#upcoming.setAttribute('role', 'list');
    const first = this.querySelector('sg-event-card') ?? this.querySelector('.sg-event-empty, .sg-event-ask');
    first ? first.before(this.#upcoming) : this.append(this.#upcoming);

    this.#empty = this.querySelector('.sg-event-empty');
    if (!this.#empty) {
      this.#empty = doc.createElement('p');
      this.#empty.className = 'sg-event-empty';
      this.#empty.textContent = STRINGS.empty;
      this.#made.push(this.#empty);
      const ask = this.querySelector('.sg-event-ask');
      ask ? ask.before(this.#empty) : this.#upcoming.after(this.#empty);
    }

    this.#before = doc.createElement('details');
    this.#before.className = 'sg-event-before';
    this.#summary = doc.createElement('summary');
    this.#beforeList = doc.createElement('div');
    this.#beforeList.className = 'sg-event-past';
    this.#beforeList.setAttribute('role', 'list');
    this.#before.append(this.#summary, this.#beforeList);
    this.append(this.#before);
    this.#made.push(this.#upcoming, this.#before);

    // a card added later (a framework, a fetch) joins the calendar
    this.#mo = new MutationObserver(list => { if (list.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n.localName === 'sg-event-card'))) this.sync(); });
    this.#mo.observe(this, { childList: true });
    this.sync();
  }

  disconnected() {
    clearTimeout(this.#timer); this.#timer = 0;
    this.#mo?.disconnect();
    // hand the cards back to where the author put them: directly in the list, in the order shown
    const cards = [...this.querySelectorAll('sg-event-card')];
    this.#upcoming?.before(...cards);
    cards.forEach(c => c.removeAttribute('role'));
    this.#made.forEach(n => n.remove());
    this.#made = []; this.#plan = null;
  }

  attributeChangedCallback(name, old, now) { super.attributeChangedCallback(name, old, now); if (this.#upcoming && old !== now) this.sync(); }
  update() {
    super.update();
    // back on screen after a while away: catch up with the clock before the timer starts again
    if (this.visible !== this.#was) { this.#was = this.visible; if (this.visible && this.#upcoming && !this.hasAttribute('now')) return void this.sync(); }
    this.#schedule();
  }

  /** The time the list counts from, in ms: the `now` attribute when set, otherwise the real clock. */
  clock() { const fixed = parseWhen(this.getAttribute('now'), this.getAttribute('timezone') || ZONE); return Number.isFinite(fixed) ? fixed : Date.now(); }

  /** Read the clock, ask every card to do the same, and put each card where it now belongs. */
  sync() {
    if (!this.#upcoming) return;
    const now = this.clock(), zone = this.getAttribute('timezone') || ZONE;
    const cards = [...this.querySelectorAll('sg-event-card')];
    const items = cards.map(card => ({
      card,
      start: parseWhen(card.getAttribute('start'), card.getAttribute('timezone') || zone),
      end: parseWhen(card.getAttribute('end'), card.getAttribute('timezone') || zone),
      zone: card.getAttribute('timezone') || zone,
    }));
    for (const { card } of items) card.refresh?.(now);
    const plan = planList(items, now), prev = this.#plan;
    this.#plan = plan;
    const upcoming = plan.upcoming.map(i => i.card), past = plan.past.map(i => i.card);
    const moved = !prev || !sameOrder(upcoming, prev.upcoming.map(i => i.card)) || !sameOrder(past, prev.past.map(i => i.card));
    if (moved) {
      this.#upcoming.append(...upcoming);
      this.#beforeList.append(...past);
      for (const c of cards) c.setAttribute('role', 'listitem');
      this.#summary.textContent = plan.before;
    }
    this.#before.hidden = !past.length;
    for (const el of this.querySelectorAll(':scope > .sg-event-empty, :scope > .sg-event-ask')) el.hidden = !plan.empty;
    this.#upcoming.hidden = plan.empty;
    this.dataset.empty = plan.empty ? 'true' : 'false';
    this.#schedule();
    this.update();
    if (prev && moved) this.emit('sg-event-list-change', { upcoming: upcoming.length, past: past.length });
  }

  /** One timer for the whole list, set for the next moment any card changes, and only while the list can be seen. */
  #schedule() {
    clearTimeout(this.#timer); this.#timer = 0;
    const next = this.#plan?.nextAt;
    if (this.hasAttribute('now') || !this.isConnected || !this.visible || !Number.isFinite(next)) return;
    this.#timer = setTimeout(() => this.sync(), Math.min(Math.max(next - Date.now(), 0) + 50, MAX_WAIT));
  }

  state() { return { empty: !!this.#plan?.empty, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-event-list', SgEventList);
