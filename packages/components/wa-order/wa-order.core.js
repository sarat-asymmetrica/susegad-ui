// WhatsApp order: the pure core. Runs in Node.
//
// Turns a chosen set of dishes and a few details into a message the seller can
// read on a phone, and into the wa.me link that opens WhatsApp with it already
// written. Nothing here sends anything: the person presses send themselves.

import { formatMoney } from '../menu/menu.core.js';

/** Every string a person reads or hears. Kathakar edits these. */
export const STRINGS = {
  legend: 'Your details',
  date: 'Day you want it',
  slot: 'Time of day',
  anyTime: 'No preference',
  slotsDefault: ['Morning', 'Afternoon', 'Evening'],
  menuLink: 'Back to the menu',
  how: 'How you get it',
  delivery: 'Delivery',
  pickup: 'Pickup',
  area: 'Delivery area',
  areaHint: 'We will ask for your full address in WhatsApp.',
  name: 'Your name',
  dietary: 'Allergies or dietary needs',
  dietaryHint: 'Optional',
  notes: 'Anything else',
  notesHint: 'Optional',
  previewTitle: "This is what we'll send",
  previewHint: 'You send it yourself in WhatsApp, and you can change it there first.',
  previewEmpty: 'Choose something from the menu and your message will appear here.',
  send: 'Send on WhatsApp',
  sendWaiting: 'Send on WhatsApp',
  written: "Your order is written; send it in WhatsApp and we'll confirm.",
  notice: hours => (hours >= 24 && hours % 24 === 0 ? `We need ${hours / 24 === 1 ? 'a day' : `${hours / 24} days`} of notice.` : `We need ${hours} hours of notice.`),
  fallback: 'Order on WhatsApp',
  // the problems, said as the seller would say them
  emptyCart: 'Choose something from the menu first.',
  noDate: 'Pick the day you want it.',
  tooEarly: (earliest, hours) => `${STRINGS.notice(hours)} The earliest day is ${earliest}.`,
  noArea: 'Tell us the area to deliver to.',
  noName: 'Add your name so we know who to reply to.',
  badNumber: 'This order form has no WhatsApp number it can use.',
  tooLong: 'This is a long order for one message. Send the first half now and the rest in a second message.',
};

// ── the number ──────────────────────────────────────────────────────────────

/**
 * A phone number as people write it → the digits wa.me wants (country code
 * first, no plus, no zeros in front). Handles "98765 43210", "098765 43210",
 * "+91 98765-43210", "0091 (98765) 43210", "91 98765 43210". A 10-digit Indian
 * mobile gets 91; a number with a plus is taken as it is. Returns
 * { ok, digits, reason }.
 */
export function normalizeNumber(input) {
  const raw = String(input ?? '');
  const plus = /^\s*\+/.test(raw);
  let d = raw.replace(/\D+/g, '');
  const fail = reason => ({ ok: false, digits: '', reason });
  if (!d) return fail('empty');
  if (!plus && d.startsWith('00')) d = d.slice(2); // 0091…: the international prefix
  else if (!plus) {
    if (d.length === 11 && d[0] === '0') d = d.slice(1); // 098765 43210: the trunk zero
    if (d.length === 10) {
      if (!/^[6-9]/.test(d)) return fail('not-mobile');
      d = `91${d}`;
    }
  }
  if (d.startsWith('910') && d.length === 13) d = `91${d.slice(3)}`; // +91 098765 43210
  if (d.startsWith('0') || d.length < 8 || d.length > 15) return fail('length');
  return { ok: true, digits: d, reason: '' };
}

/** Make a string safe for encodeURIComponent: a lone half of an emoji would throw. */
export const wellFormed = s => (typeof s.toWellFormed === 'function' ? s.toWellFormed() : s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�'));

/**
 * https://wa.me/<digits>?text=<encoded>. Throws on a number it cannot use,
 * so a wrong number in a page's source fails loudly, not by messaging a stranger.
 * @param {string} number "+91 98765 43210", "98765-43210", "919876543210"
 * @param {string} [text]
 */
export function waLink(number, text = '') {
  const n = normalizeNumber(number);
  if (!n.ok) throw new Error(`waLink: "${number}" is not a number WhatsApp can open (${n.reason}). Give 10 digits, or the country code and the number.`);
  return linkFor(n.digits, text);
}
const linkFor = (digits, text) => `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(wellFormed(String(text)))}` : ''}`;

/** Read a wa.me link back: { digits, text }, or null. Uses the URL parser, not the encoder, so a test of one cannot pass by agreeing with itself. */
export function readWaLink(href) {
  try {
    const u = new URL(href);
    if (u.origin !== 'https://wa.me' || !/^\/\d{8,15}$/.test(u.pathname)) return null;
    return { digits: u.pathname.slice(1), text: u.searchParams.get('text') ?? '' };
  } catch { return null; }
}

// ── dates ───────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-11" → "Sun 11 Oct 2026"; anything that is not a real date → "". */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return '';
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return '';
  return `${DAYS[t.getUTCDay()]} ${d} ${MONTHS[mo - 1]} ${y}`;
}

const pad = n => String(n).padStart(2, '0');
/** The earliest day (YYYY-MM-DD, in the device's own time) an order can be wanted for: now plus the notice. */
export function earliestDate(now = new Date(), minNoticeHours = 0) {
  const t = new Date(+now + Math.max(0, Number(minNoticeHours) || 0) * 3600_000);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

// ── the message ─────────────────────────────────────────────────────────────

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029\uFEFF]/g;
/** Cut to n characters (whole code points, so an emoji is never split). */
export const clip = (s, n) => { const a = Array.from(s); return a.length > n ? `${a.slice(0, n).join('').trimEnd()}...` : s; };
const one = (v, n = 120) => clip(wellFormed(String(v ?? '')).replace(CTRL, ' ').replace(/\s+/g, ' ').trim(), n);
const many = (v, n = 600) => clip(wellFormed(String(v ?? '')).replace(CTRL, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(), n);
// the business's own names go into WhatsApp as typed, but its formatting marks would bold or strike them
const plain = v => one(v).replace(/[*_~`]/g, '');

const lineText = (l, level, currency) => {
  const name = plain(l.name), unit = plain(l.unit);
  const tags = (l.tags ?? []).map(t => plain(t).toLowerCase()).filter(Boolean);
  const detail = [level < 2 ? unit : '', tags.join(', ')].filter(Boolean).join(', ');
  const price = level < 1 && Number.isFinite(l.unitPrice) ? `: ${formatMoney(l.qty * l.unitPrice, currency)}` : '';
  return `${l.qty} × ${name}${detail ? ` (${detail})` : ''}${price}`;
};

/** The dishes that count: whole quantities of at least one. */
const usable = lines => (lines ?? []).filter(l => l && Number.isFinite(l.qty) && Math.floor(l.qty) >= 1 && String(l.name ?? '').trim()).map(l => ({ ...l, qty: Math.floor(l.qty) }));

/** The estimated total of a set of lines, in rupees (added in paise). */
export const estimate = lines => usable(lines).reduce((p, l) => p + l.qty * Math.round((Number.isFinite(l.unitPrice) ? l.unitPrice : 0) * 100), 0) / 100;

/**
 * The message, plain text a seller reads on a phone: a greeting, a line for each
 * dish (quantity × name, its unit, any tags like egg-less, and its price), the
 * total marked as an estimate, then the day and time, delivery or pickup, name,
 * dietary needs and notes. No markdown: nothing a WhatsApp would turn bold,
 * struck through or into a list. With no dishes it is the empty string.
 *
 * `level` shortens it for a very long order: 1 drops each dish's price and the
 * thank-you; 2 also drops units. Tags (egg-less, nuts) stay at every level.
 *
 * @param {{ business?: string, lines: Array<{name: string, qty: number, unit?: string, unitPrice?: number, tags?: string[]}>,
 *   date?: string, slot?: string, fulfilment?: 'delivery'|'pickup', area?: string, name?: string, notes?: string,
 *   dietary?: string, currency?: string }} order
 * @param {{ level?: 0|1|2 }} [opts]
 */
export function composeOrder(order = {}, { level = 0 } = {}) {
  const lines = usable(order.lines);
  if (!lines.length) return '';
  const cur = order.currency || '₹';
  const business = plain(order.business);
  const out = [`Hello${business ? ` ${business}` : ''}! I would like to order:`, ''];
  for (const l of lines) out.push(lineText(l, level, cur));
  out.push('', level < 1 ? `Estimated total: ${formatMoney(estimate(lines), cur)}. Please confirm the total and any delivery charge.` : `Estimated total: ${formatMoney(estimate(lines), cur)} (to confirm)`);
  const details = [];
  const when = [formatDate(order.date), one(order.slot, 60)].filter(Boolean).join(', ');
  if (when) details.push(`When: ${when}`);
  if (order.fulfilment === 'pickup') details.push('Pickup: I will collect it');
  else if (order.fulfilment === 'delivery') details.push(one(order.area, 80) ? `Delivery to: ${one(order.area, 80)}` : 'Delivery (address to follow)');
  if (one(order.name, 60)) details.push(`Name: ${one(order.name, 60)}`);
  if (one(order.dietary, 200)) details.push(`Dietary: ${one(order.dietary, 200)}`);
  const notes = many(order.notes, level < 2 ? 600 : 140);
  if (notes) details.push(`Notes: ${notes}`);
  if (details.length) out.push('', ...details);
  if (level < 1) out.push('', 'Thank you!');
  return out.join('\n');
}

// ── checking it ─────────────────────────────────────────────────────────────

/**
 * What is still missing before the order can go, as [{ field, message }] in
 * the order the form asks for it. A date earlier than now plus the notice is a
 * problem and says when the earliest day is.
 */
export function validateOrder(order = {}, { now = new Date(), minNoticeHours = 0 } = {}) {
  const p = [];
  if (!usable(order.lines).length) p.push({ field: 'lines', message: STRINGS.emptyCart });
  const date = String(order.date ?? '');
  const earliest = earliestDate(now, minNoticeHours);
  if (!formatDate(date)) p.push({ field: 'date', message: STRINGS.noDate });
  else if (date < earliest) p.push({ field: 'date', message: STRINGS.tooEarly(formatDate(earliest), minNoticeHours) });
  if (order.fulfilment === 'delivery' && !one(order.area)) p.push({ field: 'area', message: STRINGS.noArea });
  if (!one(order.name)) p.push({ field: 'name', message: STRINGS.noName });
  return p;
}

/** Longest address we are willing to hand a browser. A conservative guess: servers in the chain refuse far less than a megabyte, and often at 8 KB. */
export const MAX_HREF = 4000;

/**
 * Everything the page needs in one call: the message (for the preview), the
 * link (only when the order can go), what is missing, and why there is no link.
 * A long order is shortened a level at a time until its link fits; if even
 * the shortest does not, there is no link and the reason says so.
 *
 * @returns {{ ok: boolean, text: string, href: string|null, problems: Array<{field: string, message: string}>, reason: string, level: number }}
 */
export function prepareOrder(order = {}, { number, now = new Date(), minNoticeHours = 0, maxHref = MAX_HREF } = {}) {
  const problems = validateOrder(order, { now, minNoticeHours });
  const empty = { ok: false, text: '', href: null, problems, reason: STRINGS.emptyCart, level: 0 };
  if (!usable(order.lines).length) return empty;
  const num = normalizeNumber(number);
  let text = composeOrder(order), level = 0;
  if (!num.ok) return { ok: false, text, href: null, problems, reason: STRINGS.badNumber, level };
  let href = linkFor(num.digits, text);
  while (href.length > maxHref && level < 2) { level++; text = composeOrder(order, { level }); href = linkFor(num.digits, text); }
  if (href.length > maxHref) return { ok: false, text, href: null, problems, reason: STRINGS.tooLong, level };
  if (problems.length) return { ok: false, text, href: null, problems, reason: problems[0].message, level };
  return { ok: true, text, href, problems: [], reason: '', level };
}

/**
 * The line that says the message is written, stamping in once (playful only; every
 * other register and reduced motion get null). A short drop from a little large and
 * a little tilted, settling flat. One iteration.
 */
export function stampIn(motion) {
  if (motion !== 'full') return null;
  return {
    keyframes: [
      { transform: 'scale(1.22) rotate(-3deg)', opacity: 0, offset: 0 },
      { transform: 'scale(0.97) rotate(0.6deg)', opacity: 1, offset: 0.65 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 1 },
    ],
    options: { duration: 320, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'none' },
  };
}
