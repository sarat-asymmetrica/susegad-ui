// The booking recipe, wired: four steps (dates, guests and room, your details,
// confirm and hold), a live quote from the booking kernels with GST on its own line, a
// phone confirmed by a code, and a hold that is signed and stamped "Held".
// Built from library parts only. The hold and the code are a prototype and
// say so: nothing leaves the page, nothing is held, nothing is charged.

import '../../components/stepper/stepper.js';
import '../../components/date-range/date-range.js';
import '../../components/select/select.js';
import '../../components/combobox/combobox.js';
import '../../components/radio/radio.js';
import '../../components/check/check.js';
import '../../components/field/field.js';
import '../../components/otp/otp.js';
import '../../components/toggle/toggle.js';
import '../../components/signature/signature.js';
import '../../components/form/form.js';
import { RATES } from '../../kernels/booking/rates.js';
import { toAsciiDigits } from '../../components/otp/otp.core.js';
import { quoteView, heldMessage, STRINGS, CODE_STRINGS, codeFor, spaced, codeMatches } from './booking.core.js';

export { STRINGS, CODE_STRINGS };

const h = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

// "16 Nov to 20 Nov, 4 nights · 2 guests": a number never parts from its word ("16 Nov", "4 nights", "2 guests")
const keep = t => t.replace(/(\d) /g, '$1\u00a0');
const stayLine = v => { const p = h('p', 'booking-quote__stay', `${keep(v.stay)} · `); p.append(h('span', 'booking-quote__guests', keep(v.guests))); return p; };

/**
 * Fill the quote card from a view (see booking.core.js). The polite line is written only
 * when its words change, so a total is not read out again at every keystroke. With
 * `reasonsSaid`, a calendar beside the card already reads out why a stay is refused, so the
 * line stays quiet about it and each refusal is heard once.
 */
export function renderQuote(card, v, reasons = [], { reasonsSaid = false } = {}) {
  const body = card.querySelector('.booking-quote__body'), said = card.querySelector('.booking-quote__said');
  const say = (why, text) => { const next = why.length ? (reasonsSaid ? '' : why.join(' ')) : text; if (said.textContent !== next) said.textContent = next; };
  body.replaceChildren();
  if (v.state === 'room') {
    // a single room: the stay, and why there is no figure here
    body.append(stayLine(v), h('p', 'booking-quote__note', v.message));
    if (reasons.length) { const ul = h('ul', 'booking-quote__reasons'); for (const r of reasons) ul.append(h('li', '', r)); body.append(ul); }
    say(reasons, v.message);
    return;
  }
  if (v.state === 'empty' || v.state === 'half') {
    body.append(h('p', 'booking-quote__empty', v.message));
    say([], '');
    return;
  }
  // a refused stay: why first, and the nights only, with no total or deposit to screenshot
  const why = reasons.length ? reasons : v.reasons ?? [];
  if (why.length) {
    const box = h('div', 'booking-quote__refused');
    const ul = h('ul', 'booking-quote__reasons');
    for (const r of why) ul.append(h('li', '', keep(r)));
    box.append(h('p', 'booking-quote__refused-title', STRINGS.refused), ul);
    body.append(box);
  }
  body.append(stayLine(v));
  const dl = h('dl', 'booking-quote__lines');
  const row = (label, amount, cls = '', detail = '') => {
    const r = h('div', `booking-quote__row ${cls}`), dt = h('dt', '', keep(label));
    if (detail) dt.append(h('span', 'booking-quote__detail', ` ${detail}`));
    r.append(dt, h('dd', '', amount));
    dl.append(r);
  };
  for (const l of v.lines) row(l.label, l.amount, '', l.detail);
  if (!why.length) {
    row(v.subtotal.label, v.subtotal.amount, 'is-sub');
    row(v.gst.label, v.gst.amount, 'is-gst');
    row(v.total.label, v.total.amount, 'is-total');
    row(v.deposit.label, v.deposit.amount, 'is-deposit');
  }
  body.append(dl, h('p', 'booking-quote__note', v.gstNote));
  if (v.provisional) body.append(h('p', 'booking-quote__provisional', STRINGS.provisional));
  // one short line is read out, not the whole card
  say(why, `${v.total.label} ${v.total.amount} for ${v.stay}.`);
}

/**
 * The phone check: a "Send a code" button (only when scripts run, so the page
 * without them has no dead control), the code shown on the page because
 * nothing is really sent, and validity that keeps the details step closed
 * until the code typed matches the code sent.
 */
function phoneCheck(root, seed) {
  const phone = root.querySelector('input[name=phone]'), box = root.querySelector('.booking__verify');
  const code = box.querySelector('input[name=code]'), label = box.querySelector('label');
  const send = h('button', 'booking__send', CODE_STRINGS.send);
  send.type = 'button';
  const note = h('p', 'booking__code');
  note.setAttribute('role', 'status');
  box.before(send);
  box.append(note);
  let sent = null, attempt = 0, armed = false;
  // "Send a code to confirm this number." is asked for only once the person tries to go on
  // (Next, or the hold), never on leaving the number for the Send button beside it; and the
  // number's note is told the moment that stops being true, so it goes as the code is sent.
  const check = () => {
    const was = phone.validity.valid;
    phone.setCustomValidity(armed && phone.value && !sent ? CODE_STRINGS.confirmFirst : '');
    code.setCustomValidity(sent && code.value && !codeMatches(code.value, sent) ? CODE_STRINGS.mismatch : '');
    if (!was && phone.validity.valid) phone.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const arm = () => { armed = true; check(); };
  const stepper = root.querySelector('sg-stepper');
  if (stepper) {
    const next = stepper.next.bind(stepper);
    stepper.next = () => { if (stepper.steps[stepper.index]?.contains(phone)) arm(); return next(); };
  }
  root.querySelector('.booking__hold')?.addEventListener('click', arm, true);
  send.addEventListener('click', () => {
    phone.setCustomValidity('');
    if (!phone.value || !phone.checkValidity()) { phone.setCustomValidity(phone.value ? '' : CODE_STRINGS.phoneFirst); phone.reportValidity(); check(); return; }
    sent = codeFor(seed, phone.value, ++attempt);
    box.hidden = false;
    code.required = true;
    code.value = '';
    label.textContent = CODE_STRINGS.label(phone.value);
    note.textContent = CODE_STRINGS.sent(phone.value, spaced(sent));
    send.textContent = CODE_STRINGS.resend;
    check();
    code.focus();
  });
  // a new number needs a new code
  // a number in Devanagari or Kannada numerals is written as ASCII as it is typed (the OTP's map)
  phone.addEventListener('input', () => {
    const a = toAsciiDigits(phone.value);
    if (a !== phone.value) { const at = phone.selectionStart; phone.value = a; phone.setSelectionRange?.(at, at); }
  });
  phone.addEventListener('input', () => {
    if (sent) { sent = null; code.value = ''; code.required = false; box.hidden = true; note.textContent = ''; send.textContent = CODE_STRINGS.send; }
    check();
  });
  code.addEventListener('input', check);
  check();
  return { get sent() { return sent; } };
}

/**
 * Wire a booking form.
 * @param {HTMLElement} root an element holding the form and the quote card
 * @param {{ rates?: object, blocks?: object[], seed?: number }} [o]
 */
export function mountBooking(root, { rates = RATES, blocks, seed = 1 } = {}) {
  const form = root.querySelector('sg-form'), dr = root.querySelector('sg-date-range'), card = root.querySelector('.booking-quote');
  const guests = root.querySelector('select[name=guests]');
  if (blocks) dr.blocks = blocks;
  dr.rates = rates;
  let reasons = [], v = quoteView(null, null);
  const refresh = () => {
    const { arr, dep } = dr.selection;
    const room = root.querySelector('input[name=room]:checked')?.value ?? 'whole';
    v = quoteView(arr, dep, +guests.value || 1, rates, room);
    renderQuote(card, v, reasons, { reasonsSaid: true });
  };
  dr.addEventListener('sg-range', e => { reasons = e.detail.reasons; refresh(); });
  root.addEventListener('change', refresh);
  root.addEventListener('input', refresh);
  const phone = phoneCheck(root, seed);
  // A valid submit is the hold. The prototype holds nothing, so the answer comes at once and says so.
  form.addEventListener('sg-submit', e => {
    e.detail.respondWith(Promise.resolve({ message: heldMessage(v), stamp: STRINGS.held, detail: STRINGS.heldDetail, tone: 'success' }));
  });
  form.addEventListener('reset', () => setTimeout(refresh));
  refresh();
  return { get view() { return v; }, get code() { return phone.sent; } };
}
