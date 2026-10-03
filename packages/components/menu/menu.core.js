// Menu: the pure core. Runs in Node.
//
// A menu is sections of dishes. Everything a person reads (the rupee
// formatting, the tag words, the sentences the totals say) is made here, so a
// build step can write the same semantic list into static HTML and a test can
// check it without a browser.

/** Every string a person reads or hears. Kathakar edits these. */
export const STRINGS = {
  empty: 'Nothing added yet.',
  total: (count, money) => `${count === 1 ? '1 item' : `${count} items`}, ${money}`,
  added: (name, qty) => `${name}: ${qty} in your order.`,
  removed: name => `${name} taken out of your order.`,
  atMost: (name, max) => `${name}: ${max} is the most we can take in one order.`,
  cleared: 'Your order is empty again.',
  clear: 'Start again',
  continueLabel: 'Write your order',
  group: name => `${name}, quantity`,
  add: name => `Add one ${name}`,
  remove: name => `Remove one ${name}`,
  soldOut: 'Sold out',
  ask: 'Ask first',
  noPrice: 'Ask for the price',
};

export const MAX_QTY = 99;

// ── money ───────────────────────────────────────────────────────────────────

const INDIAN = new Set(['₹', 'rs', 'rs.', 'inr']);

/** "1234567" → "12,34,567": the last three digits, then pairs. */
export const groupIndian = digits => {
  const s = String(digits);
  if (s.length <= 3) return s;
  return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
};
/** "1234567" → "1,234,567": for a currency that is not the rupee. */
export const groupWestern = digits => String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Money for people. The rupee (₹, Rs, INR) groups the Indian way, ₹1,23,450;
 * anything else groups in thousands. Whole amounts have no decimals; others
 * have two. A symbol sits against the number, a word gets a space.
 * @param {number} n
 * @param {string} [currency]
 */
export function formatMoney(n, currency = '₹') {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const minor = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(minor / 100), cents = minor % 100;
  const group = INDIAN.has(String(currency).trim().toLowerCase()) ? groupIndian : groupWestern;
  const num = `${group(whole)}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
  const sign = n < 0 && minor ? '-' : '';
  const cur = String(currency);
  return `${sign}${/^[A-Za-z]/.test(cur) ? `${cur} ` : cur}${num}`;
}

/**
 * A price as someone wrote it → a number, or null. "₹450", "450", "Rs. 1,23,450",
 * "₹ 99.50" all parse; "ask", "", "free-ish" and negatives do not.
 */
export function parsePrice(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const s = String(v ?? '').replace(/[₹\s,]|^rs\.?|^inr/gi, '');
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : null;
}

// ── tags and availability ───────────────────────────────────────────────────

/** The tags a food business uses most, by the key a glyph and a style hang on. */
export const TAGS = {
  'egg-less': 'Egg-less',
  veg: 'Veg',
  vegan: 'Vegan',
  nuts: 'Contains nuts',
  spicy: 'Spicy',
};
const ALIASES = {
  eggless: 'egg-less', 'egg-free': 'egg-less', eggfree: 'egg-less', 'no-egg': 'egg-less', 'without-egg': 'egg-less',
  vegetarian: 'veg',
  'contains-nuts': 'nuts', nut: 'nuts', 'has-nuts': 'nuts',
  hot: 'spicy',
};
const slug = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * One tag as written → { key, label }. Known tags get their one label, so
 * "eggless", "Egg-free" and "egg-less" are the same tag; an unknown tag keeps
 * the words it was given, as text.
 */
export function normalizeTag(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  const k = slug(text), key = ALIASES[k] ?? k;
  if (!key) return null;
  return TAGS[key] ? { key, label: TAGS[key] } : { key, label: text };
}

/** A list or a comma-separated string of tags → [{ key, label }], no repeats. */
export function parseTags(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(',');
  const seen = new Set(), out = [];
  for (const t of list) {
    const tag = normalizeTag(t);
    if (tag && !seen.has(tag.key)) { seen.add(tag.key); out.push(tag); }
  }
  return out;
}

/** "sold out", "Sold-Out", "soldout" → 'sold-out'; "ask" → 'ask'; anything else → 'available'. */
export function normalizeAvailability(v) {
  const s = slug(v).replace(/-/g, '');
  if (s === 'soldout' || s === 'out' || s === 'unavailable') return 'sold-out';
  if (s === 'ask' || s === 'askfirst' || s === 'onrequest') return 'ask';
  return 'available';
}

// ── the menu ────────────────────────────────────────────────────────────────

const text = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Whatever a page or a script hands over → a clean menu.
 * Accepts sections ([{ title, note, items }]), { sections }, or a flat list of
 * dishes (one untitled section). A dish is { name, line?, price?, unit?, tags?,
 * availability?, id? }. A dish with no name is dropped. Ids are the name's slug
 * unless given, and never repeat (a second "pasta" becomes "pasta-2").
 * Returns { sections, items } where items is every dish in order.
 */
export function normalizeMenu(raw) {
  let sections = Array.isArray(raw) ? raw : raw?.sections ?? [];
  if (sections.length && !sections.some(s => Array.isArray(s?.items))) sections = [{ items: sections }];
  const used = new Set(), items = [];
  const uniq = base => {
    let id = base || 'dish', n = 1;
    while (used.has(id)) id = `${base || 'dish'}-${++n}`;
    used.add(id);
    return id;
  };
  const out = sections.map((s, i) => ({
    id: slug(s.id ?? s.title) || `section-${i + 1}`,
    title: text(s.title),
    note: text(s.note),
    items: (s.items ?? []).filter(d => text(d?.name)).map(d => {
      const price = parsePrice(d.price);
      const availability = normalizeAvailability(d.availability);
      const item = {
        id: uniq(slug(d.id) || slug(d.name)),
        name: text(d.name),
        line: text(d.line),
        price,
        unit: text(d.unit),
        tags: parseTags(d.tags),
        availability,
        orderable: availability === 'available' && price !== null,
      };
      items.push(item);
      return item;
    }),
  }));
  return { sections: out, items };
}

// ── the order ───────────────────────────────────────────────────────────────

/** A quantity a person can ask for: a whole number from 0 to `max`. */
export const clampQty = (q, max = MAX_QTY) => {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

/**
 * The order so far: { lines, total, count }. `qtys` maps a dish id to how many.
 * Lines follow the menu's order, never the order they were added in; a dish
 * that cannot be ordered (sold out, ask first, no price) is never in them, even
 * if a quantity was handed in. The total is added in paise so it never drifts.
 */
export function summarize(menu, qtys = {}, max = MAX_QTY) {
  const get = id => (qtys instanceof Map ? qtys.get(id) : qtys[id]);
  const lines = [];
  let paise = 0, count = 0;
  for (const it of menu.items) {
    const qty = clampQty(get(it.id), max);
    if (!qty || !it.orderable) continue;
    lines.push({ id: it.id, name: it.name, unit: it.unit, qty, unitPrice: it.price, tags: it.tags.map(t => t.label) });
    paise += qty * Math.round(it.price * 100);
    count += qty;
  }
  return { lines, total: paise / 100, count };
}

/** The sentence the total line says: "3 items, ₹1,350", or that nothing is added. */
export const totalLine = (summary, currency = '₹') => (summary.count ? STRINGS.total(summary.count, formatMoney(summary.total, currency)) : STRINGS.empty);

/**
 * The first half of what is said when someone presses + or -: which dish and
 * how many are in the order now. The live region reads it with the total line
 * beside it ("Tea: 2 in your order. 2 items, ₹80"). Pressing + at the limit
 * says so; a press that changes nothing says nothing.
 */
export function announce({ name, now, was, max = MAX_QTY }) {
  if (now === was) return was >= max ? STRINGS.atMost(name, max) : '';
  return now === 0 ? STRINGS.removed(name) : STRINGS.added(name, now);
}

/**
 * The count's small settle when a dish is added (playful only; every other
 * register and reduced motion get null, so nothing moves). One shot: it lifts
 * a little and lands, with one slight overshoot. Removing is a quieter settle
 * the other way. Returns { keyframes, options } for Element.animate().
 */
export function settleMotion(motion, direction = 1) {
  if (motion !== 'full') return null;
  const up = direction >= 0;
  return {
    keyframes: up
      ? [{ transform: 'translateY(-38%) scale(1.28)', offset: 0 }, { transform: 'translateY(8%) scale(0.95)', offset: 0.6 }, { transform: 'translateY(0) scale(1)', offset: 1 }]
      : [{ transform: 'translateY(30%) scale(0.88)', offset: 0 }, { transform: 'translateY(0) scale(1)', offset: 1 }],
    options: { duration: up ? 420 : 240, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'none' },
  };
}

// ── markup ──────────────────────────────────────────────────────────────────

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The semantic list a server (or a build step) writes, and the element reads:
 * sections, each a heading and a list of dishes, each dish its name, price,
 * unit, line, tags and status as text. It reads fine with no script and no CSS.
 * Pass a normalized menu or anything normalizeMenu takes.
 */
export function menuHTML(menuOrRaw, { currency = '₹', headingLevel = 3 } = {}) {
  const menu = Array.isArray(menuOrRaw?.items) && Array.isArray(menuOrRaw?.sections) ? menuOrRaw : normalizeMenu(menuOrRaw);
  const h = `h${Math.min(Math.max(headingLevel | 0, 1), 6)}`;
  const dish = d => {
    const status = d.availability === 'sold-out' ? STRINGS.soldOut : d.availability === 'ask' ? STRINGS.ask : d.price === null ? STRINGS.noPrice : '';
    const tags = d.tags.map(t => `<li class="sg-menu-tag" data-tag="${esc(t.key)}">${esc(t.label)}</li>`).join('');
    return `<li class="sg-menu-item" data-id="${esc(d.id)}" data-availability="${d.availability}">`
      + `<span class="sg-menu-name">${esc(d.name)}</span>`
      + (d.price !== null ? `<span class="sg-menu-price"><data value="${d.price}">${esc(formatMoney(d.price, currency))}</data>${d.unit ? ` <span class="sg-menu-unit">${esc(d.unit)}</span>` : ''}</span>` : d.unit ? `<span class="sg-menu-price"><span class="sg-menu-unit">${esc(d.unit)}</span></span>` : '')
      + (d.line ? `<span class="sg-menu-line">${esc(d.line)}</span>` : '')
      + (tags || status ? `<div class="sg-menu-meta">${tags ? `<ul class="sg-menu-tags">${tags}</ul>` : ''}${status ? `<span class="sg-menu-status">${esc(status)}</span>` : ''}</div>` : '')
      + '</li>';
  };
  return menu.sections.map(s => `<section class="sg-menu-section">`
    + (s.title ? `<${h} class="sg-menu-section-title">${esc(s.title)}</${h}>` : '')
    + (s.note ? `<p class="sg-menu-section-note">${esc(s.note)}</p>` : '')
    + `<ul class="sg-menu-items">${s.items.map(dish).join('')}</ul></section>`).join('');
}
