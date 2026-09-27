// <sg-file-drop>: a file input you can also drop files onto.
//
//   <sg-file-drop max-size="10 MB">
//     <label for="plans">Floor plans <span>PDF or JPG, up to 10 MB each</span></label>
//     <input type="file" id="plans" name="plans" accept=".pdf,image/jpeg" multiple>
//   </sg-file-drop>
//
// Without JavaScript it is the native input and submits with the form. With
// it, the input grows to cover a drop zone and stays the real control: click,
// Enter or Space open the picker, and a dropped file lands in the input
// itself, so the form still sends it. The element checks what the browser
// does not check on a drop (accept, size, how many), lists what was chosen
// with a Remove button each, and says every change in words. With `handoff`,
// for pages that take the files at once (an uploader), it only hands them over.

import { SgElement, defineComponent } from '../../core/component.js';
import { STRINGS, sift, parseSize, formatSize } from './file-drop.core.js';

export { STRINGS, sift, accepts, describeAccept, formatSize, parseSize } from './file-drop.core.js';

const mk = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text ?? '' });

export class SgFileDrop extends SgElement {
  static native = 'input[type=file]';
  static observedAttributes = ['register', 'max-size'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  hover = false; seq = 0; last = null;
  #zone = null; #cue = null; #list = null; #note = null; #moved = []; #off = []; #depth = 0;

  connected() {
    const input = this.native;
    if (!input) return;
    // the label and input move into a zone the input covers; they go back on disconnect
    this.#zone = mk('div', 'sg-file-drop-zone');
    this.#cue = mk('span', 'sg-file-drop-cue', STRINGS.cue(input.multiple));
    this.#cue.setAttribute('aria-hidden', 'true'); // the label names the input; this is the visual prompt
    const label = input.labels?.[0] && this.contains(input.labels[0]) ? input.labels[0] : null;
    this.#moved = [label, input].filter(Boolean).map(n => { const home = document.createComment('sg-file-drop'); n.replaceWith(home); return [n, home]; });
    this.#zone.append(...this.#moved.map(([n]) => n), this.#cue);
    this.#list = mk('ul', 'sg-file-drop-list');
    this.#note = mk('p', 'sg-file-drop-note');
    this.#note.setAttribute('role', 'status');
    this.append(this.#zone);
    if (!this.hasAttribute('handoff')) this.append(this.#list, this.#note);
    this.setAttribute('data-enhanced', '');

    const on = (el, type, fn) => { el.addEventListener(type, fn); this.#off.push(() => el.removeEventListener(type, fn)); };
    on(input, 'change', () => this.#take());
    on(this.#zone, 'dragenter', e => { if (this.#hasFiles(e)) { this.#depth++; this.#setHover(true); } });
    on(this.#zone, 'dragleave', () => { if (--this.#depth <= 0) { this.#depth = 0; this.#setHover(false); } });
    on(this.#zone, 'drop', () => { this.#depth = 0; this.#setHover(false); });
    // a drop anywhere on the zone (not only the input) still lands in the input
    on(this.#zone, 'dragover', e => { if (this.#hasFiles(e)) e.preventDefault(); });
    on(this.#zone, 'drop', e => {
      if (e.target === input || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    on(this.#list, 'click', e => {
      const b = e.target.closest('button[data-index]');
      if (b) this.remove(+b.dataset.index);
    });
    this.#render([]);
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    for (const [n, home] of this.#moved) home.replaceWith(n);
    this.#moved = [];
    this.#zone?.remove(); this.#list?.remove(); this.#note?.remove();
    this.removeAttribute('data-enhanced');
  }

  #hasFiles(e) { return [...(e.dataTransfer?.types ?? [])].includes('Files'); }
  #setHover(v) { if (v !== this.hover) { this.hover = v; this.toggleAttribute('data-hover', v); this.update(); } }

  /** Check what just arrived in the input, keep what may stay, and say what happened. */
  #take() {
    const input = this.native, files = [...input.files];
    // handoff: a page that takes files the moment they arrive (an uploader) does its own
    // checking, listing and saying; the zone only hands the files over and posts the letter
    if (this.hasAttribute('handoff')) {
      if (!files.length) return;
      this.seq++;
      this.last = 'added';
      this.emit('sg-files', { files, messages: [] });
      this.update();
      return;
    }
    const { kept, messages } = sift(files, { accept: input.accept, maxSize: parseSize(this.getAttribute('max-size')), multiple: input.multiple });
    if (kept.length !== files.length) this.#setFiles(kept.map(i => files[i]));
    this.seq++;
    this.last = kept.length ? 'added' : messages.length ? 'turned-away' : 'cleared';
    this.#render(messages);
    this.emit('sg-files', { files: [...input.files], messages });
    this.update();
  }

  #setFiles(list) {
    const dt = new DataTransfer();
    list.forEach(f => dt.items.add(f));
    this.native.files = dt.files;
  }

  /** Remove one chosen file, and put focus somewhere sensible. */
  remove(i) {
    const files = [...this.native.files], gone = files[i];
    if (!gone) return;
    this.#setFiles(files.filter((_, k) => k !== i));
    this.last = 'removed';
    this.#render([STRINGS.removed(gone.name)]);
    const next = this.#list.querySelectorAll('button')[Math.min(i, this.native.files.length - 1)];
    (next ?? this.native).focus();
    this.native.dispatchEvent(new Event('input', { bubbles: true }));
    this.emit('sg-files', { files: [...this.native.files], messages: [] });
    this.update();
  }

  #render(messages) {
    const files = [...this.native.files];
    this.#list.replaceChildren(...files.map((f, i) => {
      const li = mk('li', 'sg-file-drop-file');
      const b = mk('button', 'sg-file-drop-remove', '×');
      b.type = 'button'; b.dataset.index = i;
      b.setAttribute('aria-label', STRINGS.remove(f.name));
      li.append(mk('span', 'sg-file-drop-name', f.name), mk('span', 'sg-file-drop-size', formatSize(f.size)), b);
      return li;
    }));
    this.#note.textContent = [STRINGS.chosen(files.length), ...messages].join(' ');
  }

  state() {
    return { count: this.native?.files.length ?? 0, hover: this.hover, seq: this.seq, last: this.last, multiple: !!this.native?.multiple };
  }
}

defineComponent('sg-file-drop', SgFileDrop);
