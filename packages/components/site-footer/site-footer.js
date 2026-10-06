// <sg-site-footer>: the closing block every site needs. A sign-off line, the
// links a reader may still want, and the small print. It enhances a native
// <footer>, so without JavaScript the markup you wrote is the whole footer,
// styled by the CSS in the quiet look.
//
//   <sg-site-footer seed="The Paper Boat Studio">
//     <footer aria-label="Site footer">
//       <p class="sg-site-footer-sign">Drawn, printed and posted from Aldona.</p>
//       <nav class="sg-site-footer-links" aria-label="Footer">
//         <ul>
//           <li><a href="/work/">Work</a></li>
//           <li><a href="/visit/">Visit</a></li>
//           <li><a href="/privacy/">Privacy</a></li>
//         </ul>
//       </nav>
//       <p class="sg-site-footer-small">&copy; <time datetime="2026">2026</time> The Paper Boat Studio, Aldona. All drawings belong to the studio.</p>
//     </footer>
//   </sg-site-footer>
//
// With JavaScript, the small print's copyright year moves forward to the
// clock's year, once, and never back: a footer written "&copy; 2024" shows the
// year it is, and a year the author wrote ahead keeps. The element never
// invents a year when the markup has none. The sign-off, the links and the
// small print itself are the author's words; the element writes nothing there.
//
// Attributes: now (an ISO date to count from, for demos, tests and print; it
// stops the clock), seed (the drawing's seed; default the sign-off line),
// register.
// Event: sg-site-footer-year { year } when the small print's year moved on.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, yearIn, yearTo } from './site-footer.core.js';

const YEAR = /\b(?:19|20)\d{2}\b/;

export class SgSiteFooter extends SgElement {
  static native = 'footer';
  static observedAttributes = ['register', 'now', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    const foot = this.native;
    if (!foot) { console.warn('sg-site-footer: put a <footer> inside.'); return; }
    if (!foot.hasAttribute('aria-label') && !foot.hasAttribute('aria-labelledby')) foot.setAttribute('aria-label', STRINGS.label);
    this.#roll();
  }
  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (this.native && old !== now && name === 'now') this.#roll();
  }

  #now() {
    const fixed = Date.parse(this.getAttribute('now') ?? '');
    return Number.isFinite(fixed) ? fixed : Date.now();
  }

  /** Move the small print's copyright year forward to the clock's year, once. */
  #roll() {
    const small = this.native?.querySelector('.sg-site-footer-small');
    if (!small) return;
    const time = small.querySelector('time');
    const written = yearIn(time?.getAttribute('datetime') || time?.textContent || small.textContent || '');
    const r = yearTo(written, this.#now());
    if (!r.changed) return;
    if (time) {
      const dt = time.getAttribute('datetime');
      if (/^\d{4}/.test(dt ?? '')) time.setAttribute('datetime', String(r.year) + dt.slice(4));
      time.textContent = String(r.year);
    } else {
      // No <time>: rewrite the first year in the line's own text nodes, so the
      // author's markup (links, spans) around it survives.
      for (const node of small.childNodes) {
        if (node.nodeType === 3 && YEAR.test(node.textContent)) { node.textContent = node.textContent.replace(YEAR, String(r.year)); break; }
      }
    }
    this.emit('sg-site-footer-year', { year: r.year });
  }

  state() {
    return {
      seed: this.getAttribute('seed') || this.native?.querySelector('.sg-site-footer-sign')?.textContent.trim() || 'footer',
      links: this.native?.querySelectorAll('.sg-site-footer-links a[href]').length ?? 0,
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-site-footer', SgSiteFooter);
