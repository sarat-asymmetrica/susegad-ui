import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holdReason, parseSrc, posterPicture, posterFiles, LOW_MEMORY_GB } from './lazy.core.js';

test('a scene may start when nothing says no', () => {
  assert.equal(holdReason({ register: 'warm' }), null);
  assert.equal(holdReason({ register: 'playful', deviceMemory: 8 }), null);
  assert.equal(holdReason(), null);
  assert.equal(holdReason({ register: 'warm', deviceMemory: null }), null, 'a browser that does not report memory is not low on it');
});

test('each reason keeps the poster, and the order is a stated preference, then the device, then the register', () => {
  assert.equal(holdReason({ reducedMotion: true, register: 'playful' }), 'reduced-motion');
  assert.equal(holdReason({ saveData: true, register: 'warm' }), 'save-data');
  assert.equal(holdReason({ register: 'warm', deviceMemory: 1 }), 'low-memory');
  assert.equal(holdReason({ register: 'warm', deviceMemory: LOW_MEMORY_GB }), 'low-memory');
  assert.equal(holdReason({ register: 'warm', deviceMemory: LOW_MEMORY_GB + 2 }), null);
  assert.equal(holdReason({ register: 'quiet' }), 'quiet');
  assert.equal(holdReason({ reducedMotion: true, saveData: true, register: 'quiet', deviceMemory: 1 }), 'reduced-motion');
  assert.equal(holdReason({ saveData: true, register: 'quiet', deviceMemory: 1 }), 'save-data');
  assert.equal(holdReason({ register: 'quiet', deviceMemory: 1 }), 'low-memory');
});

test('src is a list of module URLs, absolute against the page', () => {
  assert.deepEqual(parseSrc('/a.js  ./b.js\n c.js', 'https://x.test/docs/scenes/abri.html'),
    ['https://x.test/a.js', 'https://x.test/docs/scenes/b.js', 'https://x.test/docs/scenes/c.js']);
  assert.deepEqual(parseSrc('', 'https://x.test/'), []);
  assert.deepEqual(parseSrc(null, 'https://x.test/'), []);
  assert.deepEqual(parseSrc('http://[bad', 'https://x.test/'), [], 'a bad entry is dropped, not thrown');
});

test('a poster is AVIF, then WebP, then the JPG img with its size, alt and loading (decision 0023)', () => {
  assert.deepEqual(posterFiles('p/abri'), { avif: 'p/abri.avif', webp: 'p/abri.webp', jpg: 'p/abri.jpg' });
  const html = posterPicture({ stem: 'p/abri', alt: 'A "stage" <drawn>', width: 720, height: 450 });
  assert.match(html, /^<picture><source type="image\/avif" srcset="p\/abri\.avif"><source type="image\/webp" srcset="p\/abri\.webp"><img /);
  assert.match(html, / src="p\/abri\.jpg" width="720" height="450" alt="A &quot;stage&quot; &lt;drawn>" loading="lazy" decoding="async"><\/picture>$/);
  assert.doesNotMatch(html, /fetchpriority/);
});

test('the first poster on a page is eager and high priority; sizes and extras are carried', () => {
  const html = posterPicture({ stem: 'a', width: 1, height: 1, eager: true, sizes: '100vw', cls: 'poster', data: 'data-poster="a"' });
  assert.match(html, /<img class="poster" src="a\.jpg" data-poster="a" width="1" height="1" alt="" fetchpriority="high" decoding="async">/);
  assert.doesNotMatch(html, /loading=/);
  assert.equal((html.match(/sizes="100vw"/g) || []).length, 2, 'both sources');
});

// lazy.css is the poster's layout for a page that links it; lazy.js adopts the same rules for a page that does not.
// If they drift, one page lays the poster out differently from the other.
test('lazy.css and the sheet lazy.js adopts agree on the poster layout', async () => {
  const { readFileSync } = await import('node:fs');
  const read = f => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const rules = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2].trim()]);
  const linked = rules(read('./lazy.css'));
  const adopted = new Map(rules(read('./lazy.js').match(/const CSS = `([\s\S]*?)`;/)[1]));
  assert.ok(linked.length >= 4);
  for (const [sel, decl] of linked) {
    assert.ok(adopted.has(sel), `lazy.js has no rule for ${sel}`);
    assert.ok(adopted.get(sel).startsWith(decl), `${sel}: lazy.css says ${decl}, lazy.js says ${adopted.get(sel)}`);
  }
});
