// <sg-reach>: a contact block. Email and WhatsApp are real links that work
// with no JavaScript; a copy-the-number button appears only where the
// clipboard can be used, and says in words that it worked.
//
//   <sg-reach>
//     <address>
//       <p class="sg-reach-line"><span class="sg-reach-label">Email</span>
//         <a href="mailto:hello@example.com">hello@example.com</a></p>
//       <p class="sg-reach-line"><span class="sg-reach-label">WhatsApp</span>
//         <a href="https://wa.me/919800000000?text=Hello">+91 98000 00000</a>
//         <button type="button" class="sg-reach-copy" data-copy="+91 98000 00000" hidden>Copy number</button></p>
//       <p class="sg-reach-when">Replies usually come the same day.</p>
//     </address>
//   </sg-reach>
//
// Build the links with waLink() and mailtoLink() from reach.core.js.
// Attributes: seed (the playful frame's ink), register. Event: sg-reach-copy { value, ok }.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS } from './reach.core.js';

async function copyText(value, doc) {
  try { await navigator.clipboard.writeText(value); return true; } catch { /* fall through */ }
  try {
    const t = doc.createElement('textarea');
    t.value = value; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    doc.body.append(t); t.select();
    const ok = doc.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

export class SgReach extends SgElement {
  static native = 'address';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #status = null; #off = []; #timers = new Set();

  connected() {
    const box = this.native;
    if (!box) { console.warn('sg-reach: put the contact lines in an <address>.'); return; }
    const buttons = [...box.querySelectorAll('button.sg-reach-copy[data-copy]')];
    const canCopy = !!navigator.clipboard?.writeText || !!this.ownerDocument.queryCommandSupported?.('copy');
    if (!buttons.length || !canCopy) return;
    this.#status = this.ownerDocument.createElement('p');
    this.#status.className = 'sg-reach-status';
    this.#status.setAttribute('role', 'status');
    box.append(this.#status);
    for (const b of buttons) {
      b.hidden = false;
      const label = b.textContent.trim() || STRINGS.copy;
      const onClick = async () => {
        const value = b.dataset.copy;
        const ok = await copyText(value, this.ownerDocument);
        this.#say(ok ? STRINGS.copiedLine(value) : STRINGS.failedLine(value));
        if (ok) { b.textContent = STRINGS.copied; this.#later(() => { b.textContent = label; }, 2500); }
        this.emit('sg-reach-copy', { value, ok });
        this.update();
      };
      b.addEventListener('click', onClick);
      this.#off.push(() => { b.removeEventListener('click', onClick); b.hidden = true; b.textContent = label; });
    }
  }
  disconnected() {
    this.#off.splice(0).forEach(f => f());
    this.#timers.forEach(clearTimeout); this.#timers.clear();
    this.#status?.remove();
  }

  #later(fn, ms) { const t = setTimeout(() => { this.#timers.delete(t); fn(); }, ms); this.#timers.add(t); }
  /** Say it once, then clear the line so the next press is news again. */
  #say(text) {
    this.#status.textContent = text;
    this.#later(() => { if (this.#status.textContent === text) this.#status.textContent = ''; }, 6000);
  }

  state() {
    return { seed: this.getAttribute('seed') || (this.native?.textContent.trim().slice(0, 40) ?? ''), motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-reach', SgReach);
