// <sg-tabs>: a nav of links to real, headed sections, enhanced into the ARIA
// APG tabs pattern (automatic activation) when JavaScript runs.
//
//   <sg-tabs>
//     <nav aria-label="Room details">
//       <ul>
//         <li><a href="#overview">Overview</a></li>
//         <li><a href="#amenities">Amenities</a></li>
//       </ul>
//     </nav>
//     <section id="overview"><h2>Overview</h2>…</section>
//     <section id="amenities"><h2>Amenities</h2>…</section>
//   </sg-tabs>
//
// Without JavaScript this is a table of contents: every section shows, and
// each link jumps to its heading. With JavaScript, the `<ul>` becomes a
// tablist, each `<a>` a tab with roving tabindex, and every section but the
// selected one is hidden. Activation is automatic: the arrow keys both move
// focus and select, the way most desktop tab strips behave; Home and End
// jump to the ends. Selecting a tab swaps panels inside a same-document View
// Transition where the browser supports one, so the content can cross-fade;
// otherwise the swap is instant. Skins draw only the travelling ink
// underline; everything else here is behaviour and ARIA.

import { SgElement, defineComponent } from '../../core/component.js';
import { moveIndex, isTabsKey } from './tabs.core.js';
import { sameDocumentTransition, nextTransitionName } from '../../transitions/page.js';

export class SgTabs extends SgElement {
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #list = null; #tabs = []; #panels = []; #index = -1; #ro = null;
  #onClick = null; #onKeydown = null; #vt = null;
  #vtName = nextTransitionName('sg-tabs-panel');

  connected() {
    this.#list = this.querySelector('ul, ol');
    if (!this.#list) return; // nothing to enhance; the no-JS list of links still works
    this.#list.setAttribute('role', 'tablist');
    if (!this.#list.hasAttribute('aria-label') && !this.#list.hasAttribute('aria-labelledby')) {
      // The label usually lives on the wrapping <nav> landmark, which does not
      // itself name the tablist role; borrow it, or fall back to the host's own.
      const label = this.getAttribute('label') || this.#list.closest('nav')?.getAttribute('aria-label');
      if (label) this.#list.setAttribute('aria-label', label);
      else console.warn('sg-tabs: give the list (or its <nav>, or sg-tabs itself) an aria-label, so the tablist has a name.');
    }

    this.#tabs = [...this.#list.querySelectorAll(':scope > li > a[href^="#"]')];
    this.#panels = this.#tabs.map((a, i) => {
      a.parentElement.setAttribute('role', 'presentation');
      a.id ||= `${this.id || 'sg-tabs'}-tab-${i}`;
      a.setAttribute('role', 'tab');
      a.setAttribute('tabindex', '-1');
      const panel = this.querySelector(`#${CSS.escape(a.getAttribute('href').slice(1))}`) ?? document.getElementById(a.getAttribute('href').slice(1));
      if (panel) {
        a.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', a.id);
        panel.setAttribute('tabindex', '0');
      }
      return panel ?? null;
    });

    const fromHash = location.hash ? this.#tabs.findIndex(a => a.getAttribute('href') === location.hash) : -1;
    const fromCurrent = this.#tabs.findIndex(a => a.hasAttribute('aria-current'));
    this.#apply(Math.max(0, fromHash >= 0 ? fromHash : fromCurrent), { focus: false });

    this.#onClick = e => {
      const a = e.target.closest('a[role="tab"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      this.select(this.#tabs.indexOf(a), { focus: true });
    };
    this.#onKeydown = e => {
      const a = e.target.closest('a[role="tab"]');
      if (!a || !isTabsKey(e.key)) return;
      e.preventDefault();
      this.select(moveIndex(this.#tabs.indexOf(a), e.key, this.#tabs.length), { focus: true });
    };
    this.#list.addEventListener('click', this.#onClick);
    this.#list.addEventListener('keydown', this.#onKeydown);
    this.#ro = new ResizeObserver(() => this.update());
    this.#ro.observe(this.#list);
  }

  disconnected() {
    this.#list?.removeEventListener('click', this.#onClick);
    this.#list?.removeEventListener('keydown', this.#onKeydown);
    this.#ro?.disconnect();
    this.#ro = null;
  }

  /** Select a tab by index. `focus` moves keyboard focus there too (the default for a click or an arrow key; false for programmatic selection). */
  select(index, { focus = false } = {}) { this.#apply(index, { focus }); }
  get activeIndex() { return this.#index; }

  #apply(index, { focus }) {
    if (index < 0 || index >= this.#tabs.length) return;
    if (index === this.#index) { if (focus) this.#tabs[index].focus(); return; }
    const first = this.#index < 0;
    const run = () => {
      const prevPanel = this.#panels[this.#index];
      if (prevPanel) prevPanel.style.viewTransitionName = '';
      this.#index = index;
      this.#tabs.forEach((a, i) => {
        const on = i === index;
        a.setAttribute('aria-selected', String(on));
        a.setAttribute('tabindex', on ? '0' : '-1');
        const panel = this.#panels[i];
        if (panel) panel.hidden = !on;
      });
      const panel = this.#panels[index];
      if (panel) panel.style.viewTransitionName = this.#vtName;
      if (focus) this.#tabs[index].focus();
      this.update();
    };
    // A same-document View Transition for the panel swap, so content can
    // cross-fade; the shared helper skips it for the first paint (`first`
    // stays a same-document swap only), under reduced motion, where the
    // browser has no View Transitions, and while one is already under way
    // (arrow keys can outrun a transition's own frames; the browser would
    // only abort the older one, so this lands the mutation instantly rather
    // than stack transitions that reject each other).
    if (first) run();
    else {
      this.#vt = sameDocumentTransition(run, { pending: this.#vt, reducedMotion: this.motion === 'still' });
      if (this.#vt) { const clear = () => { this.#vt = null; }; this.#vt.finished.then(clear, clear); }
    }
    if (!first) this.emit('sg-tab-change', { index, tab: this.#tabs[index] });
  }

  state() {
    if (!this.#list || this.#index < 0) return { rects: [], index: -1, motion: this.motion, visible: this.visible };
    const base = this.#list.getBoundingClientRect();
    const rects = this.#tabs.map(a => {
      const r = a.getBoundingClientRect();
      return { left: r.left - base.left, width: r.width };
    });
    return { rects, index: this.#index, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-tabs', SgTabs);
