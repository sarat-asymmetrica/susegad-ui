// <sg-lang>: a language switcher that is a row of links. Each link is a real
// page in its own language, so it works with no JavaScript, for search and for
// a screen reader (decision 0025).
//
//   <sg-lang>
//     <nav aria-label="Language">
//       <ul>
//         <li><a href="/" hreflang="en-IN" lang="en-IN" aria-current="page">English</a></li>
//         <li><a href="/gom-deva/" hreflang="gom-Deva" lang="gom-Deva">कोंकणी</a></li>
//         <li><a href="/gom-latn/" hreflang="gom-Latn" lang="gom-Latn">Konknni</a></li>
//       </ul>
//     </nav>
//   </sg-lang>
//
// Write the markup on the server, with aria-current on the page's own language.
// With JavaScript the element fills in what the markup leaves out: the nav's
// label in the page's language, each link's `lang` from its hreflang, an empty
// link's name in its own script, and aria-current from <html lang>.
//
// Attributes: register; remember (keeps the last language clicked in
// localStorage and marks that link data-remembered, with a visually hidden
// "Last chosen" for a screen reader, when it is not this page; it never redirects).

import { SgElement, defineComponent } from '../../core/component.js';
import { langOf, langOfKey, strings, t } from '../../core/strings.js';
import { BY_LANG } from '../../core/strings.table.js';
import { labelFor, currentIndex } from './lang.core.js';

const KEY = 'sg-lang';
const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* storage blocked: nothing remembered, nothing lost */ } },
};

export class SgLang extends SgElement {
  static native = 'nav';
  static observedAttributes = ['register', 'remember'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #off = [];

  get links() { return [...(this.native?.querySelectorAll('a[hreflang]') ?? [])]; }
  /** The last language clicked, when `remember` is set, else null. */
  get remembered() { return this.hasAttribute('remember') ? store.get() : null; }

  connected() {
    const nav = this.native;
    if (!nav) { console.warn('sg-lang: put a <nav> inside.'); return; }
    const page = langOf(this);
    if (!nav.hasAttribute('aria-label') && !nav.hasAttribute('aria-labelledby')) nav.setAttribute('aria-label', t(strings(BY_LANG, page), 'language'));
    const links = this.links;
    for (const a of links) {
      const tag = a.getAttribute('hreflang');
      if (!a.hasAttribute('lang')) a.setAttribute('lang', tag);
      if (!a.textContent.trim()) a.textContent = labelFor(tag);
    }
    if (!links.some(a => a.hasAttribute('aria-current'))) {
      const i = currentIndex(links.map(a => a.getAttribute('hreflang')), page);
      if (i >= 0) links[i].setAttribute('aria-current', 'page');
    }
    this.#markRemembered();
    const onClick = e => {
      const a = e.target.closest?.('a[hreflang]');
      if (a && this.hasAttribute('remember') && e.button === 0) store.set(a.getAttribute('hreflang'));
    };
    nav.addEventListener('click', onClick);
    this.#off.push(() => nav.removeEventListener('click', onClick));
  }
  disconnected() { this.#off.splice(0).forEach(f => f()); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (name === 'remember' && this.native) this.#markRemembered();
  }

  #markRemembered() {
    const want = this.remembered, links = this.links;
    const here = links.findIndex(a => a.hasAttribute('aria-current'));
    const page = langOf(this);
    links.forEach((a, i) => {
      const on = !!want && i !== here && a.getAttribute('hreflang') === want;
      a.toggleAttribute('data-remembered', on);
      let note = a.querySelector('.sg-lang-last');
      if (on && !note) {
        // the dot is only a picture: a screen reader gets the words, in the page's language when there is a table for it
        note = a.ownerDocument.createElement('span');
        note.className = 'sg-vh sg-lang-last';
        note.lang = langOfKey(BY_LANG, page, 'lastChosen');   // English when the table has no Konkani for it yet
        note.textContent = `, ${t(strings(BY_LANG, page), 'lastChosen')}`;
        a.append(note);
      } else if (!on) note?.remove();
    });
  }

  state() {
    const tags = this.links.map(a => a.getAttribute('hreflang'));
    return { links: tags.length, current: this.links.findIndex(a => a.hasAttribute('aria-current')), tags, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-lang', SgLang);
