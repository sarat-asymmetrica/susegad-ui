// <sg-toast-region> and <sg-toast>: short messages that never steal focus.
//
//   <sg-toast-region></sg-toast-region>                 once per page
//   region.show({ message: 'Saved', tone: 'success' })  or toast('Saved', { tone: 'success' })
//   <sg-toast tone="error">Couldn't save. Check your connection and try again.</sg-toast>
//                                                        (appended to the region, e.g. by htmx)
//
// Screen readers hear every toast at once through two live regions that exist
// before any message arrives: role="status" (polite) and role="alert" for
// errors. The visible stack shows a few at a time; the rest wait, untimed.
// Timing follows WCAG 2.2.1: see toast.core.js.

import { SgElement, defineComponent } from '../../core/component.js';
import { readRegister } from '../../core/register.js';
import { play } from '../../sound/index.js';
import {
  STRINGS, normalizeTone, durationFor, joinTitle, announcement, liveRole, createQueue, parseHotkey, postmarkText,
} from './toast.core.js';

export { STRINGS };

/** Alt+T alone opens Firefox's Tools menu on Windows and Linux; with Shift it clashes with no menu. Set `hotkey` to change it. */
export const DEFAULT_HOTKEY = 'Alt+Shift+T';

const SKINS = {
  quiet: () => import('./skins/quiet.js'),
  warm: () => import('./skins/warm.js'),
  playful: () => import('./skins/playful.js'),
};

/** One glyph per tone, so the tone never rests on colour alone. 20×20, stroked. */
const GLYPH = {
  info: '<circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.2v.1"/>',
  success: '<circle cx="10" cy="10" r="8"/><path d="M6.4 10.4l2.4 2.4 4.8-5.2"/>',
  warning: '<path d="M10 2.8l7.6 13.4H2.4z"/><path d="M10 8v3.8M10 14.1v.1"/>',
  error: '<path d="M6.7 2.5h6.6l4.7 4.7v6.6l-4.7 4.7H6.7L2 13.8V7.2z"/><path d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2"/>',
};
const icon = tone => `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPH[tone]}</svg>`;
const CLOSE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

let uid = 0;

export class SgToast extends SgElement {
  static skins = SKINS;
  static observedAttributes = ['register', 'tone'];

  phase = 'enter';
  body = null;
  created = new Date();

  get tone() { return normalizeTone(this.getAttribute('tone')); }
  /** The message as read aloud, without the dismiss button. */
  /** The message alone: no tone prefix, no action or link labels, no dismiss button. What is read aloud and timed. */
  get text() {
    const c = (this.body ?? this).cloneNode(true);
    c.querySelectorAll('button, a[href], .sg-toast-sr, .sg-toast-close, .sg-toast-deco, .sg-toast-icon').forEach(n => n.remove());
    const title = c.querySelector('.sg-toast-title');
    const head = title?.textContent ?? '';
    title?.remove();
    return joinTitle(head, c.textContent);
  }
  get hasAction() { return !!this.body?.querySelector('button, a[href]'); }

  connected() {
    if (!this.id) this.id = `sg-toast-${++uid}`;
    if (!this.body) this.#build();
    // the skin decides the entrance; if no skin arrives, show it plainly
    setTimeout(() => { if (this.phase === 'enter' && !this.dataset.skin) this.#settle(); }, 300);
    this.addEventListener('sg-skin', () => this.update());
  }

  #build() {
    const tone = this.tone;
    const body = document.createElement('div');
    body.className = 'sg-toast-body';
    const prefix = STRINGS.prefix[tone];
    if (prefix) {
      const sr = document.createElement('span');
      sr.className = 'sg-toast-sr';
      sr.textContent = prefix;
      body.append(sr);
    }
    body.append(...this.childNodes);
    const mark = document.createElement('span');
    mark.className = 'sg-toast-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = icon(tone);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sg-toast-close';
    close.innerHTML = CLOSE;
    const deco = document.createElement('div');
    deco.className = 'sg-toast-deco';
    deco.setAttribute('aria-hidden', 'true');
    this.append(deco, mark, body, close);
    this.body = body;
    const label = this.text.slice(0, 60);
    close.setAttribute('aria-label', label ? STRINGS.dismissNamed(label) : STRINGS.dismiss);
    close.addEventListener('click', () => this.dismiss('user'));
    // an action in the message dismisses the toast once it has run, unless it asks not to
    body.addEventListener('click', e => {
      const a = e.target.closest?.('button, a[href]');
      if (a && !a.hasAttribute('data-keep')) queueMicrotask(() => this.dismiss('action'));
    });
  }

  #settle() { this.phase = 'shown'; this.dataset.phase = 'shown'; this.update(); }

  /** Called by the skin when its entrance has finished (or at once, when it has none). */
  entered() { if (this.phase === 'enter') this.#settle(); }

  state() {
    return { tone: this.tone, phase: this.phase, postmark: postmarkText(this.created), text: this.text };
  }

  /**
   * Take the toast away: the skin plays its exit, then the element is removed.
   * @param {'user'|'timeout'|'action'|'api'} reason
   */
  async dismiss(reason = 'api') {
    if (this.phase === 'leave') return;
    this.phase = 'leave';
    this.dataset.phase = 'leave';
    this.emit('sg-toast-dismiss', { reason, id: this.id });
    const done = this.skin?.leave?.();
    await Promise.race([done ?? Promise.resolve(), new Promise(r => setTimeout(r, 700))]);
    this.remove();
  }
}

export class SgToastRegion extends (globalThis.HTMLElement ?? class {}) {
  static observedAttributes = ['max', 'hotkey', 'duration', 'layout'];

  #q = createQueue({ max: 3, front: true });
  #last = 0; #timer = 0; #pausedBy = new Set(); #returnTo = null; #built = false; #off = [];
  /** keeps the letters behind the front one exactly as tall as it, so the pile shows even edges */
  #ro = typeof ResizeObserver === 'function' ? new ResizeObserver(([e]) => {
    this.stack?.style.setProperty('--front-h', `${Math.round(e.target.offsetHeight)}px`);
  }) : null;
  stack; more; #live = {};
  /** WCAG 2.4.11: how much of the viewport's edge the pile covers, published so the page makes room */
  #pileRo = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.#room()) : null;
  #roomPx = -1; #topWas = null;

  /** 'pile' (default): the newest in front, the rest peeking behind until pointed at or focused. 'list': all laid out. */
  get layout() { return this.getAttribute('layout') === 'list' ? 'list' : 'pile'; }
  get max() { return Math.max(1, parseInt(this.getAttribute('max') ?? '3', 10) || 3); }
  /** null: each toast's own reading time; 0: never time out; n: at least n ms. */
  get duration() {
    const v = this.getAttribute('duration');
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  connectedCallback() {
    if (!this.#built) this.#build();
    this.#q.max = this.max;
    this.#q.front = this.layout === 'pile';
    this.#last = performance.now();
    // warm the skin cache so the first toast unfolds without waiting for a download
    SKINS[readRegister(this)]?.().catch(() => {});
    const onKey = e => this.#hotkey(e);
    const onVis = () => this.#pause('hidden', document.visibilityState === 'hidden');
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    const mo = new MutationObserver(() => this.#adopt());
    mo.observe(this, { childList: true });
    const onFocus = e => this.#guard(e.target);
    const onResize = () => this.#room();
    document.addEventListener('focusin', onFocus);
    addEventListener('resize', onResize);
    this.#pileRo?.observe(this.stack);
    this.stack.addEventListener('transitionend', onResize);
    this.#off.push(() => document.removeEventListener('keydown', onKey), () => document.removeEventListener('visibilitychange', onVis), () => mo.disconnect(),
      () => document.removeEventListener('focusin', onFocus), () => removeEventListener('resize', onResize), () => this.#pileRo?.disconnect(), () => this.#publish(0));
    this.#adopt();
  }
  connectedMoveCallback() {}
  disconnectedCallback() {
    queueMicrotask(() => { if (!this.isConnected) { this.#off.splice(0).forEach(f => f()); clearTimeout(this.#timer); } });
  }
  attributeChangedCallback(name) {
    if (name === 'max') this.#q.max = this.max;
    if (name === 'layout') this.#q.front = this.layout === 'pile';
    if ((name === 'max' || name === 'layout') && this.#built) this.#sync();
  }

  #build() {
    this.#built = true;
    for (const role of ['status', 'alert']) {
      const live = document.createElement('div');
      live.className = 'sg-toast-live';
      live.setAttribute('role', role);
      if (role === 'status') live.setAttribute('aria-live', 'polite');
      this.#live[role] = live;
    }
    const stack = document.createElement('section');
    stack.className = 'sg-toast-stack';
    stack.setAttribute('aria-label', this.getAttribute('label') || STRINGS.region);
    if (typeof stack.showPopover === 'function') stack.setAttribute('popover', 'manual');
    const more = document.createElement('p');
    more.className = 'sg-toast-more';
    more.hidden = true;
    stack.append(more);
    this.stack = stack; this.more = more;
    this.append(this.#live.status, this.#live.alert, stack);

    stack.addEventListener('pointerenter', () => this.#pause('pointer', true));
    stack.addEventListener('pointerleave', () => this.#pause('pointer', false));
    stack.addEventListener('focusin', e => {
      if (!stack.contains(e.relatedTarget)) this.#returnTo ??= e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
      this.#pause('focus', true);
    });
    stack.addEventListener('focusout', e => {
      if (!stack.contains(e.relatedTarget)) { this.#pause('focus', false); if (e.relatedTarget) this.#returnTo = null; }
    });
    stack.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const t = e.target.closest?.('sg-toast');
      if (t) { e.preventDefault(); e.stopPropagation(); t.dismiss('user'); }
    });
    stack.addEventListener('sg-toast-dismiss', e => this.#leaving(e.detail.id));
  }

  /** Toasts appended straight into the region (by a server, say) move into the stack. */
  #adopt() {
    for (const t of [...this.children].filter(c => c.localName === 'sg-toast')) this.#enter(t);
  }

  /**
   * Show a toast.
   * @param {string|{ message?: string, title?: string, tone?: string, duration?: number,
   *   action?: { label: string, onAction?: (e: Event) => void, keep?: boolean } }|SgToast} what
   * @returns {SgToast}
   */
  show(what) {
    if (what instanceof HTMLElement) { this.#enter(what); return what; }
    const o = typeof what === 'string' ? { message: what } : what ?? {};
    const t = document.createElement('sg-toast');
    t.setAttribute('tone', normalizeTone(o.tone));
    if (o.duration != null) t.setAttribute('duration', String(o.duration));
    if (o.title) { const s = document.createElement('strong'); s.className = 'sg-toast-title'; s.textContent = o.title; t.append(s, ' '); }
    if (o.message) { const p = document.createElement('span'); p.className = 'sg-toast-message'; p.textContent = o.message; t.append(p); }
    if (o.action) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sg-toast-action'; b.textContent = o.action.label;
      if (o.action.keep) b.setAttribute('data-keep', '');
      if (o.action.onAction) b.addEventListener('click', o.action.onAction);
      t.append(' ', b);
    }
    this.#enter(t);
    return t;
  }

  #enter(t) {
    if (this.#q.has(t.id) && t.parentNode === this.stack) return;
    this.stack.insertBefore(t, this.more); // connected() builds it and gives it an id
    const own = t.getAttribute('duration');
    const d = durationFor({
      tone: t.tone, text: t.text, hasAction: t.hasAction,
      duration: own == null || own === '' ? null : Number(own), regionDuration: this.duration,
    });
    this.#spend(); // time that passed before it arrived belongs to the others, not to it
    this.#q.add(t.id, d);
    this.#say(t);
    play(t.tone === 'error' ? 'error' : 'confirm', { register: readRegister(this) });
    this.#sync();
  }

  /** Every toast is spoken as it arrives, even one that waits to be shown. */
  #say(t) {
    const live = this.#live[liveRole(t.tone)];
    const line = document.createElement('p');
    line.textContent = announcement(t.tone, t.text);
    // appended a moment later so a region that has only just been created still hears it
    // (a timer, not a frame: frames do not run in a hidden tab)
    setTimeout(() => { live.append(line); setTimeout(() => line.remove(), 15000); }, 60);
  }

  #leaving(id) {
    const t = document.getElementById(id);
    // focus was on the toast that is going: move to its neighbour, or back where the person was
    if (t?.contains(document.activeElement)) {
      const others = this.#q.visible().filter(x => x !== id).map(x => document.getElementById(x)).filter(Boolean);
      const next = others.at(-1)?.querySelector(FOCUSABLE);
      const back = this.#returnTo?.isConnected ? this.#returnTo : null;
      queueMicrotask(() => { (next ?? back)?.focus({ preventScroll: true }); if (!next) this.#returnTo = null; });
    }
    this.#spend(); // settle the clock before the pile changes, so the next letter starts fresh
    this.#q.remove(id);
    this.#sync();
  }

  #pause(reason, on) {
    this.#spend();
    on ? this.#pausedBy.add(reason) : this.#pausedBy.delete(reason);
    this.#pausedBy.size ? this.#q.pause() : this.#q.resume();
    this.toggleAttribute('data-paused', this.#pausedBy.size > 0);
    this.#sync();
  }

  #spend() {
    const now = performance.now();
    const gone = this.#q.tick(now - this.#last);
    this.#last = now;
    gone.forEach(id => document.getElementById(id)?.dismiss('timeout'));
  }

  #sync() {
    this.#spend();
    const ids = this.#q.visible();
    const shown = new Set(ids);
    for (const t of this.stack.querySelectorAll(':scope > sg-toast')) {
      if (t.dataset.phase === 'leave') continue;
      t.hidden = !shown.has(t.id);
      // how far behind the front letter it sits in the pile: 0 is the newest
      if (shown.has(t.id)) {
        const depth = ids.length - 1 - ids.indexOf(t.id);
        t.style.setProperty('--depth', String(depth));
        t.toggleAttribute('data-front', depth === 0);
        if (depth === 0) { this.#ro?.disconnect(); this.#ro?.observe(t); }
      }
    }
    this.dataset.layout = this.layout;
    this.toggleAttribute('data-expanded', this.#pausedBy.has('pointer') || this.#pausedBy.has('focus'));
    const waiting = this.#q.waiting();
    this.more.hidden = waiting === 0;
    this.more.textContent = waiting ? STRINGS.waiting(waiting) : '';
    const any = this.stack.querySelector(':scope > sg-toast') !== null;
    if (this.stack.hasAttribute('popover')) {
      try { any ? this.stack.showPopover() : this.stack.hidePopover(); } catch { /* already in that state */ }
    }
    this.toggleAttribute('data-empty', !any);
    if (!any) this.removeAttribute('data-folded');
    requestAnimationFrame(() => this.#room());
    clearTimeout(this.#timer);
    const due = this.#q.nextDue();
    if (due != null) this.#timer = setTimeout(() => this.#sync(), due + 16);
  }

  /** The pile's reach from its edge of the viewport: its letters' outer edge (transforms included), plus a small gap. */
  #room() {
    if (!this.stack) return;
    const letters = [...this.stack.querySelectorAll(':scope > sg-toast:not([hidden])')];
    if (!letters.length || !this.stack.getClientRects().length) return this.#publish(0);
    const rects = letters.map(l => l.getBoundingClientRect());
    const top = (this.getAttribute('position') ?? '').startsWith('top');
    const reach = top ? Math.max(...rects.map(r => r.bottom)) : innerHeight - Math.min(...rects.map(r => r.top));
    this.#publish(Math.max(0, Math.ceil(reach + 8)), top);
  }

  /** Bottom piles set --sg-toast-pile (toast.css turns it into scroll padding and room at the end of the page); top piles set scroll padding directly. */
  #publish(px, top = false) {
    if (px === this.#roomPx) return;
    this.#roomPx = px;
    const root = document.documentElement.style;
    if (top) {
      this.#topWas ??= root.scrollPaddingTop;
      root.scrollPaddingTop = px ? `${px}px` : this.#topWas;
      if (!px) this.#topWas = null;
    } else if (px) root.setProperty('--sg-toast-pile', `${px}px`);
    else root.removeProperty('--sg-toast-pile');
  }

  /** A belt to the scroll padding: if focus lands under the pile anyway, fold the pile to its front letter and bring the control into view. */
  #guard(target) {
    if (!(target instanceof Element) || this.stack.contains(target) || this.hasAttribute('data-empty')) {
      if (this.stack.contains(target)) this.removeAttribute('data-folded');
      return;
    }
    const t = target.getBoundingClientRect();
    const under = [...this.stack.querySelectorAll(':scope > sg-toast:not([hidden])')].some(l => {
      const r = l.getBoundingClientRect();
      return t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top;
    });
    if (!under) return;
    this.setAttribute('data-folded', '');
    requestAnimationFrame(() => { this.#room(); requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest', inline: 'nearest' })); });
  }

  /** The hotkey moves focus to the newest toast, on request only; Escape or leaving comes back. */
  #hotkey(e) {
    const match = parseHotkey(this.getAttribute('hotkey') ?? DEFAULT_HOTKEY);
    if (!match?.(e)) return;
    const ids = this.#q.visible();
    const newest = ids.length ? document.getElementById(ids.at(-1)) : null;
    const target = newest?.querySelector(FOCUSABLE);
    if (!target) return;
    e.preventDefault();
    if (!this.stack.contains(document.activeElement)) this.#returnTo = document.activeElement;
    target.focus();
  }

  /** Pause or resume every timer, e.g. from a "hold messages" setting. */
  hold(on = true) { this.#pause('api', on); }
}

defineComponent('sg-toast', SgToast);
defineComponent('sg-toast-region', SgToastRegion);

/** Show a toast in the page's region, making one at the end of <body> if there is none. */
export function toast(message, options = {}) {
  let region = document.querySelector('sg-toast-region');
  if (!region) { region = document.createElement('sg-toast-region'); document.body.append(region); }
  return region.show({ ...options, message });
}
