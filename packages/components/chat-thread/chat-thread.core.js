// Chat thread: the pure core. Runs in Node.
//
// A conversation shown as text rather than a screenshot. Three jobs live here:
// redaction, which must happen before any HTML exists (so a build step such as
// Astro's frontmatter calls it, never the browser); the thread's markup, for
// that same build step; and the geometry of the warm skin's hand-inked bubble.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

export const STRINGS = {
  label: 'Conversation',
  replyingTo: 'Replying to:',
  reacted: name => `Reacted with ${name}`,
  reactions: { '❤️': 'a heart', '❤': 'a heart', '👍': 'a thumbs up', '😂': 'laughter', '🙏': 'folded hands', '😮': 'surprise', '😢': 'a tear', '🎉': 'a party popper', '🔥': 'fire' },
  anEmoji: 'an emoji',
  redacted: { phone: 'number removed', name: 'name removed', email: 'email removed', other: 'removed' },
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// A phone number: a leading + and 8 to 15 digits, or 10 to 15 digits without
// one, with single spaces or hyphens between. Ten digits keeps a date
// (2026-09-27, eight digits) and a time out of it.
const PHONE = /(?:\+\d(?:[ -]?\d){7,14})|(?:\b\d(?:[ -]?\d){9,14}\b)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Split text into kept and redacted runs. Redacted runs keep only their kind:
 * the original characters are dropped here, so nothing downstream can leak them.
 * @param {string} text
 * @param {{ phones?: boolean, emails?: boolean, names?: string[], labels?: Record<string,string> }} [opts]
 * @returns {({ text: string } | { redacted: string, label: string })[]}
 */
export function redact(text, { phones = true, emails = true, names = [], labels = STRINGS.redacted } = {}) {
  const hits = [];
  const find = (re, kind) => { for (const m of text.matchAll(re)) hits.push({ at: m.index, end: m.index + m[0].length, kind }); };
  if (emails) find(new RegExp(EMAIL.source, 'g'), 'email');
  if (phones) find(new RegExp(PHONE.source, 'g'), 'phone');
  const list = names.filter(n => n && n.trim()).sort((a, b) => b.length - a.length);
  if (list.length) find(new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escRe).join('|')})(?![\\p{L}\\p{N}])`, 'giu'), 'name');
  hits.sort((a, b) => a.at - b.at || b.end - a.end);
  const out = [];
  let i = 0;
  for (const h of hits) {
    if (h.at < i) continue; // overlaps an earlier hit
    if (h.at > i) out.push({ text: text.slice(i, h.at) });
    out.push({ redacted: h.kind, label: labels[h.kind] ?? labels.other ?? STRINGS.redacted.other });
    i = h.end;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

export const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Redacted text as HTML: kept runs escaped, redacted runs as a marked span holding only its label. */
export function redactHtml(text, opts) {
  return redact(text, opts).map(r => ('text' in r ? escapeHtml(r.text) : `<span class="sg-redacted" data-kind="${r.redacted}">${escapeHtml(r.label)}</span>`)).join('');
}

/** "2026-03-04T10:12" (or a Date) to "10:12", read from the wall-clock digits, never shifted by a time zone. */
export function clockOf(iso) {
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** "2026-03-04" to "4 March 2026". */
export function dayOf(iso, months = STRINGS.months) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${months[+m[2] - 1]} ${m[1]}` : '';
}

/** The words for a reaction, read once in place of the emoji: "Reacted with a heart". */
export const reactionLabel = emoji => STRINGS.reacted(STRINGS.reactions[String(emoji ?? '').trim()] ?? STRINGS.anEmoji);

/**
 * Which messages continue the one before: same side and sender, no day
 * divider between. The skins hide a repeated name visually (never from
 * assistive technology) and draw a bubble's tail only on the first of a run.
 * @param {({ day: string } | { from: string, who?: string })[]} items
 * @returns {boolean[]}
 */
export function runs(items) {
  let prev = null;
  return items.map(it => {
    if (!it || 'day' in it) { prev = null; return false; }
    const key = `${it.from}|${it.who ?? ''}`;
    const cont = key === prev;
    prev = key;
    return cont;
  });
}

/**
 * The thread's markup, for a build step: redaction happens here, before any
 * HTML exists. Messages are { from: 'me'|'them', who, text, time, status?,
 * reply?: { who, text }, reaction?: '❤️' }; a { day } item is a date divider.
 * @param {object[]} items
 * @param {{ label?: string, redact?: object, register?: string }} [opts]
 */
export function renderThread(items, { label = STRINGS.label, redact: ro = {}, register } = {}) {
  const cont = runs(items);
  const lis = items.map((it, i) => {
    if ('day' in it) return `  <li class="sg-chat-day"><time datetime="${escapeHtml(it.day)}">${escapeHtml(dayOf(it.day))}</time></li>`;
    const attrs = [`data-from="${it.from === 'me' ? 'me' : 'them'}"`];
    if (it.status) attrs.push(`data-status="${escapeHtml(it.status)}"`);
    if (cont[i]) attrs.push('data-run="continue"');
    const who = it.who ? `<span class="sg-chat-who">${redactHtml(it.who, ro)}</span> ` : '';
    const time = it.time ? ` <time class="sg-chat-time" datetime="${escapeHtml(it.time)}">${clockOf(it.time)}</time>` : '';
    const reply = it.reply ? `<blockquote class="sg-chat-reply"><span class="sg-chat-sr">${escapeHtml(STRINGS.replyingTo)} </span>${it.reply.who ? `<span class="sg-chat-reply-who">${redactHtml(it.reply.who, ro)}</span> ` : ''}<span class="sg-chat-reply-text">${redactHtml(it.reply.text, ro)}</span></blockquote>` : '';
    const reaction = it.reaction ? ` <span class="sg-chat-reaction" role="img" aria-label="${escapeHtml(reactionLabel(it.reaction))}"><span aria-hidden="true">${escapeHtml(it.reaction)}</span></span>` : '';
    return `  <li ${attrs.join(' ')}>${who}${reply}<p class="sg-chat-text">${redactHtml(it.text, ro)}</p>${time}${reaction}</li>`;
  });
  const reg = register ? ` register="${escapeHtml(register)}"` : '';
  return `<sg-chat-thread${reg}>\n<ol aria-label="${escapeHtml(label)}">\n${lis.join('\n')}\n</ol>\n</sg-chat-thread>`;
}

/**
 * A redaction marker should hold only its label. Digits, an @ or a long run of
 * words mean the original text is still there. Returns the reason, or ''.
 * @param {string} text
 */
export function leakIn(text) {
  const t = text.trim();
  if (/\d/.test(t)) return 'it holds digits';
  if (t.includes('@')) return 'it holds an @';
  if (t.split(/\s+/).length > 4) return 'it holds more than a short label';
  return '';
}

/**
 * The warm skin's hand-inked bubble: a rounded rectangle with a small tail on
 * the top corner of the speaker's side, resampled and nudged along its normal
 * by seeded noise, drawn twice like a nib going round, closed with an overlap.
 * @param {number} w
 * @param {number} h
 * @param {string|number} seed
 * @param {{ side?: 'left'|'right', tail?: boolean, radius?: number, wobble?: number, inset?: number }} [opts]
 * @returns {{ d: string[], points: number[][][] }}
 */
export function bubbleOutline(w, h, seed, { side = 'left', tail = true, radius = 12, wobble = 0.8, inset = 1.5 } = {}) {
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const ideal = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); ideal.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const edge = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
    for (let i = 1; i < n; i++) ideal.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  const t = Math.min(10, (y1 - y0) / 3); // the tail's size
  const tl = tail && side === 'left', tr = tail && side !== 'left';
  // clockwise from the top edge; the tail replaces the top corner on the speaker's side
  const sx = tl ? x0 - t * 0.9 : x0 + r, ex = tr ? x1 + t * 0.9 : x1 - r;
  ideal.push([sx, y0]);
  edge(sx, y0, ex, y0);
  if (tr) { ideal.push([ex, y0]); edge(ex, y0, x1, y0 + t); ideal.push([x1, y0 + t]); edge(x1, y0 + t, x1, y1 - r); }
  else { arc(x1 - r, y0 + r, -Math.PI / 2); edge(x1, y0 + r, x1, y1 - r); }
  arc(x1 - r, y1 - r, 0); edge(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, Math.PI / 2);
  if (tl) { edge(x0, y1 - r, x0, y0 + t); ideal.push([x0, y0 + t]); edge(x0, y0 + t, sx, y0); }
  else { edge(x0, y1 - r, x0, y0 + r); arc(x0 + r, y0 + r, Math.PI); }
  const cx = w / 2, cy = h / 2;
  const passes = [];
  for (let pass = 0; pass < 2; pass++) {
    const noise = makeNoise(`chat-ink:${seed}:${pass}`);
    const R = rng(`chat-ink:${seed}:${pass}`);
    const amp = wobble * (pass ? 0.7 : 1);
    const pts = ideal.map(([x, y], i) => {
      const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
      const k = noise(i * 0.16, pass * 7.3) * amp + (pass ? 0.35 : 0);
      return [x + (dx / len) * k, y + (dy / len) * k];
    });
    const over = 2 + R.int(0, 2);
    for (let i = 1; i <= over; i++) pts.push(pts[i]);
    passes.push(pts);
  }
  const f = v => +v.toFixed(2);
  return { d: passes.map(p => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`), points: passes };
}

/**
 * The playful arrival: a small bounce as a message comes into view, as Web
 * Animations keyframes and timing, or null. Only at full motion: never in
 * quiet or warm, never under reduced motion. `order` staggers a batch that
 * arrives together, capped so a long thread never waits.
 * @param {'still'|'state'|'ambient'|'full'} motion
 * @param {number} [order]
 * @param {'me'|'them'} [from]
 */
export function arrival(motion, order = 0, from = 'them') {
  if (motion !== 'full') return null;
  const x = from === 'me' ? 10 : -10;
  return {
    frames: [
      { opacity: 0, transform: `translate(${x}px, 14px) scale(0.94)` },
      { opacity: 1, transform: 'translate(0, -3px) scale(1.015)', offset: 0.62 },
      { opacity: 1, transform: 'none' },
    ],
    timing: { duration: 420, delay: Math.min(order, 5) * 70, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'backwards' },
  };
}
