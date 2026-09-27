// <sg-signature>: sign by hand, or by typing your name. The native path is a
// typed-name <input>, which submits with the form and works without JavaScript:
//
//   <sg-signature>
//     <label for="sig">Type your full name to sign</label>
//     <input id="sig" name="signature" autocomplete="name" required>
//   </sg-signature>
//
// With JavaScript it adds a pad to sign on with a finger, pen or mouse, "Undo
// last stroke" and "Start again" buttons, and a hidden input,
// <input type="hidden" name="signature-path">, holding the drawn ink as SVG
// path data in a 600 × 200 box. The typed name stays the keyboard way to sign
// and shows on the pad in the hand face. Either one satisfies `required`: the
// input keeps `required` until there is a drawing, then lets it go.
//
// Attributes: path-name (the hidden input's name; default "<name>-path"),
// seed (the flourish), register, data-value-missing (your wording).
// Properties: method ('drawn' | 'typed' | null), pathData, strokes (samples,
// get and set). Methods: undo(), clear(), toSVG(color).
// Event: sg-signature { method, strokes } whenever the signature changes.

import { SgElement, defineComponent } from '../../core/component.js';
import { stage } from '../../engine/src/stage.js';
import { STRINGS, PAD, ribbon, penFor, toPathData, toSVG } from './signature.core.js';

let uid = 0;
const make = (doc, tag, attrs, text) => {
  const n = doc.createElement(tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text) n.textContent = text;
  return n;
};

export class SgSignature extends SgElement {
  static native = 'input:not([type="hidden"])';
  static observedAttributes = ['register', 'seed'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #strokes = []; #live = null; #pid = null; #version = 0; #required = false;
  #parts = null; #off = []; #echo = false;

  /** The stage the skins paint on: canvas, logical units, device pixels. */
  pad = null;

  get method() { return this.#strokes.length ? 'drawn' : this.native?.value.trim() ? 'typed' : null; }
  get pathData() { return this.#parts?.path.value ?? ''; }
  get strokes() { return this.#strokes.map(s => s.pts.map(p => p.slice())); }
  set strokes(list) {
    this.#strokes = (list || []).filter(p => p.length).map(pts => ({ pts, pen: false, done: -1e9 }));
    this.#changed();
  }
  toSVG(color) { return toSVG(this.pathData, color); }

  /** Take away the last stroke. */
  undo() {
    if (!this.#strokes.length) return;
    this.#strokes.pop();
    this.#changed(this.#strokes.length ? '' : STRINGS.cleared);
  }
  /** Clear the drawing and the typed name. */
  clear() {
    const had = this.#strokes.length || this.native?.value;
    this.#strokes = [];
    if (this.native) this.native.value = '';
    this.#changed(had ? STRINGS.cleared : '');
  }

  connected() {
    const input = this.native, doc = this.ownerDocument;
    if (!input) { console.warn('sg-signature: put a typed-name <input> inside, so people can sign without a pointer and without JavaScript.'); return; }
    const id = input.id || (input.id = `sg-signature-${++uid}`);
    this.#required = input.required || this.hasAttribute('required');

    const help = make(doc, 'p', { class: 'sg-signature-help', id: `${id}-help` }, STRINGS.help);
    const box = make(doc, 'div', { class: 'sg-signature-pad', 'aria-hidden': 'true' });
    const tools = make(doc, 'div', { class: 'sg-signature-tools' });
    const undo = make(doc, 'button', { type: 'button', class: 'sg-signature-undo' }, STRINGS.undo);
    const clear = make(doc, 'button', { type: 'button', class: 'sg-signature-clear' }, STRINGS.clear);
    const status = make(doc, 'p', { class: 'sg-signature-status', role: 'status' });
    const path = make(doc, 'input', { type: 'hidden', name: this.getAttribute('path-name') || `${input.name || 'signature'}-path` });
    tools.append(undo, clear);
    this.prepend(help, box, tools);
    this.append(status, path);
    this.#parts = { help, box, tools, undo, clear, status, path };
    input.setAttribute('aria-describedby', [...new Set([...(input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), help.id])].join(' '));

    this.pad = stage(box, { W: PAD.W, H: PAD.H });
    const cv = this.pad.canvas;
    cv.style.touchAction = 'none';
    this.pad.onresize = () => this.update();

    const on = (t, type, fn) => { t.addEventListener(type, fn); this.#off.push(() => t.removeEventListener(type, fn)); };
    on(cv, 'pointerdown', this.#down);
    on(cv, 'pointermove', this.#move);
    on(cv, 'pointerup', this.#up);
    on(cv, 'pointercancel', this.#up);
    // a button that disables itself would drop keyboard focus on the page; hand it to the name
    on(undo, 'click', () => { this.undo(); if (undo.disabled) input.focus(); });
    on(clear, 'click', () => { this.clear(); this.native.focus(); });
    on(input, 'input', () => { if (!this.#echo) this.#changed(); });
    if (input.form) on(input.form, 'reset', () => setTimeout(() => { this.#strokes = []; this.#changed(); }));
    this.dataset.enhanced = '';
    this.#changed();
  }

  disconnected() {
    this.#off.splice(0).forEach(f => f());
    this.pad?.destroy(); this.pad = null;
    if (this.#parts) for (const k of ['help', 'box', 'tools', 'status', 'path']) this.#parts[k].remove();
    this.#parts = null;
    delete this.dataset.enhanced;
    if (this.native) {
      this.native.required = this.#required;
      this.native.setCustomValidity('');
    }
  }

  #sample(e) {
    const [x, y] = this.pad.toLogical(e.clientX, e.clientY);
    return [x, y, e.timeStamp, e.pressure];
  }
  #down = e => {
    if (e.button > 0 || this.native.matches(':disabled')) return;
    e.preventDefault();
    this.pad.canvas.setPointerCapture?.(e.pointerId);
    this.#pid = e.pointerId;
    this.#live = { pts: [this.#sample(e)], pen: e.pointerType === 'pen' };
    this.update();
  };
  #move = e => {
    if (e.pointerId !== this.#pid || !this.#live) return;
    for (const c of e.getCoalescedEvents?.() ?? [e]) this.#live.pts.push(this.#sample(c));
    this.update();
  };
  #up = e => {
    if (e.pointerId !== this.#pid || !this.#live) return;
    const s = this.#live;
    this.#pid = null; this.#live = null;
    s.done = performance.now();
    this.#strokes.push(s);
    this.#changed(this.#strokes.length === 1 ? STRINGS.signed : '', true);
  };

  /** Everything that follows a change: the hidden value, validity, buttons, words, the skin. */
  #changed(say = '', drawn = false) {
    const p = this.#parts;
    if (!p) return;
    this.#version++;
    p.path.value = toPathData(this.#polys());
    const typed = this.native.value.trim();
    const missing = this.#required && !this.#strokes.length && !typed;
    // `required` stays on the input (so assistive tech and tools see it) until a drawing signs instead
    this.native.required = this.#required && !this.#strokes.length;
    this.native.setCustomValidity(missing ? this.getAttribute('data-value-missing') || STRINGS.required : '');
    const off = this.native.matches(':disabled');
    p.undo.disabled = off || !this.#strokes.length;
    p.clear.disabled = off || (!this.#strokes.length && !this.native.value);
    if (say) p.status.textContent = say;
    else if (!this.#strokes.length) p.status.textContent = '';
    if (drawn || say) {
      // tell validation helpers (such as <sg-field-note validate>) the field changed
      this.#echo = true;
      this.native.dispatchEvent(new Event('input', { bubbles: true }));
      this.#echo = false;
    }
    this.update();
    this.emit('sg-signature', { method: this.method, strokes: this.#strokes.length });
  }

  /** Each stroke's ribbon in the current register's pen, cached until the register changes. */
  #polys() {
    const reg = this.register, opts = penFor(reg);
    return this.#strokes.map(s => {
      if (s.reg !== reg) { s.poly = ribbon(s.pts, { ...opts, pen: s.pen }); s.reg = reg; }
      return s.poly;
    });
  }

  state() {
    const live = this.#live, polys = this.#polys();
    // a register change re-inks the strokes; keep what is submitted equal to what is shown
    if (this.#parts && this.#parts.reg !== this.register) { this.#parts.reg = this.register; this.#parts.path.value = toPathData(polys); }
    return {
      version: this.#version,
      strokes: this.#strokes,
      live: live ? { poly: ribbon(live.pts, { ...penFor(this.register), pen: live.pen }) } : null,
      name: this.native?.value.trim() ?? '',
      seed: this.getAttribute('seed') || 'signature',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-signature', SgSignature);
