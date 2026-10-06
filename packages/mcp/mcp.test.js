import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { searchItems, needsOf, posterSet, posterUrl, POSTER_BASE, REGISTERS, THEMES, cliCommand, callTool, TOOLS } from './src/tools.mjs';
import { createHandler } from './src/server.mjs';

const fixture = fileURLToPath(new URL('../../registry/fixtures/good', import.meta.url));
const index = JSON.parse(readFileSync(join(fixture, 'registry', 'registry.json'), 'utf8'));
const pkg = fileURLToPath(new URL('.', import.meta.url));

// pure cores -------------------------------------------------------------------

test('searchItems finds by words in name, title and description', () => {
  const all = searchItems(index, {});
  assert.equal(all.length, index.items.length);
  const dot = searchItems(index, { query: 'kumkum' });
  assert.deepEqual(dot.map(i => i.name), ['scene-dot']);
  // a missing word is an honest empty result, not a fallback to everything
  assert.deepEqual(searchItems(index, { query: 'zzzunfindable' }), []);
  const anyCase = searchItems(index, { query: 'KUMKUM' });
  assert.equal(anyCase.length, 1);
});

test('searchItems narrows by kind and register', () => {
  assert.deepEqual(searchItems(index, { kind: 'recipe' }).map(i => i.name), ['hello']);
  assert.deepEqual(searchItems(index, { kind: 'scene', query: 'no such scene here' }), []);
  const quiet = searchItems(index, { register: 'quiet' });
  assert.ok(quiet.every(i => (i.registers ?? []).includes('quiet')));
});

test('needsOf gives the full closure without the item itself', () => {
  assert.deepEqual(needsOf(index, 'scene-dot'), ['engine', 'tokens', 'core']);
  assert.deepEqual(needsOf(index, 'engine'), []);
});

test('posterSet follows the scheme apps/docs/posters.mjs serves', () => {
  const dot = index.items.find(i => i.name === 'scene-dot');
  const set = posterSet(dot);
  assert.equal(set.source, 'scene');
  assert.equal(set.posters.length, REGISTERS.length * THEMES.length);
  assert.equal(set.posters[0].url, `${POSTER_BASE}scene-dot.quiet.light.jpg`);
  assert.equal(posterUrl('scene-dot', 'warm', 'dark'), `${POSTER_BASE}scene-dot.warm.dark.jpg`);
  // a package with neither demo page nor scene harness has no poster
  assert.equal(posterSet(index.items.find(i => i.name === 'core')), null);
  const hello = posterSet(index.items.find(i => i.name === 'hello'));
  assert.equal(hello.source, 'page');
});

// the CLI through the tool, locally ---------------------------------------------

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'susegad-mcp-'));
  t.after(() => {
    // Windows keeps a folder locked briefly after a child with that cwd exits.
    for (let i = 0; i < 5; i++) {
      try { rmSync(dir, { recursive: true, force: true }); return; }
      catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); }
    }
  });
  return dir;
}

test('cliCommand add runs the CLI and copies the files', async t => {
  const project = scratch(t);
  const r = await cliCommand('add', { items: ['scene-dot'], cwd: project, registry: fixture });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /Adding scene-dot/);
  assert.ok(existsSync(join(project, 'src', 'lib', 'susegad', 'scenes', 'dot', 'index.js')));
  assert.ok(existsSync(join(project, 'src', 'lib', 'susegad.json')));
});

test('cliCommand add names a missing item in the CLI\'s own words', async t => {
  const r = await cliCommand('add', { items: ['scene-nope'], cwd: scratch(t), registry: fixture });
  assert.equal(r.code, 1);
  assert.match(r.text, /I do not have anything called "scene-nope"/);
});

test('cliCommand diff reports an edit and then all is well', async t => {
  const project = scratch(t);
  await cliCommand('add', { items: ['scene-dot'], cwd: project, registry: fixture });
  const clean = await cliCommand('diff', { items: ['scene-dot'], cwd: project, registry: fixture });
  assert.equal(clean.code, 0, clean.text);
  writeFileSync(join(project, 'src', 'lib', 'susegad', 'scenes', 'dot', 'model.js'), '/* edited */\n');
  const edited = await cliCommand('diff', { items: ['scene-dot'], cwd: project, registry: fixture });
  assert.equal(edited.code, 1);
  assert.match(edited.text, /edited/);
});

test('callTool wires search, info and preview to the registry', async t => {
  const env = { registry: fixture, cwd: process.cwd() };
  const s = await callTool('search', { query: 'kumkum' }, env);
  assert.equal(s.results[0].name, 'scene-dot');
  assert.equal(s.results[0].stability, 'experimental');
  const info = await callTool('info', { name: 'scene-dot' }, env);
  assert.equal(info.name, 'scene-dot');
  assert.deepEqual(info.needs, ['engine', 'tokens', 'core']);
  assert.match(info.promptText, /./); // the prompt's text arrived, not just its path
  const prev = await callTool('preview', { name: 'scene-dot' }, env);
  assert.equal(prev.posters.length, 6);
  const miss = await callTool('info', { name: 'nope' }, env);
  assert.match(miss.error, /I do not have anything called "nope"/);
  const unknown = await callTool('nope', {}, env);
  assert.match(unknown.error, /I do not have a tool called "nope"/);
});

// over stdio, through a real child process ---------------------------------------

function serve(t, root) {
  const promise = (async () => {
    const { startServer } = await import('../../tools/serve.mjs');
    return startServer({ root, quiet: true });
  })();
  t.after(() => promise.then(s => s.close()));
  return promise;
}

const killLater = (t, child) => {
  t.after(() => new Promise(done => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    child.kill('SIGKILL');
    child.once('exit', done);
    setTimeout(done, 2000);
  }));
  return child;
};

/** A scripted MCP client over stdio: one JSON message per line. */
class Client {
  constructor(child) {
    this.child = child;
    this.child.setMaxListeners(30); // one 'exit' listener per request below
    this.next = 1;
    this.pending = new Map();
    let buffer = '';
    child.stdout.on('data', c => {
      buffer += c.toString('utf8');
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p(msg); }
      }
    });
  }
  request(method, params) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, resolve);
      const timer = setTimeout(() => reject(new Error(`no answer to ${method} (id ${id})`)), 20000);
      this.child.once('exit', () => { clearTimeout(timer); reject(new Error(`server exited before answering ${method}`)); });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }
}

test('the stdio server answers initialize, tools/list and every tool call', async t => {
  const project = scratch(t);
  const server = await serve(t, fixture);
  const child = killLater(t, spawn(process.execPath, [join(pkg, 'bin', 'susegad-mcp.mjs'), '--registry', `${server.url}/registry/registry.json`],
    { cwd: project, stdio: ['pipe', 'pipe', 'pipe'] }));
  child.stderr.on('data', () => {}); // keep stderr from backing up
  const client = new Client(child);

  const init = await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'susegad-mcp');
  assert.ok(init.result.instructions.includes('Susegad'));
  client.notify('notifications/initialized');

  const list = await client.request('tools/list', {});
  assert.deepEqual(list.result.tools.map(x => x.name), ['search', 'info', 'preview', 'add', 'diff']);
  assert.ok(list.result.tools.every(x => x.inputSchema && x.description));

  const ping = await client.request('ping', {});
  assert.deepEqual(ping.result, {});

  const search = await client.request('tools/call', { name: 'search', arguments: { query: 'kumkum' } });
  assert.equal(search.result.structuredContent.results[0].name, 'scene-dot');
  assert.equal(search.result.isError, undefined);

  // an honest empty result for a missing word
  const empty = await client.request('tools/call', { name: 'search', arguments: { query: 'zzzunfindable' } });
  assert.deepEqual(empty.result.structuredContent.results, []);

  const info = await client.request('tools/call', { name: 'info', arguments: { name: 'scene-dot' } });
  assert.match(info.result.structuredContent.promptText, /./);
  assert.ok(info.result.content[0].text.includes('scene-dot'));

  const preview = await client.request('tools/call', { name: 'preview', arguments: { name: 'scene-dot' } });
  assert.equal(preview.result.structuredContent.posters.length, 6);
  assert.match(preview.result.content[0].text, /scene-dot.warm.light.jpg/);

  const add = await client.request('tools/call', { name: 'add', arguments: { items: ['scene-dot'] } });
  assert.equal(add.result.structuredContent.code, 0, add.result.content[0].text);
  assert.ok(existsSync(join(project, 'src', 'lib', 'susegad', 'scenes', 'dot', 'model.js')));

  const diff = await client.request('tools/call', { name: 'diff', arguments: { items: ['scene-dot'] } });
  assert.equal(diff.result.structuredContent.code, 0, diff.result.content[0].text);

  // a nonexistent item returns the CLI's own error text, marked as an error
  const nope = await client.request('tools/call', { name: 'add', arguments: { items: ['scene-nope'] } });
  assert.equal(nope.result.isError, true);
  assert.match(nope.result.content[0].text, /I do not have anything called "scene-nope"/);

  const badTool = await client.request('tools/call', { name: 'nope' });
  assert.equal(badTool.result.isError, true);
  assert.match(badTool.result.content[0].text, /I do not have a tool called "nope"/);
});

test('the server answers a malformed line with a parse error and keeps going', async t => {
  const server = await serve(t, fixture);
  const child = killLater(t, spawn(process.execPath, [join(pkg, 'bin', 'susegad-mcp.mjs'), '--registry', `${server.url}/registry/registry.json`],
    { cwd: scratch(t), stdio: ['pipe', 'pipe', 'pipe'] }));
  child.stderr.on('data', () => {});
  const client = new Client(child);
  child.stdin.write('not json at all\n');
  // the server answers with a JSON-RPC parse error and still answers the next request
  const init = await client.request('initialize', {});
  assert.equal(init.result.serverInfo.name, 'susegad-mcp');
});

test('the server handles a broken registry by returning the CLI\'s error', async t => {
  const r = await callTool('search', {}, { registry: 'C:/definitely/not/a/registry', cwd: process.cwd() })
    .catch(e => ({ thrown: e.message }));
  assert.ok(r.thrown || r.error || /registry|index/.test(JSON.stringify(r)), JSON.stringify(r));
});

// the handler, driven in process, for the protocol edge cases --------------------

test('createHandler refuses a non JSON-RPC message and an unknown method', async () => {
  const h = createHandler({ name: 'x', version: '0', instructions: '', tools: TOOLS });
  assert.equal((await h({ jsonrpc: '1.0', id: 1, method: 'initialize' })).error.code, -32600);
  const unknown = await h({ jsonrpc: '2.0', id: 2, method: 'resources/list' });
  assert.equal(unknown.error.code, -32601);
  const note = await h({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(note, null);
});

test('with no --registry (registry: null, how the README installs it) the tools still answer', async () => {
  // run from the repo, so the default is the repo's own index and nothing touches the network
  const out = await callTool('search', { query: 'banyan' }, { registry: null, cwd: process.cwd() });
  assert.notEqual(out.isError, true, JSON.stringify(out).slice(0, 300));
  assert.match(JSON.stringify(out), /scene-vad/);
  const info = await callTool('info', { name: 'scene-vad' }, { registry: null, cwd: process.cwd() });
  assert.notEqual(info.isError, true, JSON.stringify(info).slice(0, 300));
});
