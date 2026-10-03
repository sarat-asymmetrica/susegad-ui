// <sg-postcard>: a card for a piece of work. It is an <article> whose heading
// link is stretched over the whole card, so the card is one tab stop and
// nothing interactive is nested. The skins add an index card's rules, a
// postcard's back or a tilt and a flip, all decoration.
//
//   <sg-postcard>
//     <article>
//       <h3><a href="/work/aldona">Aldona Organics</a></h3>
//       <p class="sg-postcard-where">Aldona, Goa, 2026 <sg-badge tone="success">Live</sg-badge></p>
//       <div class="sg-postcard-face"><p class="sg-postcard-problem">Orders arrived by message and got lost.</p></div>
//       <dl class="sg-postcard-back"><dt>Built</dt><dd>…</dd><dt>Outcome</dt><dd>…</dd></dl>
//     </article>
//   </sg-postcard>
//
// The status is a badge on the where-line by default. For a rubber stamp in
// the corner (and, in warm, a postmark on it), opt in:
//
//   <sg-postcard status-style="stamp" postmark="Aldona 2026">
//     <article> … <sg-stamp role="none" tone="success"><p class="sg-stamp-words"><strong>Live</strong></p></sg-stamp></article>
//   </sg-postcard>
//
// Attributes: status-style (badge, the default, or stamp), postmark (a place
// and year for the warm postmark; stamp style only), seed, register.

import { SgElement, defineComponent } from '../../core/component.js';
import { statusStyle } from './postcard.core.js';

export class SgPostcard extends SgElement {
  static native = 'article';
  static observedAttributes = ['register', 'postmark', 'seed', 'status-style'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    const links = this.native?.querySelectorAll('a[href]') ?? [];
    if (!this.native?.querySelector(':is(h2, h3, h4) a[href]')) console.warn('sg-postcard: put the card\'s one link in its heading: <h3><a href="…">Title</a></h3>.');
    if (links.length > 1) console.warn('sg-postcard: a card has one link, in its heading; the heading link already covers the card. Move other links out of it.');
    if (statusStyle(this.getAttribute('status-style')) !== 'stamp' && this.native?.querySelector('sg-stamp')) console.warn('sg-postcard: the status is a badge by default. Use <sg-badge> on the where-line, or set status-style="stamp" for a rubber stamp.');
  }

  state() {
    const title = this.native?.querySelector('h2, h3, h4')?.textContent.trim() ?? '';
    return {
      seed: this.getAttribute('seed') || title,
      postmark: this.getAttribute('postmark') || '',
      stampStyle: statusStyle(this.getAttribute('status-style')) === 'stamp',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-postcard', SgPostcard);
