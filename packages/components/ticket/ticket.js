// <sg-ticket>: a registration's ticket. The name, the event, the time in IST, an id made on the device, and
// the id as a QR code with its text beside it. It can be saved as a picture, and it is kept only on the
// visitor's own device, so it opens again later, offline too.
//
//   <sg-ticket event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket>
//
//   const { ticket, kept } = await el.issue('Maria Fernandes');   // makes the id, keeps it, shows it, finishes
//   el.show(ticket);                                               // shows one without the finishing moment
//   el.forget();                                                   // forgets the one on this device
//
// With nothing kept on the device the element is hidden. With a ticket kept for this event (`event` and
// `at` match), it shows it when it connects, quietly: no announcement, no sound, no settle. Nothing is sent
// anywhere: the ticket is in localStorage and in the page, and the saved picture is made in the browser.
// Events: sg-ticket { ticket, kept, isNew } when one is shown.

import { SgElement, defineComponent } from '../../core/component.js';
import { strings, langOf, langOfKey } from '../../core/strings.js';
import '../qr/qr.js';
import { BY_LANG } from './ticket.strings.js';
import { announce } from '../../core/announce.js';
import { announcement, forgetTicket, isFor, loadTicket, makeTicket, newId, rows, safeStore, saveTicket, validTicket } from './ticket.core.js';
import { finish } from './ticket.finish.js';

export { BY_LANG };

let uid = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
/** Where focus goes when the card it was on goes: the next thing a person could focus, else <main> (tabindex -1). */
function landing(el) {
  const next = [...document.querySelectorAll(FOCUSABLE)].find(n => !el.contains(n) && el.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING && n.getClientRects().length);
  if (next) return next;
  const main = document.querySelector('main, [role="main"]');
  if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  return main;
}
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export class SgTicket extends SgElement {
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  static observedAttributes = ['register', 'event', 'event-id', 'at'];

  /** The ticket on show, or null. */
  ticket = null;
  #store = safeStore(); #seed = 0; #card = null; #status = null; #heading = null;

  get event() { return this.getAttribute('event') ?? ''; }
  /** The event named in no language, so a ticket still belongs to it when the page is in another language. */
  get eventId() { return this.getAttribute('event-id') ?? ''; }
  get at() { return this.getAttribute('at') ?? ''; }

  connected() {
    if (!this.id) this.id = `sg-ticket-${++uid}`;
    this.#seed = [...this.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
    this.hidden = true;
    // a ticket past its keeping time (seven days after the event's day) is deleted here, when it is looked for
    const kept = loadTicket(this.#store, Date.now());
    // a ticket for another event is not this event's ticket
    if (isFor(kept, { eventId: this.eventId, event: this.event, at: this.at })) this.show(kept);
  }

  /**
   * Make a ticket for `name`: an id from the device's own random numbers, kept on the device, shown, and ended with
   * the finishing moment. Resolves to { ticket, kept }, `kept` being whether the browser kept it (it still shows
   * if not), or null if the name, the event or the time is missing.
   */
  async issue(name, { id = newId(), issued = Date.now() } = {}) {
    const ticket = makeTicket({ name, event: this.event, eventId: this.eventId, at: this.at, id, issued });
    if (!ticket) return null;
    const kept = saveTicket(this.#store, ticket);
    this.show(ticket, { isNew: true, kept });
    const lang = langOf(this);
    await finish(this.#card, { say: announcement(ticket, lang), motion: this.motion, register: this.register, focus: this.#heading, from: this });
    return { ticket, kept };
  }

  /** Show a ticket (a record from makeTicket), replacing the one on show. */
  show(ticket, { isNew = false, kept = true } = {}) {
    if (!validTicket(ticket)) return false;
    this.ticket = ticket;
    this.#render(ticket);
    this.hidden = false;
    this.update();
    this.emit('sg-ticket', { ticket, kept, isNew });
    return true;
  }

  /**
   * Forget the ticket on this device and take the card away. Said once ("Forgotten. The ticket is no longer on this
   * device."), and focus, if it was on the card, moves on to the next thing on the page. `sg-ticket-forget` bubbles.
   */
  forget({ say = true } = {}) {
    const had = !!this.ticket, inside = this.contains(document.activeElement);
    forgetTicket(this.#store);
    this.ticket = null;
    this.replaceChildren();
    this.hidden = true;
    this.update();
    if (!had) return;
    if (say) announce(strings(BY_LANG, langOf(this)).forgot, { from: this });
    if (inside) landing(this)?.focus({ preventScroll: true });
    this.emit('sg-ticket-forget', {});
  }

  /** The ticket as this page shows it: the event in this page's language when the ticket is this event's by id. */
  #view(t) { return this.eventId && t.eventId === this.eventId && this.event ? { ...t, event: this.event } : t; }

  #render(t0) {
    const t = this.#view(t0), lang = langOf(this), S = strings(BY_LANG, lang), r = Object.fromEntries(rows(t, lang).map(x => [x.key, x]));
    const card = h('section', 'sg-ticket-card');
    const hid = `${this.id}-h`;
    card.setAttribute('aria-labelledby', hid);
    const heading = h('h3', 'sg-ticket-heading', S.heading);
    heading.id = hid; heading.tabIndex = -1;
    const facts = h('dl', 'sg-ticket-facts');
    for (const k of ['name', 'event', 'time']) {
      const row = h('div', `sg-ticket-fact sg-ticket-${k}`);
      const dd = h('dd', null, r[k].value);
      if (k === 'time') { const time = h('time', null, r[k].value); time.dateTime = t.at; dd.replaceChildren(time); }
      row.append(h('dt', null, r[k].label), dd);
      facts.append(row);
    }
    // the code holds the id and nothing else; the words beside it are the id and what to do at the door
    const qr = document.createElement('sg-qr');
    qr.setAttribute('value', t.id);
    qr.setAttribute('label', S.qrAlt(t.id));
    const idRow = h('p', 'sg-ticket-idrow');
    idRow.append(h('span', 'sg-ticket-label', r.id.label), ' ', h('strong', 'sg-ticket-id', t.id));
    qr.append(idRow, h('p', 'sg-ticket-beside', S.qrBeside));
    const stub = h('div', 'sg-ticket-stub');
    stub.append(qr);
    const done = h('p', 'sg-ticket-done', S.done);
    const notes = h('div', 'sg-ticket-notes');
    notes.append(h('p', 'sg-ticket-offline', S.offline));
    const local = h('p', 'sg-ticket-local', S.local);
    if (langOfKey(BY_LANG, lang, 'local') === 'en' && !/^en/i.test(lang)) local.lang = 'en';
    notes.append(local);
    const save = h('button', 'sg-ticket-save', S.save);
    save.type = 'button';
    // the line that removes it: plain words the deck does not have, read in English until Kathakar has written them
    const forget = h('button', 'sg-ticket-forget', S.forget);
    forget.type = 'button';
    if (!/^en/i.test(lang) && langOfKey(BY_LANG, lang, 'forget') === 'en') forget.lang = 'en';
    const actions = h('div', 'sg-ticket-actions');
    actions.append(save, forget);
    const status = h('p', 'sg-ticket-status');
    status.setAttribute('role', 'status');
    const deco = h('div', 'sg-ticket-deco');
    deco.setAttribute('aria-hidden', 'true');
    // one grid: on a wide card the stub spans every row on the right, so the tear runs the card's whole height beside the
    // words and never through them; on a phone the stub follows the facts and the tear runs across the card above it
    card.append(deco, heading, done, facts, stub, notes, actions, status);
    save.addEventListener('click', () => this.#save(save, status, S, lang));
    forget.addEventListener('click', () => this.forget());
    this.replaceChildren(card);
    this.#card = card; this.#status = status; this.#heading = heading;
  }

  async #save(button, status, S, lang) {
    button.disabled = true;
    status.textContent = '';
    try {
      const { savePicture } = await import('./ticket.png.js');
      await savePicture(this.#view(this.ticket), { lang, root: this });
      status.textContent = S.saved;
    } catch {
      // said in place, never blames, and keeps the button
      status.textContent = S.saveFailed;
    } finally { button.disabled = false; }
  }

  /** The decoration box a skin draws into. */
  get deco() { return this.querySelector('.sg-ticket-deco'); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
  }

  state() { return { has: !!this.ticket, seed: this.#seed, id: this.ticket?.id ?? '' }; }
}

defineComponent('sg-ticket', SgTicket);
