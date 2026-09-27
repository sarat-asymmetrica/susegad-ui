// File upload: the wiring. The session (upload.core.js) decides everything; this
// file only shows it. The page's clock runs while the transport has something
// on its way, and stops when it has not, so nothing moves unless bytes move.
//
//   import { mountFileUpload } from './recipe.js';
//   mountFileUpload(document.querySelector('#upload'), { transport: yourTransport });

import '../../components/file-drop/file-drop.js';
import '../../components/progress/progress.js';
import '../../components/field-note/field-note.js';
import '../../components/toast/toast.js';
import '../../components/stamp/stamp.js';
import '../../components/empty/empty.js';
import { createUploadTransport } from './transport.js';
import { createUploadSession, STRINGS, ACCEPT, MAX_BYTES, formatBytes } from './upload.core.js';

let uid = 0;
const make = (tag, props = {}, attrs = {}) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/**
 * Build the uploader inside `root`.
 * @param {HTMLElement} root
 * @param {{ transport?: object, maxBytes?: number, accept?: string[], toasts?: Element | null,
 *   clock?: () => number, heading?: number }} [o]
 *   toasts: an <sg-toast-region> (defaults to the first on the page). heading: the level for the empty state.
 */
export function mountFileUpload(root, {
  transport = createUploadTransport(), maxBytes = MAX_BYTES, accept = ACCEPT,
  toasts = document.querySelector('sg-toast-region'), clock = () => performance.now(), heading = 3,
} = {}) {
  const session = createUploadSession({ transport, maxBytes, accept });
  const id = `sg-upload-${++uid}`;
  root.classList.add('upload');

  const pick = make('div', { className: 'upload__pick' });
  const label = make('label', { className: 'upload__label', htmlFor: `${id}-input`, textContent: STRINGS.field });
  const hint = make('p', { className: 'upload__hint', id: `${id}-hint`, textContent: STRINGS.hint(formatBytes(maxBytes)) });
  const input = make('input', { type: 'file', id: `${id}-input`, multiple: true, className: 'upload__input' }, { accept: accept.join(','), 'aria-describedby': hint.id });
  const note = make('sg-field-note', {}, { for: input.id });
  // the drop zone hands the files straight to the session: the session checks them,
  // the field note says what was refused, and the list below shows each one arriving
  const drop = make('sg-file-drop', { className: 'upload__drop' }, { handoff: '' });
  drop.append(label, input);
  pick.append(drop, hint, note);

  const empty = make('sg-empty', { className: 'upload__empty' }, { scene: 'paus' });
  const choose = make('button', { type: 'button', textContent: STRINGS.choose });
  empty.append(make(`h${heading}`, { textContent: STRINGS.empty.heading }), make('p', { textContent: STRINGS.empty.text }), choose);

  const list = make('ul', { className: 'upload__list', hidden: true });
  const stampDetail = make('span');
  const stampStatus = make('p', {}, { role: 'status' });
  stampStatus.append(make('strong', { textContent: STRINGS.stamp }), ' ', stampDetail);
  const stamp = make('sg-stamp', { className: 'upload__stamp', hidden: true }, { tone: 'success', pending: '' });
  stamp.append(stampStatus);

  // The empty state (and its scene) is in the page only while there is nothing else to show.
  root.replaceChildren(pick, list, stamp);

  const rows = new Map();
  let noteShown = '', running = false;
  const errors = new Map(); // file key -> its error toast, dismissed once the file is no longer failed

  function row(r) {
    let e = rows.get(r.key);
    if (!e) {
      const li = make('li', { className: 'upload__row' });
      const bar = make('sg-progress');
      const native = make('progress');
      bar.append(native);
      li.append(bar);
      list.append(li);
      e = { li, bar, native, retry: null };
      rows.set(r.key, e);
    }
    if (e.bar.getAttribute('label') !== r.label) e.bar.setAttribute('label', r.label);
    if (+e.native.max !== r.max) e.native.max = r.max;
    if (+e.native.value !== r.value) e.native.value = r.value;
    if (r.status === 'failed' && !e.retry) {
      e.retry = make('button', { type: 'button', className: 'upload__retry', textContent: STRINGS.retry }, { 'aria-label': STRINGS.retryNamed(r.name) });
      e.retry.addEventListener('click', () => { session.retry(r.key, clock()); render(); run(); });
      e.li.append(e.retry);
    } else if (r.status !== 'failed' && e.retry) { e.retry.remove(); e.retry = null; }
  }

  /** Show the session's view, and say what the effects ask for. */
  function render(effects = []) {
    const v = session.view();
    if (v.empty && !empty.isConnected) list.before(empty);
    else if (!v.empty && empty.isConnected) empty.remove();
    list.hidden = v.empty;
    if (v.note !== noteShown) { noteShown = v.note; customElements.whenDefined('sg-field-note').then(() => note.setMessage(v.note)); }
    v.rows.forEach(row);
    for (const r of v.rows) if (r.status !== 'failed' && errors.has(r.key)) { errors.get(r.key).dismiss?.('api'); errors.delete(r.key); }
    stampDetail.textContent = v.stamp.detail;
    stamp.hidden = !v.stamp.show;
    customElements.whenDefined('sg-stamp').then(() => (v.stamp.show ? stamp.stamp() : stamp.lift()));
    for (const e of effects) {
      if (e.type !== 'toast' || !toasts?.show) continue;
      const t = toasts.show({
        message: e.message, tone: e.tone,
        action: e.retry ? { label: STRINGS.retry, onAction: () => { session.retry(e.retry, clock()); render(); run(); } } : undefined,
      });
      if (e.retry && t) errors.set(e.retry, t);
    }
    return v;
  }

  /** The clock: one frame at a time, only while bytes are on their way. */
  function run() {
    if (running) return;
    running = true;
    const step = () => {
      const effects = session.tick(clock());
      render(effects);
      if (transport.busy()) requestAnimationFrame(step);
      else running = false;
    };
    requestAnimationFrame(step);
  }

  function add(files) {
    session.add([...files], clock());
    render();
    run();
  }

  render();
  input.addEventListener('change', () => { if (input.files.length) add(input.files); input.value = ''; });
  choose.addEventListener('click', () => input.click());

  return {
    add, session, input,
    /** Show the session as it stood at time `t`, with no clock and no toasts (for galleries and tests). */
    freezeAt(t) { session.tick(t); return render(); },
  };
}
