// <sg-banner>: an announcement across the top of a page. Dismissible, remembered for the visitor.
//
//   <sg-banner id="monsoon" until="2026-10-01">
//     Closed for the monsoon, back <time datetime="2026-10-01"></time>.
//   </sg-banner>
//
// The words are yours and sit in the element, so the page reads without any script. The element adds a
// dismiss button, remembers a dismissal in localStorage (every read and write wrapped; with no storage the
// banner shows on every visit), says the announcement through announce() once per visit, and shows nothing after its
// `until` date (read in IST; a date alone means through the end of that day). An empty
// <time datetime="…"> is filled with the date in words, in the page's language. A `back="2026-10-01"`
// attribute adds the line "Back 1 October" after the words.

import { SgElement, defineComponent } from '../../core/component.js';
import { announce } from '../../core/announce.js';
import { strings, langOf } from '../../core/strings.js';
import { BY_LANG } from './banner.strings.js';
import { announcement, dateText, heardKey, isExpired, phaseOf, rememberDismissed, safeStore, shouldSay, storageKey, wasDismissed } from './banner.core.js';

export { BY_LANG };

const CLOSE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
let uid = 0;

/** The first thing a person could focus after this element in the page, for focus to land on when the banner goes. */
function nextFocusable(el) {
  return [...document.querySelectorAll(FOCUSABLE)].find(n =>
    !el.contains(n) && el.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden') ?? null;
}

/**
 * Where focus goes when the banner it was in goes: the next thing a person could focus, else the page's main content
 * (given tabindex="-1" if it has none, so it can take focus), else nowhere. Never the body, which takes no focus.
 */
function landing(el) {
  const next = nextFocusable(el);
  if (next) return next;
  const main = document.querySelector('main, [role="main"]');
  if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  return main;
}

export class SgBanner extends SgElement {
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };
  static observedAttributes = ['register', 'until'];

  phase = 'shown';
  #body = null; #button = null; #deco = null; #key = ''; #authored = ''; #leaving = false; #store = safeStore(); #session = safeStore(() => globalThis.sessionStorage); #S = strings(BY_LANG, 'en'); #seed = 0; #announced = false;

  /** Read once on connect; set `now` before connecting to fake the clock in a test. */
  now = () => Date.now();

  get until() { return this.getAttribute('until') ?? ''; }
  /** The words, as read aloud: the body without the dismiss button or the decoration. */
  get text() { return (this.#body?.textContent ?? this.textContent).replace(/\s+/g, ' ').trim(); }

  connected() {
    this.#authored = this.getAttribute('id') || this.#authored;
    if (!this.id) this.id = `sg-banner-${++uid}`;
    this.#S = strings(BY_LANG, langOf(this));
    if (!this.#body) this.#build();
    this.#seed = [...this.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
    this.#decide();
  }

  #build() {
    const body = document.createElement('div');
    body.className = 'sg-banner-body';
    body.append(...this.childNodes);
    const back = this.getAttribute('back');
    if (back) {
      const when = dateText(back, langOf(this));
      if (when) {
        const line = document.createElement('span');
        line.className = 'sg-banner-back';
        const t = Object.assign(document.createElement('time'), { dateTime: back, textContent: when });
        // the language's own order, "Back 1 October" or "1 ऑक्टोबर परत"; only the date is the <time>
        const [before, after] = this.#S.back('\u0000').split('\u0000');
        line.append(' ', before, t, after);
        body.append(line);
      }
    }
    // a date left empty by the author is filled in words, in the page's language, read in IST
    const lang = langOf(this);
    for (const t of body.querySelectorAll('time[datetime]')) if (!t.textContent.trim()) t.textContent = dateText(t.getAttribute('datetime'), lang);
    const deco = document.createElement('div');
    deco.className = 'sg-banner-deco';
    deco.setAttribute('aria-hidden', 'true');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sg-banner-dismiss';
    button.innerHTML = CLOSE;
    button.addEventListener('click', () => this.dismiss('user'));
    this.replaceChildren(deco, body, button);
    this.#body = body; this.#button = button; this.#deco = deco;
    this.setAttribute('role', 'region');
    this.#key = storageKey(this.#authored, this.text);
  }

  #decide() {
    this.#S = strings(BY_LANG, langOf(this));
    this.setAttribute('aria-label', this.getAttribute('label') || this.#S.label);
    this.#button.setAttribute('aria-label', this.#S.dismiss);
    const phase = phaseOf({ expired: isExpired(this.until, this.now()), dismissed: wasDismissed(this.#store, this.#key) });
    this.#set(phase);
    // said once, the first time it is on show: never for a banner that arrives dismissed or out of date
    if (phase === 'shown' && !this.#announced) {
      this.#announced = true;
      // once per visit: a visitor who walks through three pages hears it on the first, not on each
      if (shouldSay(this.#session, this.#key)) announce(announcement(this.#S, this.text), { from: this });
    }
  }

  #set(phase) {
    this.phase = phase;
    this.dataset.phase = phase;
    this.hidden = phase !== 'shown';
    this.update();
  }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'until' && old !== now && this.#body && this.phase !== 'dismissed') this.#decide();
  }

  state() { return { phase: this.phase, seed: this.#seed }; }

  /** The decoration box a skin draws into. */
  get deco() { return this.#deco; }

  /**
   * Send the banner away. The browser remembers it for this visitor (when it can), the skin plays its exit,
   * and focus, if it was on the banner, moves to the next thing on the page.
   * @param {'user'|'api'} reason
   * @returns {Promise<boolean>} whether the browser kept the dismissal
   */
  async dismiss(reason = 'api') {
    if (this.phase !== 'shown' || this.#leaving) return false;
    this.#leaving = true;
    const had = this.contains(document.activeElement);
    const next = had ? landing(this) : null;
    const kept = rememberDismissed(this.#store, this.#key, this.now());
    this.dataset.phase = 'leaving';
    const done = this.skin?.leave?.();
    await Promise.race([done ?? Promise.resolve(), new Promise(r => setTimeout(r, 600))]);
    this.#set('dismissed');
    this.getAnimations({ subtree: true }).forEach(a => a.cancel()); // the exit's held last frame must not outlast the dismissal
    this.#leaving = false;
    if (had && next?.isConnected) next.focus({ preventScroll: true });
    this.emit('sg-banner-dismiss', { id: this.id, reason, remembered: kept });
    return kept;
  }

  /** Forget a dismissal and show the banner again (for a "show announcements" setting). */
  reset() {
    this.#store.remove(this.#key);
    this.#announced = false;
    this.#session.remove(heardKey(this.#key));
    this.#leaving = false;
    this.#decide();
  }
}

defineComponent('sg-banner', SgBanner);
