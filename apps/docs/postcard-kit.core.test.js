// The postcard kit (rung 2a): the one thing the page reads from its address, and the email files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneFromQuery, KIT_WORDS } from './postcard-kit.core.js';
import { SCENES, DEFAULT_SCENE } from '../../packages/recipes/picture-postcard/scenes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('?scene=<id> preselects a scene of the page\'s own set, and every id the set has works', () => {
  for (const s of SCENES) assert.equal(sceneFromQuery(`?scene=${s.name}`, SCENES, DEFAULT_SCENE), s.name);
  assert.equal(sceneFromQuery('?scene=mithagar', SCENES, DEFAULT_SCENE), 'mithagar');
  assert.equal(sceneFromQuery('?utm=x&scene=tinto&z=1', SCENES, DEFAULT_SCENE), 'tinto', 'among other keys');
});

test('?scene= with a bogus, empty, repeated or borrowed id falls back, and nothing else is read', () => {
  for (const q of ['', '?', '?scene=', '?scene=nope', '?scene=FERRY', '?scene=ferry%20', '?scene=constructor', '?scene=__proto__', '?scene=toString',
    '?scene=ferry&scene=tinto', '?name=Asha', '?scene[]=ferry', '#scene=ferry', '?scene=../ferry']) assert.equal(sceneFromQuery(q, SCENES, 'fallback'), 'fallback', q);
  assert.equal(sceneFromQuery('?name=Asha&scene=mithagar', SCENES, DEFAULT_SCENE), 'mithagar');
  assert.equal(sceneFromQuery('?scene=ghost', [], 'x'), 'x');
});

test('the kit\'s one new line of words is there for Kathakar to fill', () => {
  assert.match(KIT_WORDS.hold.line, /press and hold/i);
});

const jpg = path.join(HERE, 'postcard', 'email.jpg'), snippet = fs.readFileSync(path.join(HERE, 'postcard', 'email.html'), 'utf8');

test('the email image is a JPEG of 1200 x 800 under 150 KB', () => {
  const b = fs.readFileSync(jpg);
  assert.deepEqual([...b.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  // the SOF marker holds height then width
  let i = 2, size = null;
  while (i < b.length) { const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) { size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; } i += 2 + b.readUInt16BE(i + 2); }
  assert.deepEqual(size, [1200, 800]);
  assert.ok(b.length < 150 * 1024, `${b.length} bytes`);
});

test('the email snippet is a table with inline styles: no script, no style block, no form, every image has alt, absolute addresses', () => {
  const body = snippet.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/<script|<style|<form|<link|<iframe|javascript:|\son\w+\s*=/i.test(body));
  assert.match(body, /<table[^>]*width="600"/);
  const imgs = [...body.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert.equal(imgs.length, 1);
  for (const img of imgs) assert.match(img, /\balt="[^"]{5,}"/);
  const urls = [...body.matchAll(/(?:src|href)="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(urls)].sort(), ['https://susegad.asymmetrica.ai/postcard/email.jpg', 'https://susegad.asymmetrica.ai/postcard?scene=ferry']);
  assert.ok(urls.every(u => !u.includes('#') && (!u.includes('?') || /\?scene=[a-z]+$/.test(u))), 'the only query is a fixed ?scene=<id>: no tracking and no name in the link');
  assert.equal([...body.matchAll(/<a\b/g)].length, 2, 'the image is a link and so is the line under it');
  assert.ok(!/—/.test(snippet), 'no em dash');
});
