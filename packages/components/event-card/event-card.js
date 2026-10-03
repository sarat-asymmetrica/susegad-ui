// <sg-event-card>: one workshop, class, supper club or pop-up, and whether it is
// still on. The date, the venue, what you'll do and eat, the price and a call to
// action are plain markup that reads fine without JavaScript. With it, the card
// reads the clock (in the venue's own time zone) and says so: how far off it is,
// today, on now, or over. A seats line appears only when seats-left is given. A
// finished event stops offering its booking link, and says why.
//
//   <sg-event-card kind="workshop" start="2026-10-04T11:00" end="2026-10-04T13:00" seats-left="4">
//     <article aria-labelledby="ev1">
//       <p class="sg-event-kind">Workshop</p>
//       <h3 id="ev1">Handmade pasta, from the dough up</h3>
//       <p class="sg-event-when"><time datetime="2026-10-04T11:00:00+05:30">Sun 4 Oct, 11 am to 1 pm</time></p>
//       <p class="sg-event-where"><span class="sg-event-venue">A kitchen studio</span>, <span class="sg-event-area">Aldona</span> <a href="https://maps.example/...">Map</a></p>
//       <section class="sg-event-do"><h4>What you'll do</h4><ul><li>Mix and knead the dough</li></ul></section>
//       <section class="sg-event-eat"><h4>What you'll eat</h4><ul><li>Your own tagliatelle</li></ul></section>
//       <footer class="sg-event-stub">
//         <p class="sg-event-price"><span class="sg-event-amount">₹1,800</span> per person</p>
//         <p class="sg-event-cta"><a href="https://wa.me/...">Save my seat</a></p>
//       </footer>
//     </article>
//   </sg-event-card>
//
// Attributes: start (required, "2026-10-04T11:00"), end, timezone (default Asia/Kolkata),
// seats-left, kind (workshop | supper-club | pop-up | class), now (an ISO time to count from,
// for demos and tests; it stops the clock), seed, register.
// Events: sg-event-state { phase, soldOut } when the clock moves it on.
// Inside an <sg-event-list> the list keeps the clock and the card does not.

import { SgElement, defineComponent } from '../../core/component.js';
import { ZONE, KINDS, parseWhen, describeEvent } from './event.core.js';

const MAX_WAIT = 2 ** 31 - 1;

export class SgEventCard extends SgElement {
  static native = 'article';
  static observedAttributes = ['register', 'start', 'end', 'timezone', 'seats-left', 'kind', 'now', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #info = null; #timer = 0; #made = new Set(); #was = true;

  connected() {
    if (!this.native) console.warn('sg-event-card: put the event in an <article>.');
    if (!this.hasAttribute('start') || !Number.isFinite(this.start)) console.warn('sg-event-card: start="YYYY-MM-DDTHH:MM" is needed to know whether the event is still on.');
    this.refresh();
  }
  disconnected() { clearTimeout(this.#timer); this.#timer = 0; this.#made.forEach(n => n.remove()); this.#made.clear(); }
  attributeChangedCallback(name, old, now) { super.attributeChangedCallback(name, old, now); if (this.native && old !== now) this.refresh(); }
  update() {
    super.update();
    // Back on screen after a while away: catch up with the clock before the timer starts again.
    if (this.visible !== this.#was) { this.#was = this.visible; if (this.visible && this.#info && !this.hasAttribute('now') && !this.#listed) return void this.refresh(); }
    this.#schedule();
  }

  get zone() { return this.getAttribute('timezone') || this.closest('sg-event-list')?.getAttribute('timezone') || ZONE; }
  get start() { return parseWhen(this.getAttribute('start'), this.zone); }
  get end() { return parseWhen(this.getAttribute('end'), this.zone); }
  /** The latest description of the event: { phase, soldOut, status, seatsLine, showCta, when, datetime, nextAt }. */
  get info() { return this.#info; }
  /** True inside an <sg-event-list>, which then keeps the clock for every card. */
  get #listed() { return !!this.closest('sg-event-list'); }

  #now() {
    const list = this.closest('sg-event-list');
    if (list?.clock) return list.clock();
    const fixed = parseWhen(this.getAttribute('now'), this.zone);
    return Number.isFinite(fixed) ? fixed : Date.now();
  }

  /** Read the clock (or `now`, in ms) again and put the card in step with it. */
  refresh(now = this.#now()) {
    const box = this.native;
    if (!box) return null;
    const prev = this.#info;
    const info = this.#info = describeEvent(now, { start: this.start, end: this.end, seatsLeft: this.getAttribute('seats-left'), zone: this.zone });
    this.dataset.phase = info.phase;
    this.toggleAttribute('data-sold-out', info.soldOut);
    this.#words(box, info);
    for (const cta of box.querySelectorAll('.sg-event-cta')) cta.hidden = !info.showCta;
    for (const alt of box.querySelectorAll('[data-when="sold-out"]')) alt.hidden = !info.soldOut;
    this.#schedule();
    this.update();
    if (prev && (prev.phase !== info.phase || prev.soldOut !== info.soldOut)) this.emit('sg-event-state', { phase: info.phase, soldOut: info.soldOut });
    return info;
  }

  /** The words the clock owns: kind, date, status, seats. The rest is the author's. */
  #words(box, info) {
    const doc = this.ownerDocument, kind = KINDS[this.getAttribute('kind')];
    const make = (cls, tag = 'p') => {
      let el = box.querySelector(`.${cls}`);
      if (!el) { el = doc.createElement(tag); el.className = cls; this.#made.add(el); }
      return el;
    };
    const kindEl = box.querySelector('.sg-event-kind') ?? (kind ? make('sg-event-kind') : null);
    if (kindEl && !kindEl.isConnected) { kindEl.textContent = kind; box.prepend(kindEl); }
    if (info.when) {
      const whenP = make('sg-event-when');
      let time = whenP.querySelector('time');
      if (!time) { time = doc.createElement('time'); whenP.append(time); }
      time.setAttribute('datetime', info.datetime);
      time.textContent = info.when;
      if (!whenP.isConnected) (box.querySelector(':is(h1,h2,h3,h4)') ?? kindEl ?? box.firstChild)?.after(whenP);
    }
    const status = make('sg-event-status');
    status.textContent = info.status;
    status.hidden = !info.status;
    if (!status.isConnected) (box.querySelector('.sg-event-when') ?? box.firstChild)?.after(status);
    const seats = box.querySelector('.sg-event-seats') ?? (info.seatsLine ? make('sg-event-seats') : null);
    if (seats) {
      seats.textContent = info.seatsLine;
      seats.hidden = !info.seatsLine;
      if (!seats.isConnected) { const stub = box.querySelector('.sg-event-stub'); const price = stub?.querySelector('.sg-event-price'); price ? price.after(seats) : (stub ?? box).append(seats); }
    }
  }

  /** One timer, set for the next change, and only while the card can be seen. */
  #schedule() {
    clearTimeout(this.#timer); this.#timer = 0;
    const next = this.#info?.nextAt;
    if (this.hasAttribute('now') || !this.isConnected || !this.visible || this.#listed || !Number.isFinite(next)) return;
    this.#timer = setTimeout(() => this.refresh(), Math.min(Math.max(next - Date.now(), 0) + 50, MAX_WAIT));
  }

  state() {
    return { seed: this.getAttribute('seed') || this.native?.querySelector(':is(h1,h2,h3,h4)')?.textContent.trim() || 'event', phase: this.#info?.phase ?? 'unknown', soldOut: !!this.#info?.soldOut, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-event-card', SgEventCard);
