// <sg-chat-thread>: a conversation shown as text, not a screenshot. The list
// is the meaning; the skins add a ruled transcript, inked bubbles or bright
// ones, all aria-hidden.
//
//   <sg-chat-thread>
//     <ol aria-label="A conversation with Aldona Organics">
//       <li class="sg-chat-day"><time datetime="2026-03-04">4 March 2026</time></li>
//       <li data-from="them"><span class="sg-chat-who">Maya, Aldona Organics</span>
//         <p class="sg-chat-text">Can we move the shoot to Friday?</p>
//         <time class="sg-chat-time" datetime="2026-03-04T10:12">10:12</time></li>
//       <li data-from="me" data-status="read">…</li>
//     </ol>
//   </sg-chat-thread>
//
// Redact at build time with redact() or renderThread() from chat-thread.core.js:
// the element never sees the original text, so it can't leak it.
//
// Attributes: label (the list's name, when the markup gives none), register.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, leakIn, reactionLabel } from './chat-thread.core.js';

export class SgChatThread extends SgElement {
  static native = 'ol, ul';
  static observedAttributes = ['register', 'label'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #mo = null; #version = 0;

  connected() {
    if (!this.native) { console.warn('sg-chat-thread: put the messages in an <ol>, one <li> each.'); return; }
    this.#tag();
    // A server may append messages (htmx hx-swap="beforeend"): keep runs and ink in step.
    this.#mo = new MutationObserver(() => { this.#tag(); this.update(); });
    this.#mo.observe(this.native, { childList: true });
  }
  disconnected() { this.#mo?.disconnect(); }

  /** The messages, in order: every <li> that isn't a date divider. */
  get messages() { return this.native ? [...this.native.children].filter(li => li.localName === 'li' && !li.classList.contains('sg-chat-day')) : []; }

  #tag() {
    const list = this.native;
    if (!list.hasAttribute('aria-label') && !list.hasAttribute('aria-labelledby')) list.setAttribute('aria-label', this.getAttribute('label') || STRINGS.label);
    let prev = null;
    for (const li of list.children) {
      if (li.localName !== 'li') continue;
      if (li.classList.contains('sg-chat-day')) { prev = null; continue; }
      if (li.dataset.from !== 'me') li.dataset.from = 'them';
      const who = li.querySelector(':scope > .sg-chat-who')?.textContent.trim() ?? '';
      const key = `${li.dataset.from}|${who}`;
      if (key === prev) li.dataset.run = 'continue'; else delete li.dataset.run;
      prev = key;
    }
    // A reaction is read once, as words: role="img" with a label hides the emoji itself.
    for (const r of list.querySelectorAll('.sg-chat-reaction')) {
      if (r.getAttribute('role') !== 'img') r.setAttribute('role', 'img');
      if (!r.hasAttribute('aria-label')) r.setAttribute('aria-label', reactionLabel(r.textContent));
      // Chromium still exposes an image's text children; hide the emoji so only the words are read.
      if (!r.querySelector('[aria-hidden="true"]')) { const e = this.ownerDocument.createElement('span'); e.setAttribute('aria-hidden', 'true'); e.append(...r.childNodes); r.append(e); }
    }
    // A quoted reply says what it is before what it quotes.
    for (const q of list.querySelectorAll('.sg-chat-reply')) {
      if (q.querySelector('.sg-chat-sr')) continue;
      const sr = this.ownerDocument.createElement('span');
      sr.className = 'sg-chat-sr';
      sr.textContent = `${STRINGS.replyingTo} `;
      q.prepend(sr);
    }
    for (const m of list.querySelectorAll('.sg-redacted')) {
      const why = leakIn(m.textContent);
      if (why) console.warn(`sg-chat-thread: a redaction marker still carries text (${why}). Redact at build time with redact() so the original never reaches the page.`, m);
    }
    this.#version++;
  }

  state() {
    return { version: this.#version, count: this.messages.length, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-chat-thread', SgChatThread);
