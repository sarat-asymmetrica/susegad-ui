// announce(text, { priority, from }): say one sentence to a screen reader and nothing else.
//
//   announce('3 people, ₹4,500');                      // polite: waits for the reader to finish
//   announce('That slot was just taken', { priority: 'assertive' });
//   announce(total, { from: stepperElement });          // inside a modal dialog, pass the element
//
// document.ariaNotify() (element.ariaNotify() when `from` has one) where the engine has it;
// otherwise one shared live region per place, made once, visually hidden and reused. A burst
// of calls is read once: the last polite sentence wins (announce.core.js). Content that is on
// the page as text stays on the page as text; this is for the change a sighted person sees
// happen, such as a total.
import { pickPath, notifyPriority, createCoalescer } from './announce.core.js';

const regions = new WeakMap();
const HIDDEN = { position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', border: '0', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' };

/**
 * The region a sentence goes in: the open modal dialog the sender sits in (the rest of the page is inert),
 * walking out through shadow roots; with no sender, whichever modal dialog is open; else the body.
 */
function homeOf(from, doc) {
  for (let n = from; n; n = n.getRootNode?.().host) {
    const d = n.closest?.('dialog[open]');
    if (d) return d;
    if (n.getRootNode?.() === doc) break;
  }
  try { return doc.querySelector('dialog:modal') ?? doc.body; } catch { return doc.body; }
}

function regionFor(home, priority, doc) {
  let pair = regions.get(home);
  if (!pair) regions.set(home, pair = {});
  let el = pair[priority];
  if (!el || !el.isConnected) {
    el = pair[priority] = doc.createElement('div');
    el.setAttribute('data-sg-announcer', priority);
    el.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    el.setAttribute('aria-live', priority);
    el.setAttribute('aria-atomic', 'true');
    Object.assign(el.style, HIDDEN); // CSSOM, not a style attribute: fine under a strict CSP
    home.append(el);
  }
  return el;
}

function say(text, priority, from) {
  const doc = globalThis.document;
  if (!doc?.body) return;
  const target = typeof from?.ariaNotify === 'function' ? from : doc;
  if (pickPath(from, doc) === 'notify') {
    try { target.ariaNotify(text, { priority: notifyPriority(priority) }); return; } catch { /* fall through to the region */ }
  }
  const el = regionFor(homeOf(from, doc), priority, doc);
  // empty first, then the words a moment later, so the same sentence twice is still heard twice;
  // and cleared again after a while, so the hidden node is not stray text for someone browsing the page
  el.textContent = '';
  setTimeout(() => {
    el.textContent = text;
    clearTimeout(el.__sgClear);
    el.__sgClear = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 5000);
  }, 60);
}

const queue = createCoalescer({ say });

/**
 * @param {string} text
 * @param {{ priority?: 'polite'|'assertive', from?: Element }} [opts]
 */
export function announce(text, { priority = 'polite', from } = {}) {
  const doc = globalThis.document;
  if (!doc?.body) return false;
  // make the region now, so it has been in the page for a beat before its first sentence
  if (pickPath(from, doc) === 'region') regionFor(homeOf(from, doc), priority === 'assertive' ? 'assertive' : 'polite', doc);
  queue.push(text, priority, from);
  return true;
}

/** Say what is waiting now, without the pause. For a page that is about to move on. */
export const flushAnnouncements = () => queue.flush();
