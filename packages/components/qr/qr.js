// <sg-qr>: a QR code as an image, with its words beside it. The words are the
// builder's own markup (a UPI link, a ticket number, a Wi-Fi name), so they stay
// readable, selectable and copyable; the code is a drawn picture of them.
//
//   <sg-qr value="upi://pay?pa=shop@okaxis&am=2500" label="QR code for the UPI payment link">
//     <p>Pay <strong>₹2,500</strong> to Casa Exemplo</p>
//   </sg-qr>
//
//   <sg-qr label="Wi-Fi code">WIFI:T:WPA;S:Casa;P:secret;;</sg-qr>    (no value: the text is the value)
//
// Attributes: value, ecc (L | M | Q | H, default M), label (the picture's
// accessible name), size (the plate's width: a number is px, or 12rem and so on), register.
// Properties: value, symbol (the matrix, or null). Events: sg-qr { version, ecc, mode, size } when
// drawn, sg-qr-error { message } when the value will not fit.
// The plate is never narrower than 2 CSS px per module, whatever `size` says.
// Without JavaScript the words show and the picture does not.

import { SgElement, defineComponent } from '../../core/component.js';
import { encode, pathData, eccOf, STRINGS } from './qr.core.js';

const NS = 'http://www.w3.org/2000/svg';
const LENGTH = /^\d*\.?\d+(px|rem|em|ch|vw|vh|%)?$/;

export class SgQr extends SgElement {
  static observedAttributes = ['register', 'value', 'ecc', 'label', 'size'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #plate = null; #svg = null; #path = null; #text = null; #mo = null; #sym = null;

  /** What the code says: the `value` attribute, else the element's own words. */
  get value() { return this.getAttribute('value') ?? this.#text?.textContent.trim().replace(/\s+/g, ' ') ?? ''; }
  /** The matrix last drawn ({ version, size, ecc, mode, mask, rows }), or null when there is none. */
  get symbol() { return this.#sym; }

  connected() {
    if (this.#plate) return;
    const doc = this.ownerDocument;
    this.#text = doc.createElement('div');
    this.#text.className = 'sg-qr-text';
    this.#text.append(...this.childNodes);
    this.#plate = doc.createElement('div');
    this.#plate.className = 'sg-qr-plate';
    this.#plate.hidden = true;
    this.append(this.#plate, this.#text);
    this.#mo = new MutationObserver(() => { if (!this.hasAttribute('value')) this.#draw(); });
    this.#mo.observe(this.#text, { childList: true, characterData: true, subtree: true });
    this.#draw();
  }

  disconnected() { this.#mo?.disconnect(); }

  attributeChangedCallback(name, old, now) {
    super.attributeChangedCallback(name, old, now);
    if (old !== now && this.#plate && name !== 'register') this.#draw();
  }

  #draw() {
    const plate = this.#plate, doc = this.ownerDocument;
    const size = this.getAttribute('size');
    if (size && LENGTH.test(size)) this.style.setProperty('--sg-qr-size', /^\d*\.?\d+$/.test(size) ? `${size}px` : size);
    else this.style.removeProperty('--sg-qr-size');

    let sym = null, error = null;
    const value = this.value;
    if (value) {
      try { sym = encode(value, { ecc: eccOf(this.getAttribute('ecc')) }); } catch (e) { error = e.message; }
    }
    this.#sym = sym;
    if (sym) this.style.setProperty('--sg-qr-units', String(sym.size + 8)); else this.style.removeProperty('--sg-qr-units');
    this.toggleAttribute('data-error', !!error);
    plate.hidden = !sym;
    if (error) { console.warn(`sg-qr: ${error}`); this.emit('sg-qr-error', { message: error }); }
    if (sym) {
      if (!this.#svg) {
        const svg = this.#svg = doc.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'sg-qr-code');
        svg.setAttribute('role', 'img');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('focusable', 'false');
        const light = doc.createElementNS(NS, 'rect');
        light.setAttribute('class', 'sg-qr-light');
        light.setAttribute('width', '100%');
        light.setAttribute('height', '100%');
        this.#path = doc.createElementNS(NS, 'path');
        this.#path.setAttribute('class', 'sg-qr-dark');
        svg.append(light, this.#path);
        plate.prepend(svg);
      }
      const { size: units, d } = pathData(sym.rows);
      this.#svg.setAttribute('viewBox', `0 0 ${units} ${units}`);
      this.#svg.setAttribute('aria-label', this.getAttribute('label') || STRINGS.label);
      this.#path.setAttribute('d', d);
      this.emit('sg-qr', { version: sym.version, ecc: sym.ecc, mode: sym.mode, size: sym.size });
    }
    this.update();
  }

  state() {
    return { seed: this.value, modules: this.#sym?.size ?? 0, motion: this.motion, visible: this.visible };
  }
}

defineComponent('sg-qr', SgQr);
