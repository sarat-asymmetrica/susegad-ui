// The booking quote as words and figures, pure. Every number comes from the
// booking kernels' quote(); this only groups the nights and says what the
// figures are, including which ones are not settled yet.

import { RATES } from '../../kernels/booking/rates.js';
import { quote, rupees } from '../../kernels/booking/pricing.js';
import { shortDate, diffDays } from '../../kernels/booking/dates.js';
import { digitsOf } from '../../components/otp/otp.core.js';

/** Every word the quote and the hold use. Kathakar edits these. */
export const STRINGS = {
  empty: 'Pick your dates to see the price.',
  half: d => `Arriving ${d}. Pick your departure to see the price.`,
  stay: (a, d, n) => `${a} to ${d}, ${n} ${n === 1 ? 'night' : 'nights'}`,
  guests: n => `${n} ${n === 1 ? 'guest' : 'guests'}`,
  weeknight: n => (n === 1 ? 'weeknight' : 'weeknights'),
  weekend: n => (n === 1 ? 'Friday or Saturday night' : 'Friday and Saturday nights'),
  times: (n, rate) => `${n} × ${rupees(rate)}`,
  subtotal: 'Rooms',
  gst: rate => `GST at ${Math.round(rate * 100)}%`,
  noGst: 'GST',
  noGstWhy: 'none below ₹7,500 a night',
  total: 'Total',
  deposit: 'Refundable deposit',
  gstExclusive: 'Rates exclude GST, which is shown on its own line.',
  gstInclusive: 'Rates include GST; its share is shown on its own line.',
  provisional: 'These rates and the deposit are provisional: the house may change them before bookings open.',
  prototype: 'This is a prototype. Holding dates here holds nothing and charges nothing.',
  held: 'Held',
  // the stamp's second line, as the enquiry's NOT SENT carries PROTOTYPE; a real hold deletes it
  heldDetail: 'Prototype',
  heldMessage: (stay, guests, room) => `${stay}, ${guests}, ${room}. Prototype: nothing is held and nothing is charged.`,
  refused: 'Not bookable as chosen',
  noScriptPrice: 'The house will send the price when they write back.',
  minimumStays: 'Stays are at least 3 nights, and 4 over Christmas week.',
  roomOnly: room => `The rate card prices the whole house. The house will confirm the price for ${room} when they write back.`,
  breakfast: 'Breakfast is arranged with the house and is not in this price.',
  noScript: 'Without JavaScript this form sends your dates and details to a page that keeps nothing; the price and the hold need JavaScript.',
};

/**
 * The rooms, as the house names them. Only the whole house is on the rate card.
 * UNVERIFIED: the room names and where each room is are on the owner's list to
 * confirm. The labels say no more than the Portuguese words themselves (sotão,
 * the space under the roof; balcão, the front porch; quintal, the back yard).
 */
export const ROOMS = {
  whole: { name: 'the whole house', label: 'The whole house' },
  sotao: { name: 'the Sotão', label: 'Sotão, under the roof' },
  balcao: { name: 'the Balcão', label: 'Balcão, at the front of the house' },
  quintal: { name: 'the Quintal', label: 'Quintal, at the back of the house' },
};

/**
 * The quote for a stay, ready to show: grouped lines, GST on its own line,
 * the total, the deposit, and whether any of it is provisional.
 * @param {string|null} arrival @param {string|null} departure @param {number} guests @param {object} [rates]
 */
export function quoteView(arrival, departure, guests = 2, rates = RATES, room = 'whole') {
  if (!arrival) return { state: 'empty', message: STRINGS.empty };
  if (!departure) return { state: 'half', message: STRINGS.half(shortDate(arrival)) };
  const r = ROOMS[room] ?? ROOMS.whole;
  if (r !== ROOMS.whole) {
    // no figure the card does not have: a single room is priced by the house, not here
    const q = quote(arrival, departure, rates);
    return { state: 'room', ok: q.ok, reasons: q.reasons, stay: STRINGS.stay(shortDate(arrival), shortDate(departure), diffDays(arrival, departure)), guests: STRINGS.guests(guests), room: r.name, message: STRINGS.roomOnly(r.name) };
  }
  const q = quote(arrival, departure, rates);
  const groups = new Map();
  for (const n of q.nights) {
    const key = `${n.band}|${n.weekend}|${n.rate}`;
    const g = groups.get(key) ?? { label: n.label, weekend: n.weekend, rate: n.rate, count: 0, provisional: n.provisional };
    g.count++;
    groups.set(key, g);
  }
  const lines = [...groups.values()].map(g => ({
    label: `${g.label}, ${g.count} ${g.weekend ? STRINGS.weekend(g.count) : STRINGS.weeknight(g.count)}`,
    detail: STRINGS.times(g.count, g.rate),
    amount: rupees(g.count * g.rate),
    provisional: g.provisional,
  }));
  const n = diffDays(arrival, departure);
  return {
    state: q.ok ? 'ok' : 'refused',
    ok: q.ok,
    reasons: q.reasons,
    stay: STRINGS.stay(shortDate(arrival), shortDate(departure), n),
    guests: STRINGS.guests(guests),
    room: r.name,
    lines,
    subtotal: { label: STRINGS.subtotal, amount: rupees(q.subtotal) },
    gst: q.gst ? { label: STRINGS.gst(q.gstRate), amount: rupees(q.gst) } : { label: STRINGS.noGst, amount: STRINGS.noGstWhy },
    total: { label: STRINGS.total, amount: rupees(q.total), value: q.total },
    deposit: { label: STRINGS.deposit, amount: rupees(q.deposit), provisional: !!rates.deposit.provisional },
    gstNote: q.gstMode === 'inclusive' ? STRINGS.gstInclusive : STRINGS.gstExclusive,
    provisional: q.provisional || !!rates.deposit.provisional,
  };
}

/** The Held stamp's words for a stay. */
export const heldMessage = (v) => STRINGS.heldMessage(v.stay, v.guests, v.room ?? ROOMS.whole.name);

// ── the phone code (the demo's OTP) ──────────────────────────────────────

/** Words for the phone check. Kathakar edits these. */
export const CODE_STRINGS = {
  send: 'Send a code',
  resend: 'Send a new code',
  label: phone => `Enter the 6-digit code we sent to ${phone}`,
  sent: (phone, code) => `Prototype: nothing leaves this page. The code we would have texted to ${phone} is ${code}.`,
  mismatch: 'That code does not match the one we sent. Check it and try again.',
  phoneFirst: 'Add your phone number first, then we can send a code.',
  confirmFirst: 'Send a code to confirm this number.',
  verified: 'Your number is confirmed.',
  noScript: 'Without JavaScript we confirm your number when we write back.',
};

/** The six-digit code "sent" to a phone, seeded so a demo and its tests agree. */
export function codeFor(seed, phone, attempt = 1) {
  let h = 2166136261;
  for (const ch of `${seed}|${phone.replace(/\D/g, '')}|${attempt}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return String(h % 1000000).padStart(6, '0');
}

/** '482913' as people read it aloud: '482 913'. */
export const spaced = code => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Digits typed in any script (Devanagari, Kannada, full width…), as ASCII: the OTP's own map. */
export const asciiDigits = text => digitsOf(text);

/** Does what was typed match the code that was sent? */
export const codeMatches = (typed, sent) => !!sent && asciiDigits(typed) === sent;
