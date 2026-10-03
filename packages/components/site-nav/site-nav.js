// <sg-site-nav>: a site header nav that needs no JavaScript. The links sit in
// a native <details>; on a wide screen the CSS shows them with the summary
// hidden, on a narrow one the summary is the menu button.
//
//   <sg-site-nav>
//     <nav aria-label="Main">
//       <a class="sg-site-nav-home" href="/">Studio name</a>
//       <details class="sg-site-nav-menu">
//         <summary>Menu</summary>
//         <ul>
//           <li><a href="/" aria-current="page">Home</a></li>
//           <li><a href="/work/">Work</a></li>
//         </ul>
//       </details>
//     </nav>
//   </sg-site-nav>
//
// Mark the current page with aria-current="page" on the server. If nothing is
// marked, the element marks it from the URL.
//
// The Wave 5 seam: the <summary> is the one place a drawer would take over.
// When <sg-drawer> is in the page, replace the summary's disclosure with
// <a href="/menu/" data-sg-drawer="site-menu">Menu</a> and move the <ul> into
// the drawer; nothing else here depends on the disclosure.
//
// Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, current } from './site-nav.core.js';

const detailsContent = () => globalThis.CSS?.supports?.('selector(::details-content)') ?? false;

export class SgSiteNav extends SgElement {
  static native = 'nav';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #ro = null; #off = [];

  get links() { return [...(this.native?.querySelectorAll('.sg-site-nav-menu a[href], ul a[href]') ?? [])]; }
  get menu() { return this.native?.querySelector('details'); }

  connected() {
    const nav = this.native;
    if (!nav) { console.warn('sg-site-nav: put a <nav> inside.'); return; }
    if (!nav.hasAttribute('aria-label') && !nav.hasAttribute('aria-labelledby')) nav.setAttribute('aria-label', STRINGS.label);
    this.#markCurrent();
    const menu = this.menu;
    if (!menu) return;
    // Where ::details-content isn't supported, a wide screen opens the disclosure so the links show.
    if (!detailsContent()) {
      this.#ro = new ResizeObserver(() => {
        const wide = this.#wide();
        this.toggleAttribute('data-wide', wide);
        if (wide) menu.open = true;
      });
      this.#ro.observe(this);
    }
    const onKey = e => {
      if (e.key !== 'Escape' || !menu.open || this.#wide()) return;
      menu.open = false;
      menu.querySelector('summary')?.focus();
    };
    const onClick = e => { if (e.target.closest?.('a[href^="#"]') && !this.#wide()) menu.open = false; };
    menu.addEventListener('keydown', onKey);
    menu.addEventListener('click', onClick);
    this.#off.push(() => menu.removeEventListener('keydown', onKey), () => menu.removeEventListener('click', onClick));
  }
  disconnected() { this.#ro?.disconnect(); this.#off.splice(0).forEach(f => f()); }

  /** Wide is the CSS's breakpoint: 40rem of the element's own width. */
  #wide() {
    const rem = parseFloat(getComputedStyle(this.ownerDocument.documentElement).fontSize) || 16;
    return this.getBoundingClientRect().width >= 40 * rem;
  }

  #markCurrent() {
    const links = this.links;
    if (links.some(a => a.hasAttribute('aria-current'))) return;
    const at = current(links.map(a => new URL(a.href, location.href).pathname), location.pathname);
    if (at) links[at.index].setAttribute('aria-current', at.kind);
  }

  state() {
    return { links: this.links.length, current: this.links.findIndex(a => a.hasAttribute('aria-current')), motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-site-nav', SgSiteNav);
