import test from 'node:test';
import assert from 'node:assert/strict';
import { finish } from './component-check.mjs';

test('finish prints the verdict before closing, and a close that never ends cannot hang it', async () => {
  const lines = [];
  const started = Date.now();
  const code = await finish([{ ok: true }, { ok: true }], [() => new Promise(() => {})], { closeMs: 50, log: s => lines.push(s) });
  assert.equal(code, 0);
  assert.equal(lines[0], 'all 2 checks pass');
  assert.match(lines[1], /closing took over/);
  assert.ok(Date.now() - started < 2000);
});

test('finish returns 1 when a check failed, and closes everything that closes', async () => {
  const closed = [];
  const code = await finish([{ ok: true }, { ok: false }], [() => closed.push('browser'), async () => closed.push('server')], { closeMs: 50, log: () => {} });
  assert.equal(code, 1);
  assert.deepEqual(closed, ['browser', 'server']);
});

test('a close that throws still lets finish return', async () => {
  const code = await finish([{ ok: true }], [() => { throw new Error('gone'); }], { closeMs: 50, log: () => {} });
  assert.equal(code, 0);
});
