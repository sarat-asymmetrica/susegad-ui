import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSheet, esc } from './sheet.mjs';

const cell = (over = {}) => ({
  id: 'warm-phone-light', register: 'warm', view: 'phone', width: 390, theme: 'light', reduced: false,
  shot: 'warm-phone-light.png', ready: { ok: true },
  errors: { console: [], page: [], requests: [], warnings: [], count: 0 },
  overflow: { scrollWidth: 390, innerWidth: 390, pass: true },
  pointer: { status: 'pass' }, pass: true, ...over,
});

test('escapes html', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('the sheet shows every cell, its verdict and its problems', () => {
  const report = {
    target: { scene: 'kolam', seed: '3' }, chromium: '153', date: 'd', settleSeconds: 2,
    summary: { cells: 2, passed: 1, failed: ['quiet-desktop-dark'] },
    cells: [
      cell(),
      cell({
        id: 'quiet-desktop-dark', register: 'quiet', view: 'desktop', theme: 'dark', shot: 'quiet-desktop-dark.png', pass: false,
        errors: { console: ['<boom>'], page: [], requests: [], warnings: [], count: 1 }, pointer: { status: 'n/a' },
      }),
    ],
  };
  const html = renderSheet(report, 'kolam');
  assert.match(html, /<title>Matrix: kolam<\/title>/);
  assert.match(html, /1 of 2<\/b> cells pass/);
  assert.match(html, /src="warm-phone-light.png"/);
  assert.match(html, /src="quiet-desktop-dark.png"/);
  assert.match(html, /console: &lt;boom&gt;/);
  assert.equal((html.match(/class="cell ok"/g) || []).length, 1);
  assert.equal((html.match(/class="cell bad"/g) || []).length, 1);
  assert.ok(!html.includes('<boom>'));
});
