// Ask the house: the Casa enquiry form, rebuilt from library parts.
//
// <sg-form> checks the fields and says what happens; <sg-field> draws each
// line; <sg-field-note> says what is wrong. This is a prototype, so the
// answer is immediate and plain: nothing is sent, and the page says so.
// In your project, replace `answer` with a real send (see README.md).
//
// Importing this file wires nothing: it defines the components and exports
// the pieces. demo.js is what mounts the prototype on index.html.

import '../../components/field/field.js';
import '../../components/field-note/field-note.js';
import '../../components/form/form.js';
import '../../components/select/select.js';
import '../../components/combobox/combobox.js';
import { toAsciiDigits } from '../../components/otp/otp.core.js';

/** Every string a person reads here. Kathakar edits these. */
export const STRINGS = {
  stamp: 'Not sent',
  detail: 'Prototype',
  message: 'Prototype: nothing was sent. In the live site this goes to the house on WhatsApp and email.',
  tooMany: "The house sleeps 6. Tell us more below and we'll see what's possible.",
};

/**
 * What happens when a valid enquiry is sent. A prototype answers at once and
 * says nothing left the page; a live site would post `formData` and resolve
 * with its own message, or reject with what went wrong.
 * @param {FormData} formData
 */
export async function answer(formData) {
  void formData; // nothing is sent
  return { stamp: STRINGS.stamp, detail: STRINGS.detail, tone: 'info', message: STRINGS.message };
}

/** Wire an <sg-form> to an answer. Returns a function that unwires it. */
export function mountEnquiry(el, send = answer) {
  const onSubmit = e => e.detail.respondWith(send(e.detail.formData));
  el.addEventListener('sg-submit', onSubmit);
  // a number typed in Devanagari, Kannada or any Indian numerals is written as ASCII as it is
  // typed, so the house receives '98220 12345' (the pattern accepts either, for pages without scripts)
  const contact = el.querySelector('input[name=contact]');
  const onInput = () => {
    const v = contact.value, a = toAsciiDigits(v);
    if (a === v) return;
    const at = contact.selectionStart;
    contact.value = a;
    contact.setSelectionRange?.(at, at);
  };
  contact?.addEventListener('input', onInput);
  return () => { el.removeEventListener('sg-submit', onSubmit); contact?.removeEventListener('input', onInput); };
}

/** "More than 6" gets the house's own answer, as a hint: it is a question for the house, not an error. */
export function mountGroupHint(select, note) {
  const say = () => note.setMessage(select.value === '7+' ? STRINGS.tooMany : '');
  select.addEventListener('change', say);
  customElements.whenDefined('sg-field-note').then(say);
  return () => select.removeEventListener('change', say);
}
