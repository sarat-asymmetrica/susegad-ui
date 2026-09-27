// Form: the pure core. The submit states and their words. Runs in Node.
//
//   idle ──submit, invalid──▶ invalid ──submit, valid──▶ sending ──▶ sent | failed
//   any ──reset──▶ idle          sending ignores another submit
//
// "sending" only exists while real work is pending: the form shows it when a
// submit handler's promise is still unsettled after a moment, never on a timer.

/** Every string a person reads or hears, with register variants where the words change. Kathakar edits these. */
export const STRINGS = {
  sending: { quiet: 'Sending.', warm: 'Sending your message.', playful: 'Posting your letter.' },
  sent: { quiet: 'Sent.', warm: 'Sent. Thank you.', playful: 'Sent. Thank you!' },
  stamp: 'Sent',
  failed: detail => `Couldn't send${detail ? `: ${detail.replace(/\.$/, '')}` : ''}. Your words are still here; try again when you're ready.`,
  failedToast: "Couldn't send",
  failedToastMessage: detail => `${detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1).replace(/\.$/, '')}. ` : ''}Your words are still in the form.`,
  check: (n, labels) => {
    const list = labels.filter(Boolean);
    const what = n === 1 ? 'Check 1 field' : `Check ${n} fields`;
    return list.length ? `${what}: ${list.join(', ')}.` : `${what}.`;
  },
};

export const STATES = ['idle', 'invalid', 'sending', 'sent', 'failed'];

/**
 * The next state. events: 'invalid' (a submit found problems), 'submit' (a
 * valid submit started), 'ok', 'fail', 'reset'. A submit while sending is
 * ignored; ok and fail only settle a send that is under way.
 */
export function next(state, event) {
  switch (event) {
    case 'reset': return 'idle';
    case 'invalid': return state === 'sending' ? state : 'invalid';
    case 'submit': return state === 'sending' ? state : 'sending';
    case 'ok': return state === 'sending' ? 'sent' : state;
    case 'fail': return state === 'sending' ? 'failed' : state;
    default: return state;
  }
}

/** The words for a state, in a register. */
export function words(state, { register = 'warm', count = 0, labels = [], message = '', error = '' } = {}) {
  const r = ['quiet', 'warm', 'playful'].includes(register) ? register : 'warm';
  switch (state) {
    case 'invalid': return STRINGS.check(count, labels);
    case 'sending': return STRINGS.sending[r];
    case 'sent': return message || STRINGS.sent[r];
    case 'failed': return STRINGS.failed(error);
    default: return '';
  }
}

/** A field's name for the summary: its label, without a trailing colon, full stop or "(optional)". */
export const fieldName = label => String(label ?? '').replace(/\s+/g, ' ').replace(/\s*\((optional|required)\)\s*/i, ' ').replace(/[:*.\s]+$/, '').trim();

/** How long work may run before the form says it is sending (so fast work does not flash a loader). */
export const SENDING_AFTER_MS = 150;
