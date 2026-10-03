// <sg-action-menu>: a button with `popovertarget` and a popover list of real links
// and buttons. Without JavaScript, a click opens and closes it and Tab
// cycles through its items, each a real focusable control that activates
// itself; that is already a usable menu. With JavaScript this adds the ARIA
// APG menu button keyboard model on top: a roving tabindex, ArrowUp/Down to
// move, Home/End to jump, typeahead, and ArrowUp/Down on the closed button
// to open it focused on the last or first item. Escape and an outside click
// are the platform's own popover="auto" behaviour, which also returns focus
// to the button.
//
//   <sg-action-menu>
//     <button popovertarget="account-menu">Account</button>
//     <ul id="account-menu" popover role="menu">
//       <li role="none"><a href="/profile" role="menuitem">Profile</a></li>
//       <li role="none"><button type="button" role="menuitem">Sign out</button></li>
//     </ul>
//   </sg-action-menu>
//
// Attributes: register.

import { SgElement, defineComponent } from '../../core/component.js';
import { wrap, typeaheadIndex, placement } from './action-menu.core.js';
import { talaDelay } from '../../tokens/tokens.js';

let uid = 0;
const TYPEAHEAD_MS = 500;

export class SgActionMenu extends SgElement {
  static native = '[role="menu"]';
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #trigger = null; #items = []; #active = -1; #off = [];
  #buffer = ''; #bufferT = 0; #open = false; #pendingFocus = 'first';

  connected() {
    const menu = this.native;
    if (!menu) { console.warn('sg-action-menu: put a [role="menu"] element inside it.'); return; }
    // The trigger is a descendant, not necessarily a direct child: a builder
    // may wrap it in <sg-button> for its own theatre.
    this.#trigger = this.querySelector('[popovertarget]') || [...this.querySelectorAll('button, a')].find(el => !menu.contains(el)) || null;
    if (!this.#trigger) { console.warn('sg-action-menu: put a trigger button before the [role="menu"].'); return; }

    menu.id ||= `sg-action-menu-${++uid}`;
    if (!this.#trigger.hasAttribute('popovertarget')) this.#trigger.setAttribute('popovertarget', menu.id);
    this.#trigger.setAttribute('aria-haspopup', 'menu');
    if (!this.#trigger.hasAttribute('aria-expanded')) this.#trigger.setAttribute('aria-expanded', 'false');
    // A builder who forgot role="menuitem" on the items still gets a working menu.
    if (!menu.querySelector('[role="menuitem"]')) for (const el of menu.querySelectorAll('a, button')) el.setAttribute('role', 'menuitem');

    this.#refreshItems();

    const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); this.#off.push(() => el.removeEventListener(type, fn, opts)); };
    on(menu, 'toggle', e => this.#onToggle(e));
    on(this.#trigger, 'keydown', e => this.#onTriggerKey(e));
    on(menu, 'keydown', e => this.#onMenuKey(e));
    on(menu, 'click', e => { const item = e.target.closest('[role="menuitem"]'); if (item) this.#choose(); });
    on(menu, 'pointerover', e => {
      const item = e.target.closest('[role="menuitem"]');
      const i = item ? this.#items.indexOf(item) : -1;
      if (i >= 0 && i !== this.#active) this.#move(i);
    });
    const onReflow = () => this.#place();
    on(window, 'resize', onReflow);
    on(window, 'scroll', onReflow, { capture: true, passive: true });
  }

  disconnected() {
    clearTimeout(this.#bufferT);
    this.#off.splice(0).forEach(f => f());
  }

  get open() { return this.#open; }

  #refreshItems() {
    this.#items = [...this.native.querySelectorAll('[role="menuitem"]')];
    this.#items.forEach(it => { it.tabIndex = -1; });
  }

  #onToggle(e) {
    this.#open = e.newState === 'open';
    this.#trigger.setAttribute('aria-expanded', String(this.#open));
    this.toggleAttribute('data-open', this.#open);
    if (this.#open) {
      this.#refreshItems();
      this.#items.forEach((it, i) => it.style.setProperty('--sg-item-delay', `${talaDelay(i)}ms`));
      this.#place();
      if (this.#pendingFocus === 'last') this.#move(this.#items.length - 1); else this.#move(0);
      this.#pendingFocus = 'first';
    } else {
      this.#items.forEach(it => { it.tabIndex = -1; });
      this.#active = -1;
    }
    this.update();
  }

  /** Place the list against its trigger: below by default, above near the
   * bottom of the page, always measured, never left to a default flow
   * position (which is what a bare `position: fixed` with no offsets falls
   * back to). */
  #place() {
    if (!this.#open || !this.#trigger) return;
    const t = this.#trigger.getBoundingClientRect();
    const panel = { width: this.native.offsetWidth, height: this.native.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { left, above } = placement(t, panel, viewport);
    const s = this.native.style;
    s.left = `${left}px`;
    if (above) { s.top = 'auto'; s.bottom = `${viewport.height - t.top + 6}px`; }
    else { s.bottom = 'auto'; s.top = `${t.bottom + 6}px`; }
  }

  #move(i) {
    if (!this.#items.length) return;
    if (this.#active >= 0) this.#items[this.#active].tabIndex = -1;
    this.#active = wrap(i, 0, this.#items.length);
    const item = this.#items[this.#active];
    item.tabIndex = 0;
    item.focus();
  }

  /** An item was activated: close, and return focus to the button. */
  #choose() {
    try { this.native.hidePopover(); } catch { /* already closed */ }
    this.#trigger.focus();
  }

  /** Tab leaves the menu: close, but let Tab's own default move focus onward. */
  #close() {
    try { this.native.hidePopover(); } catch { /* already closed */ }
  }

  #onTriggerKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    this.#pendingFocus = e.key === 'ArrowDown' ? 'first' : 'last';
    if (this.#open) this.#move(this.#pendingFocus === 'last' ? this.#items.length - 1 : 0);
    else try { this.native.showPopover(); } catch { /* no popover support */ }
  }

  #onMenuKey(e) {
    const n = this.#items.length;
    if (!n) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.#move(this.#active + 1); break;
      case 'ArrowUp': e.preventDefault(); this.#move(this.#active - 1); break;
      case 'Home': e.preventDefault(); this.#move(0); break;
      case 'End': e.preventDefault(); this.#move(n - 1); break;
      case 'Tab': this.#close(); break; // let Tab's own default focus change proceed
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          clearTimeout(this.#bufferT);
          this.#buffer += e.key;
          this.#bufferT = setTimeout(() => { this.#buffer = ''; }, TYPEAHEAD_MS);
          const idx = typeaheadIndex(this.#items.map(it => it.textContent.trim()), this.#buffer, this.#active);
          if (idx >= 0) this.#move(idx);
        }
    }
  }

  state() { return { open: this.#open, motion: this.motion, visible: this.visible }; }
}

defineComponent('sg-action-menu', SgActionMenu);
