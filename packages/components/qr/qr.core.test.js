import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import { encode, codewords, capacity, modeOf, penalty, pathData, eccOf, ECC_LEVELS } from './qr.core.js';
import { upiPayload, wifiPayload, framePaths, reveal, minPlate } from './qr.helpers.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const hex = list => list.map(b => b.toString(16).padStart(2, '0')).join(' ');
const sha = rows => createHash('sha256').update(rows.join('')).digest('hex');

/** Render a symbol as the RGBA image a camera frame would give, and let an independent decoder read it. */
function scan(sym, scale = 4, quiet = 4) {
  const n = (sym.size + 2 * quiet) * scale, px = new Uint8ClampedArray(n * n * 4).fill(255);
  sym.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '1') return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * n + (x + quiet) * scale + dx) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }));
  return jsQR(px, n, n);
}

test('the ISO/IEC 18004 Annex example: "01234567" at 1-M packs to the published codewords', () => {
  // data codewords then the ten error-correction codewords, as printed in the Annex worked example
  assert.equal(hex(codewords('01234567', 'numeric', 1, 'M')),
    '10 20 0c 56 61 80 ec 11 ec 11 ec 11 ec 11 ec 11 a5 24 d4 c1 ed 36 c7 87 2c 55');
  const s = encode('01234567', { ecc: 'M' });
  assert.deepEqual([s.version, s.size, s.mode, s.mask], [1, 21, 'numeric', 0], 'version 1, 21 modules, numeric; the lowest-penalty mask is 0, as the reference encoder also finds');
});

test('matrices equal those from the reference encoder (nayuki-qr-code-generator 1.8.0), module for module', () => {
  const { vectors } = fixture('vectors');
  assert.ok(vectors.length >= 14);
  for (const v of vectors) {
    const s = encode(v.text, { ecc: v.ecc });
    assert.equal(s.version, v.version, `${v.name}: version`);
    assert.equal(s.mask, v.mask, `${v.name}: mask`);
    assert.deepEqual(s.rows, v.rows, `${v.name}: modules`);
  }
});

test('every version at every level (160 symbols) hashes to the reference encoder\'s', () => {
  const { sweep } = fixture('sweep');
  assert.equal(Object.keys(sweep).length, 160, 'all 40 versions at 4 levels');
  for (const [key, want] of Object.entries(sweep)) {
    const [v, ecc] = key.split('-');
    const text = Array.from({ length: want.length }, (_, i) => String.fromCharCode(97 + ((i * 7 + +v) % 26))).join('');
    const s = encode(text, { ecc });
    assert.equal(s.version, +v, `${key}: version`);
    assert.equal(s.mask, want.mask, `${key}: mask`);
    assert.equal(sha(s.rows), want.sha, `${key}: modules`);
  }
});

test('an independent decoder (jsQR) reads what we make, across modes, levels and sizes', () => {
  const texts = ['01234567', 'HELLO WORLD', 'https://susegad.dev/ui', 'upi://pay?pa=casaexemplo@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR',
    '₹2,500 · राखून ठेवले', 'Casa Exemplo, Colvale, Goa', 'x'.repeat(300), '7'.repeat(500)];
  for (const text of texts) for (const ecc of ECC_LEVELS) {
    const s = encode(text, { ecc }), got = scan(s);
    assert.ok(got, `decoded ${s.version}-${ecc} ${text.slice(0, 20)}`);
    assert.equal(got.data, text, `${s.version}-${ecc} round trip`);
  }
});

test('the decoder check can fail: scramble the data area and it no longer reads back', () => {
  const text = 'upi://pay?pa=casaexemplo@okaxis';
  const s = encode(text, { ecc: 'L' });
  assert.equal(scan(s)?.data, text, 'intact, it reads');
  const broken = { ...s, rows: s.rows.map((r, y) => (y > 12 && y < 20 ? r.replace(/./g, (c, x) => (x > 10 ? (c === '1' ? '0' : '1') : c)) : r)) };
  assert.ok(scan(broken)?.data !== text);
});

test('mode: numeric, then alphanumeric (capitals), else byte', () => {
  assert.equal(modeOf('0123'), 'numeric');
  assert.equal(modeOf('HELLO $%*+-./: 1'), 'alphanumeric');
  assert.equal(modeOf('hello'), 'byte');
  assert.equal(modeOf('₹1'), 'byte');
  assert.equal(modeOf(''), 'numeric');
  assert.equal(encode('ticket-0042').mode, 'byte', 'lower case is not in the alphanumeric set');
});

test('capacity matches the published table: V1, V10 and V40, every level and mode', () => {
  const want = { // [numeric, alphanumeric, byte]
    '1-L': [41, 25, 17], '1-M': [34, 20, 14], '1-Q': [27, 16, 11], '1-H': [17, 10, 7],
    '40-L': [7089, 4296, 2953], '40-M': [5596, 3391, 2331], '40-Q': [3993, 2420, 1663], '40-H': [3057, 1852, 1273],
    '10-M': [513, 311, 213],
  };
  for (const [k, w] of Object.entries(want)) {
    const [v, ecc] = k.split('-');
    assert.deepEqual(['numeric', 'alphanumeric', 'byte'].map(m => capacity(+v, ecc, m)), w, k);
  }
});

test('the most each level holds fits in version 40, and one more byte is refused with a plain message', () => {
  for (const [ecc, max] of [['L', 2953], ['M', 2331], ['Q', 1663], ['H', 1273]]) {
    const s = encode('b'.repeat(max), { ecc });
    assert.equal(s.version, 40, ecc);
    assert.equal(s.size, 177);
    assert.throws(() => encode('b'.repeat(max + 1), { ecc }), err => err instanceof RangeError && /too long/.test(err.message) && err.message.includes(String(max)), ecc);
  }
  assert.equal(encode('9'.repeat(7089), { ecc: 'L' }).version, 40);
  assert.throws(() => encode('9'.repeat(7090), { ecc: 'L' }), RangeError);
});

test('version grows only as needed, and minVersion and maxVersion are honoured', () => {
  assert.equal(encode('a'.repeat(17), { ecc: 'L' }).version, 1);
  assert.equal(encode('a'.repeat(18), { ecc: 'L' }).version, 2);
  assert.equal(encode('a', { minVersion: 7 }).version, 7);
  assert.throws(() => encode('a'.repeat(100), { ecc: 'M', maxVersion: 3 }), RangeError);
});

test('empty text is a valid, empty symbol at version 1', () => {
  const s = encode('');
  assert.equal(s.version, 1);
  assert.equal(s.rows.length, 21);
  assert.equal(encode(undefined).rows.join(), s.rows.join());
});

test('UTF-8: the rupee sign and Devanagari travel as bytes and read back', () => {
  const text = '₹ 25,500 मिळाले';
  const s = encode(text, { ecc: 'M' });
  assert.equal(s.mode, 'byte');
  assert.equal(scan(s)?.data, text);
  assert.equal(new TextEncoder().encode('₹').length, 3);
});

test('a realistic UPI payload is a small symbol on a phone-sized plate', () => {
  const link = upiPayload({ pa: 'casaexemplo@okaxis', pn: 'Casa Exemplo', am: '25500.00', tn: 'Booking 12 to 15 Oct' });
  const s = encode(link, { ecc: 'M' });
  assert.ok(s.version <= 7, `version ${s.version}`);
  assert.equal(scan(s)?.data, link);
});

test('the structure is right: finders, timing, the always-dark module, a forced mask', () => {
  const s = encode('A', { ecc: 'M', mask: 5 });
  assert.equal(s.mask, 5);
  const at = (x, y) => s.rows[y][x];
  assert.equal(s.rows[0].slice(0, 7), '1111111');
  assert.equal(s.rows[3].slice(0, 7), '1011101');
  assert.equal(at(8, s.size - 8), '1', 'the dark module');
  for (let i = 8; i < s.size - 8; i++) assert.equal(at(6, i), i % 2 === 0 ? '1' : '0', 'timing column');
  assert.notEqual(encode('A', { mask: 0 }).rows.join(), encode('A', { mask: 1 }).rows.join());
});

test('penalty scores what scanners dislike, and can fail: a blank grid scores worse than a real symbol', () => {
  const s = encode('HELLO WORLD', { ecc: 'Q' });
  const flat = new Uint8Array(s.size * s.size);
  const real = Uint8Array.from(s.rows.join(''), c => +c);
  assert.ok(penalty(flat, s.size) > penalty(real, s.size) + 500);
  // rule 3: a 1:1:3:1:1 shape with four or more light modules on both sides costs 40 for each side, against five dark modules in another order
  const n = 21, shape = new Uint8Array(n * n), broken = new Uint8Array(n * n);
  [0, 2, 3, 4, 6].forEach(x => { shape[10 * n + 5 + x] = 1; });
  [0, 2, 3, 5, 6].forEach(x => { broken[10 * n + 5 + x] = 1; });
  assert.equal(penalty(shape, n) - penalty(broken, n), 80);
});

test('the chosen mask is the lowest-penalty one', () => {
  const text = 'https://susegad.dev/ui', s = encode(text, { ecc: 'L' });
  const pen = mk => penalty(Uint8Array.from(encode(text, { ecc: 'L', mask: mk }).rows.join(''), c => +c), s.size);
  const all = Array.from({ length: 8 }, (_, k) => pen(k));
  assert.equal(all[s.mask], Math.min(...all));
});

test('pathData draws exactly the dark modules, with a four-module quiet zone', () => {
  const s = encode('HELLO WORLD', { ecc: 'M' });
  const p = pathData(s.rows);
  assert.equal(p.size, s.size + 8);
  const grid = Array.from({ length: s.size }, () => Array(s.size).fill('0'));
  for (const [, x, y, w] of p.d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < +w; i++) grid[+y - 4][+x - 4 + i] = '1';
  assert.deepEqual(grid.map(r => r.join('')), s.rows);
  assert.equal(pathData(s.rows, 0).size, s.size);
});

test('upiPayload builds a pay link, keeps the payee address readable and formats the amount to two places', () => {
  assert.equal(upiPayload({ pa: 'shop@okaxis', pn: 'Casa Exemplo', am: 25500 }), 'upi://pay?pa=shop@okaxis&pn=Casa%20Exemplo&am=25500.00&cu=INR');
  assert.equal(upiPayload({ pa: 'shop@okaxis', tn: 'Booking ₹ & more' }), 'upi://pay?pa=shop@okaxis&cu=INR&tn=Booking%20%E2%82%B9%20%26%20more');
  assert.throws(() => upiPayload({}), TypeError);
});

test('upiPayload amounts: a positive decimal with at most two places, no float noise, nothing else', () => {
  const am = v => upiPayload({ pa: 'shop@okaxis', am: v }).match(/am=([^&]*)/)[1];
  assert.equal(am(0.1 + 0.2), '0.30');
  assert.equal(am(25500), '25500.00');
  assert.equal(am(1.005), '1.01');
  assert.equal(am('2500'), '2500.00');
  assert.equal(am('2500.5'), '2500.50');
  assert.equal(am(' 12.34 '), '12.34');
  for (const bad of [-5, 0, NaN, Infinity, 0.004, 1e12, '-5', '1e3', '12.345', 'abc', '1,500', '0', '0.00', '.5']) {
    assert.throws(() => upiPayload({ pa: 'shop@okaxis', am: bad }), err => err instanceof TypeError && /amount/i.test(err.message), `rejects ${bad}`);
  }
});

test('upiPayload currency: INR in any case, nothing else', () => {
  assert.match(upiPayload({ pa: 'shop@okaxis', cu: 'inr' }), /cu=INR/);
  assert.throws(() => upiPayload({ pa: 'shop@okaxis', cu: 'usd' }), err => err instanceof TypeError && /INR/.test(err.message));
});

test('upiPayload payee address: handle@psp with no spaces', () => {
  for (const ok of ['casaexemplo@okaxis', 'a.b-c_d@ybl', '9822012345@paytm']) assert.doesNotThrow(() => upiPayload({ pa: ok }), ok);
  for (const bad of ['a b@bank', 'nobank', '@bank', 'a@', 'a@b@c', 'a@ba nk', 'x@1bank', 'x@b']) {
    assert.throws(() => upiPayload({ pa: bad }), err => err instanceof TypeError && /UPI address/.test(err.message), `rejects ${bad}`);
  }
});

test('upiPayload note: at most 80 characters (our cap; the linking spec was not available to check)', () => {
  assert.doesNotThrow(() => upiPayload({ pa: 'shop@okaxis', tn: 'x'.repeat(80) }));
  assert.throws(() => upiPayload({ pa: 'shop@okaxis', tn: 'x'.repeat(81) }), err => err instanceof TypeError && /80/.test(err.message));
});

test('wifiPayload escapes the characters the format reserves', () => {
  assert.equal(wifiPayload({ ssid: 'Casa Exemplo', password: 'hunter2' }), 'WIFI:T:WPA;S:Casa Exemplo;P:hunter2;;');
  assert.equal(wifiPayload({ ssid: 'a;b', password: 'p:w\\d', hidden: true }), 'WIFI:T:WPA;S:a\\;b;P:p\\:w\\\\d;H:true;;');
  assert.equal(wifiPayload({ ssid: 'Open' }), 'WIFI:T:nopass;S:Open;;');
});

test('wifiPayload security: WPA2 and WPA3 are WPA to a phone; WEP and nopass pass; anything else is refused plainly', () => {
  const t = security => wifiPayload({ ssid: 's', password: 'p', security }).match(/T:([^;]*)/)[1];
  assert.equal(t('WPA2'), 'WPA');
  assert.equal(t('wpa3'), 'WPA');
  assert.equal(t('WEP'), 'WEP');
  assert.equal(wifiPayload({ ssid: 's', security: 'nopass' }), 'WIFI:T:nopass;S:s;;');
  assert.throws(() => wifiPayload({ ssid: 's', password: 'p', security: 'TKIP' }), err => err instanceof TypeError && /WPA/.test(err.message));
});

test('minModules: the plate width, in CSS px, that gives every module two', () => {
  assert.equal(minPlate(49, 1), 98 + 3);
  assert.equal(Math.round(minPlate(49, 0.86) * 10) / 10, 117);
});

test('the hand-ruled frame is fixed by its seed and stays inside its box', () => {
  const a = framePaths('casa'), b = framePaths('casa'), c = framePaths('other');
  assert.deepEqual(a, b);
  assert.notEqual(a.outer, c.outer);
  for (const d of [a.outer, a.inner]) for (const n of d.match(/-?\d+\.\d+/g)) assert.ok(+n > -1 && +n < 101, n);
});

test('the reveal exists only in full motion; ecc falls back to M', () => {
  assert.ok(reveal('full').duration > 0);
  for (const m of ['still', 'state', 'ambient']) assert.equal(reveal(m), null);
  assert.equal(eccOf('h'), 'H');
  assert.equal(eccOf('Z'), 'M');
  assert.equal(eccOf(null), 'M');
});
