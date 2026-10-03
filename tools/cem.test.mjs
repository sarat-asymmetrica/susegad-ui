import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildManifest, serialise } from './cem.mjs';

/** A throwaway repo with a registry index and one component. */
function fixture(t, { withCore = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-cem-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (p, content) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), content); };

  write('registry/registry.json', JSON.stringify({
    name: 'susegad-ui', format: 1, base: '..',
    items: [
      {
        name: 'widget', type: 'component', title: 'Widget', description: 'A widget.', version: '0.1.0',
        manifest: 'packages/components/widget/registry.json',
        files: [
          { path: 'packages/components/widget/widget.js', bytes: 1, hash: 'sha256-' + '0'.repeat(64) },
          { path: 'packages/components/widget/widget.css', bytes: 1, hash: 'sha256-' + '0'.repeat(64) },
        ],
        dependencies: [], registers: [], bytes: 1, jsBytes: 1, codeBytes: 1, hash: 'sha256-' + '0'.repeat(64),
      },
    ],
  }));
  write('packages/components/widget/widget.js', `
    import { SgElement, defineComponent } from '../../core/component.js';
    export class SgWidget extends SgElement {
      static observedAttributes = ['tone', 'busy'];
      go() { this.emit('sg-widget-go', { at: Date.now() }); }
    }
    defineComponent('sg-widget', SgWidget);
  `);
  write('packages/components/widget/widget.css', `
    sg-widget { --sg-widget-fill: var(--sg-accent); color: var(--sg-widget-ink); }
  `);
  if (withCore) write('packages/core/index.js', `customElements.define('sg-scene', SgScene);`);
  return root;
}

test('a component gets its tag, attributes, events and own CSS custom properties, from source', t => {
  const { modules } = buildManifest({ root: fixture(t) });
  const widget = modules.find(m => m.declarations[0].tagName === 'sg-widget');
  assert.ok(widget, 'sg-widget is found even with no scene-element.js on disk');
  const decl = widget.declarations[0];
  assert.equal(decl.name, 'SgWidget');
  assert.equal(decl.kind, 'class');
  assert.equal(decl.customElement, true);
  assert.deepEqual(decl.attributes, [{ name: 'tone' }, { name: 'busy' }]);
  assert.deepEqual(decl.events, [{ name: 'sg-widget-go', type: { text: 'CustomEvent' } }]);
  assert.deepEqual(decl.cssProperties, [{ name: '--sg-widget-fill' }, { name: '--sg-widget-ink' }]);
  assert.equal(decl.slots, undefined, 'a light-DOM component (no attachShadow) has no slots');
  assert.equal(decl.cssParts, undefined, 'a light-DOM component has no CSS parts');
  assert.deepEqual(widget.exports, [{ kind: 'custom-element-definition', name: 'sg-widget', declaration: { name: 'SgWidget', module: 'packages/components/widget/widget.js' } }]);
});

test('a component with no defineComponent call is skipped, not guessed', t => {
  const root = fixture(t, { withCore: false });
  writeFileSync(join(root, 'packages/components/widget/widget.js'), 'export const notYetAComponent = true;\n');
  const { modules } = buildManifest({ root });
  assert.equal(modules.length, 0);
});

test('serialise is deterministic and newline-terminated', t => {
  const m = buildManifest({ root: fixture(t) });
  const a = serialise(m), b = serialise(buildManifest({ root: fixture(t) }));
  assert.equal(a, b);
  assert.ok(a.endsWith('}\n'));
});

// This is the check that must fail first: a stale custom-elements.json (a
// hand-edit, or source that moved on since it was last generated) is caught.
test('--check fails on a stale file, in the real repo', () => {
  const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const real = buildManifest({ root: join(here, '..') });
  const onDisk = readFileSync(join(here, '..', 'custom-elements.json'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(serialise(real), onDisk, 'custom-elements.json is stale: run node tools/cem.mjs');
});
