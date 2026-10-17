// Consent: the pure core. The notice as plain HTML, from the site's own values, and the check for
// what the site has not yet filled in. Runs in Node, so a build script or a server can write the same
// markup the element writes (the event template's pages.mjs does).
//
// The notice is words first. It is a heading and six short lines, then a box that is never ticked for
// the visitor. It works with no script: the box is a native required checkbox in a label. The element
// (consent.js) only makes it nicer and flags a notice that still holds a [placeholder].
//
// It is not legal advice. A legal read is the site's to get before it goes live (consent.docs.md).

import { strings } from '../../core/strings.js';
import { BY_LANG } from './consent.strings.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ESC[c]);

/** The values a site gives. Each is the site's own words, in the language of the page. */
export const VALUES = ['fields', 'purpose', 'period', 'contact', 'site'];

/** The six lines, in the order a person needs them: what, why, how long, whom to ask, how to withdraw, where to complain. */
export const PARTS = ['collect', 'why', 'howLong', 'ask', 'withdraw', 'complain'];

// the placeholders written in English: a screen reader must not read them in another language's voice
const ENGLISH = new Set([...Object.values(BY_LANG.en.blank), BY_LANG.en.complain]);
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The text of each line, with the site's values in it. A value the site left out shows as a visible
 * [placeholder] from the `blank` table (and `complain` is a placeholder until the site gives one).
 * @param {string} lang the page's language tag
 * @param {{ fields?: string, purpose?: string, period?: string, contact?: string, site?: string, complain?: string }} values
 */
export function noticeText(lang, values = {}) {
  const S = strings(BY_LANG, lang);
  const v = Object.fromEntries(VALUES.map(k => [k, clean(values[k]) || S.blank[k]]));
  return {
    heading: S.heading,
    collect: S.collect(v.fields),
    why: S.why(v.purpose),
    howLong: S.howLong(v.period),
    ask: S.ask(v.contact),
    withdraw: S.withdraw,
    complain: clean(values.complain) || S.complain,
    checkbox: S.checkbox(v.site),
    needed: S.needed,
  };
}

/** The [square-bracket] placeholders still in a piece of text, whole, in order. Empty when the site has filled everything in. */
export const unfilled = text => String(text ?? '').match(/\[[^\]]+\]/g) ?? [];

/** Every placeholder left in the notice for these values. */
export const unfilledIn = (lang, values) => {
  const t = noticeText(lang, values);
  return [...PARTS, 'checkbox'].flatMap(k => unfilled(t[k]));
};

/** A heading level between 2 and 6; anything else is 3. */
export const levelOf = n => { const l = Math.round(Number(n)); return l >= 2 && l <= 6 ? l : 3; };

let seq = 0;
/** A unique id for a notice that was not given one. */
export const nextId = () => `sg-consent-${++seq}`;

/**
 * What goes inside <sg-consent>: the heading, the six lines, the box and its note. The box is a native
 * required checkbox named `consent`, never pre-ticked, inside a label, so it is the whole line that is
 * the click target and the form's own validation knows about it.
 */
export function consentInner({ lang = 'en', values = {}, id = nextId(), level = 3 } = {}) {
  const t = noticeText(lang, values), h = `h${levelOf(level)}`;
  // a placeholder is for the builder, not the visitor, so it is marked as English wherever it stands
  const mark = text => esc(text).replace(/\[[^\]]+\]/g, m => `<span class="sg-consent-blank"${ENGLISH.has(m) ? ' lang="en"' : ''}>${m}</span>`);
  return [
    `<${h} class="sg-consent-heading" id="${esc(id)}-h">${esc(t.heading)}</${h}>`,
    ...PARTS.map(k => `<p class="sg-consent-line" data-part="${k}">${mark(t[k])}</p>`),
    `<div class="sg-consent-tick">`,
    `  <sg-check><label><input type="checkbox" id="${esc(id)}-box" name="consent" value="yes" required> <span class="sg-consent-words">${mark(t.checkbox)}</span></label></sg-check>`,
    `  <sg-field-note for="${esc(id)}-box" validate data-value-missing="${esc(t.needed)}"></sg-field-note>`,
    `</div>`,
  ].join('\n');
}

/** The whole element as a string, for a page that is written ahead of time. */
export function renderConsent(opts = {}) {
  const id = opts.id ?? nextId();
  return `<sg-consent id="${esc(id)}" role="group" aria-labelledby="${esc(id)}-h">\n${consentInner({ ...opts, id })}\n</sg-consent>`;
}
