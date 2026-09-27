import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, resolveInside, mimeFor } from './serve.mjs';

test('resolveInside keeps paths inside the root', () => {
  const root = path.resolve('/srv/site');
  assert.equal(resolveInside(root, '/a/b.js'), path.join(root, 'a', 'b.js'));
  assert.equal(resolveInside(root, '/../../etc/passwd'), path.join(root, 'etc', 'passwd'));
  assert.equal(resolveInside(root, '/%2e%2e/%2e%2e/x'), path.join(root, 'x'));
  assert.equal(resolveInside(root, '/%E0%A4%A'), null);
});

test('MIME types cover what the library ships', () => {
  for (const [ext, type] of [['.mjs', 'text/javascript'], ['.json', 'application/json'], ['.webp', 'image/webp'],
    ['.avif', 'image/avif'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'], ['.vtt', 'text/vtt'], ['.wasm', 'application/wasm']]) {
    assert.ok(mimeFor(`x${ext}`).startsWith(type), ext);
  }
  assert.equal(mimeFor('x.unknown'), 'application/octet-stream');
});

test('serves files, index.html, 404s and the exists probe, with no caching', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-serve-'));
  fs.mkdirSync(path.join(root, 'dir'));
  fs.writeFileSync(path.join(root, 'a.mjs'), 'export default 1;');
  fs.writeFileSync(path.join(root, 'dir', 'index.html'), '<p>hi</p>');
  const s = await startServer({ root, quiet: true });
  try {
    let r = await fetch(`${s.url}/a.mjs`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/javascript/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(await r.text(), 'export default 1;');
    r = await fetch(`${s.url}/dir/`);
    assert.equal(await r.text(), '<p>hi</p>');
    r = await fetch(`${s.url}/dir`, { redirect: 'manual' });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), '/dir/');
    r = await fetch(`${s.url}/missing.js`);
    assert.equal(r.status, 404);
    await r.text();
    r = await fetch(`${s.url}/__exists?path=/a.mjs`);
    assert.deepEqual(await r.json(), { exists: true });
    r = await fetch(`${s.url}/__exists?path=/nope.css`);
    assert.deepEqual(await r.json(), { exists: false });
  } finally {
    await s.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('notFoundHtml mimics Workers\' not_found_handling: "404-page" (the body at the missing URL, status 404)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-serve-404-'));
  fs.writeFileSync(path.join(root, '404.html'), '<p>not here</p>');
  const s = await startServer({ root, quiet: true, notFoundHtml: '404.html' });
  try {
    const r = await fetch(`${s.url}/a/b/c`);
    assert.equal(r.status, 404, 'a deep missing path still answers 404');
    assert.match(r.headers.get('content-type'), /^text\/html/);
    assert.equal(await r.text(), '<p>not here</p>');
    // without the option, a plain 404 (the pre-fix shape) comes back instead
    const s2 = await startServer({ root, quiet: true });
    const r2 = await fetch(`${s2.url}/a/b/c`);
    assert.equal(await r2.text(), '404 /a/b/c');
    await s2.close();
  } finally {
    await s.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
