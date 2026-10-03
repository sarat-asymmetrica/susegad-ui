// Reach: the pure core. Runs in Node.
//
// A contact block. The links are built here (so a build step can write them
// into static HTML), and so are the words the copy button says.

export const STRINGS = {
  copy: 'Copy number',
  copied: 'Copied',
  copiedLine: value => `Copied ${value}. Paste it into WhatsApp or your phone.`,
  failedLine: value => `Couldn't copy. The number is ${value}; select it to copy it.`,
};

/** The digits of a phone number, with the country code, for wa.me: "+91 98765 43210" → "919876543210". */
export const digitsOf = s => String(s ?? '').replace(/\D+/g, '');

/**
 * A WhatsApp click-to-chat link with a message already written in the box.
 * wa.me wants the full international number in digits only, no + or zeros.
 * @param {string} number e.g. "+91 98765 43210"
 * @param {string} [text] the prefilled message
 */
export function waLink(number, text = '') {
  const d = digitsOf(number).replace(/^0+/, '');
  if (d.length < 8 || d.length > 15) throw new Error(`waLink: "${number}" is not a full international number (country code and number, 8 to 15 digits).`);
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/**
 * A mailto: link, with a subject and body if given. Spaces as %20, never +,
 * which mail apps would show as plus signs.
 * @param {string} email
 * @param {{ subject?: string, body?: string }} [opts]
 */
export function mailtoLink(email, { subject, body } = {}) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`mailtoLink: "${email}" is not an email address.`);
  const q = [];
  if (subject) q.push(`subject=${encodeURIComponent(subject)}`);
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${q.length ? `?${q.join('&')}` : ''}`;
}

/** Read a wa.me link back: { digits, text }, or null. For checks and for builders' tests. */
export function readWaLink(href) {
  const m = String(href).match(/^https:\/\/wa\.me\/(\d{8,15})(?:\?text=([^&#]*))?$/);
  return m ? { digits: m[1], text: m[2] ? decodeURIComponent(m[2]) : '' } : null;
}
