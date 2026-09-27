// The saving footer, wired to the page. A form saves itself when the person
// pauses typing; the footer says what is happening, using the library's
// Loader, Badge, Toast and Connecting. Every change comes from the transport:
// here a seeded fake one, in a real app your fetch or websocket.

import '../../components/loader/loader.js';
import '../../components/badge/badge.js';
import '../../components/toast/toast.js';
import '../../components/connecting/connecting.js';
import { createTransport } from './transport.js';
import { createSession, initial, view, STRINGS } from './footer.core.js';

/**
 * Show a view in a footer. The loader and badge show every state; the polite
 * status line says only outcomes (saved at, not saved), so a person typing is
 * not told "Saving" at every pause. The picture is hidden from screen readers,
 * so nothing is said twice.
 * @param {HTMLElement} footer
 * @param {{ busy: boolean, text: string, tone: string, connection: string|null }} v
 */
export function renderFooter(footer, v) {
  const $ = s => footer.querySelector(s);
  const said = $('.saving-footer__said'), loader = $('sg-loader'), badge = $('sg-badge'), conn = $('sg-connecting');
  const words = $('.saving-footer__words'); // the badge's own text; its skin draws beside it
  if (v.announce && said.textContent !== v.text) said.textContent = v.text;
  loader.hidden = !v.busy;
  badge.hidden = v.busy;
  if (!v.busy) {
    if (badge.getAttribute('tone') !== v.tone) badge.setAttribute('tone', v.tone);
    if (words.textContent !== v.text) words.textContent = v.text;
  }
  conn.hidden = v.connection == null;
  if (v.connection && conn.getAttribute('state') !== v.connection) conn.setAttribute('state', v.connection);
}

/**
 * Build one footer's markup (the live form's, or a still one in the gallery).
 * A still has no live regions: its status line and its connection words stay silent.
 */
export function footerMarkup({ live = true, button = true } = {}) {
  return `
    <div class="saving-footer__state">
      <span class="saving-footer__said sg-vh"${live ? ' role="status"' : ''}></span>
      <span class="saving-footer__picture" aria-hidden="true">
        <sg-loader role="none" label="${STRINGS.saving}" hidden></sg-loader>
        <sg-badge tone="neutral"><span class="saving-footer__words">${STRINGS.fresh}</span></sg-badge>
      </span>
    </div>
    <sg-connecting${live ? '' : ' role="none"'} label="${STRINGS.connection}" state="connected" hidden></sg-connecting>
    ${button ? `<button type="submit" class="saving-footer__save">${STRINGS.saveNow}</button>` : ''}`;
}

/**
 * Wire a form: its fields save themselves through `transport`.
 * @param {HTMLFormElement} form
 * @param {{ transport: ReturnType<typeof createTransport>, toasts: HTMLElement & { show: Function } }} o
 */
export function mountSavingFooter(form, { transport, toasts }) {
  const footer = form.querySelector('.saving-footer');
  footer.innerHTML = footerMarkup();
  const bytes = () => new TextEncoder().encode(new URLSearchParams(new FormData(form)).toString()).length;
  const session = createSession({ transport, bytes });
  let errorToast = null;

  function show(r) {
    renderFooter(footer, r.view);
    for (const t of r.toasts) {
      if (t === 'toast-error') {
        errorToast = toasts.show({
          message: STRINGS.failed, tone: 'error',
          action: { label: STRINGS.tryAgain, keep: true, onAction: () => show(session.retry(Date.now())) },
        });
      } else if (t === 'clear-error') { errorToast?.dismiss('resolved'); errorToast = null; }
      else if (t === 'toast-recovered') toasts.show({ message: STRINGS.recovered, tone: 'success' });
    }
  }

  form.addEventListener('input', () => show(session.edit(Date.now())));
  form.addEventListener('submit', e => { e.preventDefault(); show(session.saveNow(Date.now())); });
  form.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); show(session.saveNow(Date.now())); }
  });
  // Ask the transport what has happened, ten times a second. The footer changes only on its answers.
  const timer = setInterval(() => show(session.tick(Date.now())), 100);
  show(session.tick(Date.now()));
  return { session, destroy: () => clearInterval(timer) };
}

/** A still footer for the gallery: the view a given state would show. */
export function stillFooter(el, state, now = Date.now()) {
  el.innerHTML = footerMarkup({ live: false, button: false });
  renderFooter(el, view({ ...initial(), ...state }, now));
}
