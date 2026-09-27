import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes, parseSize, parseUnicodeRange, charsIn, parseFontFaces, assignChars, cssUrls, cssImports,
  splice, isRemote, budgetReport, safeScript,
} from './build/assets.mjs';
import { ZERO, cspFor, inlineHashes, withCsp, seal, verify, canonical, sha256 } from './build/seal.mjs';

test('sizes read and written the way people write them', () => {
  assert.equal(parseSize('1.5MB'), 1572864);
  assert.equal(parseSize('800 kb'), 819200);
  assert.equal(parseSize(3000), 3000);
  assert.throws(() => parseSize('big'), /1.5MB or 800KB/);
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(1572864), '1.50 MB');
});

test('unicode-range and the characters inside it', () => {
  assert.deepEqual(parseUnicodeRange('U+0000-02FF, U+0304, U+09??'), [[0, 0x2ff], [0x304, 0x304], [0x900, 0x9ff]]);
  assert.equal(charsIn('Mumbai मुंबई', parseUnicodeRange('U+0900-097F')), [...new Set('मुंबई')].sort().join(''));
});

const CSS = `
@font-face { font-family: 'Mukta'; font-weight: 400; src: url('m-latin.woff2') format('woff2'); unicode-range: U+0000-02FF; }
@font-face { font-family: 'Mukta'; font-weight: 400; src: url('m-deva.woff2') format('woff2'); unicode-range: U+0900-097F; }
@font-face { font-family: 'Noto Sans Kannada'; font-weight: 400 600; src: url('noto-kn.woff2'); unicode-range: U+0C80-0CFF; }
@font-face { font-family: 'Kalam'; font-weight: 400; src: url('k-latin.woff2'); unicode-range: U+0000-02FF; }
@font-face { font-family: 'Kalam'; font-weight: 400; src: url('k-deva.woff2'); unicode-range: U+0900-097F; }
@font-face { font-family: 'Mukta Fallback'; src: local('Arial'); }`;

test('font faces are read with their family, weight range, source and ranges', () => {
  const f = parseFontFaces(CSS);
  assert.equal(f.length, 6);
  assert.deepEqual(f[2].weight, [400, 600]);
  assert.equal(f[0].src, 'm-latin.woff2');
  assert.equal(f[5].src, '', 'a local() fallback has no file');
});

test('each character goes to the face that draws it, as the browser picks', () => {
  const faces = parseFontFaces(CSS);
  const drawn = assignChars(faces, [
    { stack: ['Mukta', 'Noto Sans Kannada', 'sans-serif'], weight: 400, style: 'normal', text: 'Hi मुंबई ನಮ್ಮ' },
    { stack: ['Kalam', 'cursive'], weight: 400, style: 'normal', text: 'Balcão' },
  ]);
  const by = src => [...(drawn.get(faces.find(f => f.src === src)) ?? [])].sort().join('');
  assert.equal(by('m-latin.woff2'), 'Hi'.split('').sort().join(''));
  assert.equal(by('m-deva.woff2'), [...new Set('मुंबई')].sort().join(''));
  assert.equal(by('noto-kn.woff2'), [...new Set('ನಮ್ಮ')].sort().join(''), 'Kannada falls through Mukta to Noto');
  assert.equal(by('k-deva.woff2'), '', 'Kalam draws no Devanagari here, so its Devanagari face is left out');
  assert.ok(by('k-latin.woff2').includes('ã'));
});

test('stylesheet urls and imports, and edits by position', () => {
  const css = `@import url("a.css"); @import 'b.css'; .x { background: url(img/p.png) } .y { mask: url("data:image/svg+xml,x") }`;
  assert.deepEqual(cssImports(css).map(i => i.url), ['a.css', 'b.css']);
  assert.deepEqual(cssUrls(css).map(u => u.url), ['a.css', 'img/p.png'], 'data: urls are left alone');
  assert.equal(splice('abcdef', [{ start: 1, end: 3, text: 'X' }, { start: 4, end: 5, text: 'Y' }]), 'aXdYf');
  assert.ok(isRemote('https://example.com/x.css') && isRemote('//cdn/x.js') && !isRemote('./x.js'));
});

test('inline scripts cannot close themselves early', () => {
  assert.equal(safeScript('a="</script>";b="<!--"'), String.raw`a="<\/script>";b="<\!--"`);
});

test('the budget table lists the heavy parts first and says when it is over', () => {
  const r = budgetReport([{ kind: 'font', name: 'small', bytes: 10 }, { kind: 'image', name: 'photo', bytes: 900 }], 1000, 800);
  assert.equal(r.ok, false);
  assert.equal(r.rows[0].name, 'photo');
  assert.match(r.table, /total.*of a 800 B budget/);
});

test('the policy allows only hashed scripts and styles, and loads nothing', () => {
  const html = '<html><head><title>t</title><style>p{}</style></head><body><script>a()</script><script src="x.js"></script></body></html>';
  const h = inlineHashes(html);
  assert.deepEqual(h.scripts, [sha256('a()')], 'scripts with a src are not inline');
  assert.deepEqual(h.styles, [sha256('p{}')]);
  const p = cspFor({ ...h, styleAttrs: ['abc='] });
  for (const d of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", 'img-src data: blob:', 'font-src data:', "'unsafe-hashes'"]) assert.ok(p.includes(d), d);
  assert.ok(!p.includes('unsafe-inline') && !p.includes('http'));
  assert.match(withCsp(html, p), /^<html><head>\n<meta http-equiv="Content-Security-Policy"/, 'first in <head>');
});

test('the seal: matches as built, fails on any one-byte change', () => {
  const doc = `<html><head><meta name="folio-integrity" content="sha256-${ZERO}"></head><body><p>₹18,400</p><footer><code>${ZERO}</code></footer></body></html>`;
  const { text, digest } = seal(doc);
  assert.equal(verify(text).ok, true);
  assert.equal(canonical(text, digest), doc, 'the hash is taken over the file with the hash zeroed');
  assert.equal(verify(text.replace('18,400', '15,400')).ok, false, 'a changed price');
  assert.equal(verify(text.replace('<p>', '<p> ')).ok, false, 'an added space');
  const i = text.indexOf('<code>') + 6;
  assert.equal(verify(text.slice(0, i) + (text[i] === 'a' ? 'b' : 'a') + text.slice(i + 1)).ok, false, 'a changed hash');
  assert.match(verify('<html></html>').reason, /no Folio seal/);
  assert.throws(() => seal('<html></html>'), /no place for its seal/);
});
