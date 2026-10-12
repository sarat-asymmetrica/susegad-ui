// QR: pure helpers beside the encoder. Runs in Node.
//
// The payloads people put in a code (a UPI link, a Wi-Fi network) and the little
// seeded drawing the warm and playful frames use.

import { rng } from '../../engine/src/rng.js';

// ── what people put in a code ───────────────────────────────────────────

/**
 * A UPI payment link, checked so a payer's app does not refuse it.
 * `pa` is the payee's address (handle@psp, no spaces). `am` is a positive amount: a number is
 * rounded to two places, a string must already be a plain decimal with at most two places
 * ('1e3', '-5' and '12.345' are refused, not guessed at). `cu` is INR in any case. `tn` is the
 * note, at most 80 characters (our cap: the NPCI linking spec was not to hand when this was
 * written). `tr` is the transaction reference, which merchant payments need.
 * @param {{ pa: string, pn?: string, am?: string|number, cu?: string, tn?: string, tr?: string }} p
 * @throws {TypeError} in plain words, naming the field
 */
export function upiPayload({ pa, pn, am, cu = 'INR', tn, tr }) {
  if (!pa) throw new TypeError('A UPI link needs the payee\'s UPI address (pa), such as name@bank.');
  if (!/^[\w.-]{2,256}@[A-Za-z][A-Za-z0-9]{1,64}$/.test(pa)) throw new TypeError(`"${pa}" is not a UPI address. Use handle@bank with no spaces, such as name@okaxis.`);
  if (String(cu).toUpperCase() !== 'INR') throw new TypeError(`UPI links are in rupees: use cu INR, not "${cu}".`);
  if (tn !== undefined && String(tn).length > 80) throw new TypeError(`The note is ${String(tn).length} characters; keep it to 80 or fewer so payment apps show it whole.`);
  let amount;
  if (am !== undefined && am !== '') {
    const n = typeof am === 'number' ? Math.round((am + Number.EPSILON) * 100) / 100 : /^\d+(\.\d{1,2})?$/.test(String(am).trim()) ? +String(am).trim() : NaN;
    if (!(n >= 0.01 && n < 1e10)) throw new TypeError(`The amount "${am}" is not valid: use a positive number of rupees with at most two decimal places, such as 2500 or 2500.50.`);
    amount = n.toFixed(2);
  }
  const enc = s => encodeURIComponent(String(s)).replace(/%40/g, '@');
  const parts = [['pa', pa], ['pn', pn], ['tr', tr], ['am', amount], ['cu', 'INR'], ['tn', tn]].filter(([, v]) => v !== undefined && v !== '');
  return 'upi://pay?' + parts.map(([k, v]) => `${k}=${enc(v)}`).join('&');
}

/**
 * A Wi-Fi network, in the form phones read from a code. `security` is WPA (also accepts WPA2 and
 * WPA3, which phones read as WPA), WEP or nopass.
 * @param {{ ssid: string, password?: string, security?: string, hidden?: boolean }} p
 * @throws {TypeError} for any other security type
 */
export function wifiPayload({ ssid, password = '', security, hidden = false }) {
  const esc = s => String(s).replace(/([\\;,:"])/g, '\\$1');
  const raw = String(security ?? (password ? 'WPA' : 'nopass')).toUpperCase();
  const t = /^WPA[23]?$/.test(raw) ? 'WPA' : raw === 'WEP' ? 'WEP' : raw === 'NOPASS' ? 'nopass' : null;
  if (!t) throw new TypeError(`Wi-Fi security "${security}" is not one a phone reads. Use WPA, WEP or nopass.`);
  return `WIFI:T:${t};S:${esc(ssid)};${t === 'nopass' ? '' : `P:${esc(password)};`}${hidden ? 'H:true;' : ''};`;
}

/**
 * The narrowest plate, in CSS px, that gives each module `pitch` px (2 is the least a phone camera
 * reads reliably). `units` is the drawn width in modules with the quiet zone; `fill` is the share
 * of the plate the picture takes (1 in quiet, 0.86 inside the warm and playful margin); the
 * 3 px are the plate's hairline and a pixel of headroom, so the rounding in the CSS never lands a hair under.
 */
export const minPlate = (units, fill = 1, pitch = 2) => (units * pitch) / fill + 3;

// ── the frame the warm and playful skins draw around the plate ──────────

/**
 * Two hand-ruled rectangles in a 0 to 100 box, as SVG path data: an outer rule
 * that wobbles a little and a thinner inner one, drawn the way a hand rules a
 * border. Same seed, same frame. The modules are never touched.
 * @returns {{ outer: string, inner: string }}
 */
export function framePaths(seed, { wobble = 0.7 } = {}) {
  const r = rng(`qr-frame|${seed}`);
  const side = (x0, y0, x1, y1) => {
    // a stroke along one side with a gentle bow, joined to the next by the corner point
    const bow = r.range(-wobble, wobble), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = y1 - y0, ny = x0 - x1, len = Math.hypot(nx, ny);
    return `Q${(mx + (nx / len) * bow).toFixed(2)} ${(my + (ny / len) * bow).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const rect = (a, w) => {
    const c = [[a, a], [100 - a, a], [100 - a, 100 - a], [a, 100 - a]].map(([x, y]) => [x + r.range(-w, w), y + r.range(-w, w)]);
    return `M${c[0][0].toFixed(2)} ${c[0][1].toFixed(2)}` + c.map((p, i) => side(...p, ...c[(i + 1) % 4])).join('') + 'z';
  };
  return { outer: rect(1.2, wobble * 0.5), inner: rect(3.6, wobble * 0.4) };
}

/** The playful frame draws on once when it first appears. Nothing moves in any other case. */
export const reveal = motion => (motion === 'full' ? { duration: 700, easing: 'cubic-bezier(.3,.7,.3,1)' } : null);
