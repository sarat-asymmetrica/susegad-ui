import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryOf } from './smoke.mjs';
import {
  a11yFailures, a11ySummary, baselineName, boxRatio, compareBaseline, contrastRatio, diffSnapshots, exemptionsFor, isLarge, judgeContrast,
  judgeForced, normaliseSnapshot, parseLine, parseOpenMeta, skeleton, treeInvariants, unwrap, MASK_RULES, OPEN_ACTIONS, REGISTER_CELLS,
} from './a11y.core.js';

const GOOD = `- main:
  - heading "Save the date" [level=1]
  - button "Save"
  - link "Home":
    - /url: ./index.html
  - img "A lamp"
  - textbox "Name"`;

test('a tree with every control named, one main and a heading has no problems', () => {
  const r = treeInvariants(GOOD);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.counts, { main: 1, heading: 1, named: 4, unnamed: 0 });
});

test('an unnamed button, link and image are each a problem, counted by role', () => {
  const r = treeInvariants(`- main:\n  - heading "A" [level=1]\n  - button\n  - button\n  - link:\n    - /url: x\n  - img`);
  assert.deepEqual(r.problems, ['2 buttons with no accessible name', '1 link with no accessible name', '1 img with no accessible name']);
});

test('no main, two mains and no heading are problems, and an exemption turns one into a printed reason', () => {
  assert.deepEqual(treeInvariants('- button "A"').problems, ['no main landmark', 'no heading']);
  assert.deepEqual(treeInvariants('- main:\n  - heading "A"\n- main:\n  - heading "B"').problems, ['2 main landmarks']);
  const r = treeInvariants('- button "A"', { main: 'a fallback page', heading: 'a widget in a frame' });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.exempted, ['no main landmark: a fallback page', 'no heading: a widget in a frame']);
});

test('a name with a colon comes quoted whole in the snapshot, and is read as the heading it is', () => {
  const line = `  - 'heading "Nothing held: a prototype" [level=1]'`;
  assert.equal(unwrap(line), '  - heading "Nothing held: a prototype" [level=1]');
  assert.deepEqual(parseLine(line), { depth: 1, role: 'heading', name: 'Nothing held: a prototype', attrs: '[level=1]', rest: '' });
  assert.equal(treeInvariants(`- main:\n${line}`).counts.heading, 1);
});

test('the skeleton cuts running text and keeps names, so a copy edit is not a change', () => {
  const a = `- main:\n  - paragraph: Some long words here\n  - paragraph:\n    - text: plain\n    - code: x\n    - link "Home":\n      - /url: ./a`;
  assert.equal(skeleton(a), `- main:\n  - paragraph\n  - paragraph:\n    - link "Home":\n      - /url: ./a`);
  const b = a.replace('Some long words here', 'Quite other words');
  assert.equal(skeleton(a), skeleton(b));
  assert.notEqual(skeleton(a), skeleton(a.replace('"Home"', '"Away"')), 'a changed name is a change');
});

test('mask rules are named and fire only where they apply', () => {
  const t = '- link "Words":\n  - /url: http://127.0.0.1:49290/packages/x.html';
  const r = normaliseSnapshot(t, '/p/a.html');
  assert.match(r.text, /127\.0\.0\.1:PORT\//);
  assert.deepEqual(r.masked, ['server-port']);
  const size = normaliseSnapshot('- figure "WebM, 317.2 KB"', '/packages/export/demo.html');
  assert.match(size.text, /WebM, SIZE/);
  assert.deepEqual(normaliseSnapshot('- figure "WebM, 317.2 KB"', '/packages/other.html').masked, [], 'the file-size rule is for the export demo only');
  assert.ok(MASK_RULES.every(r => r.name && r.find && 'with' in r));
});

test('the baseline comparison is null when equal, names what moved when not, and asks for a record when missing', () => {
  assert.equal(compareBaseline('- a\n- b\n', '- a\n- b\n'), null);
  const m = compareBaseline('- main:\n  - button "A"\n', '- main:\n  - button "B"\n');
  assert.match(m, /the accessibility tree changed: - - button "A" \| \+ - button "B"/);
  assert.match(m, /--record-a11y/);
  assert.match(compareBaseline(null, 'x'), /^no recorded baseline/);
  assert.match(diffSnapshots('a\nb\nc\nd\ne\nf\ng\nh', 'z\ny\nx\nw\nv\nu\nt\ns').slice(-12), /and \d+ more/);
});

test('exemptions match a page by path and a baseline file name has no slashes', () => {
  const rules = [{ match: '^/a/no-js\\.html$', main: true, reason: 'DEBT 74' }];
  assert.deepEqual(exemptionsFor('/a/no-js.html', rules), { main: 'DEBT 74' });
  assert.deepEqual(exemptionsFor('/a/demo.html', rules), {});
  assert.equal(baselineName('/packages/components/dialog/demo.html'), 'packages__components__dialog__demo.html.aria.yml');
});

test('the contrast ratio is the WCAG one: black on white is 21, equal colours are 1, order does not matter', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255]) * 100) / 100, 21);
  assert.equal(contrastRatio([120, 120, 120], [120, 120, 120]), 1);
  assert.equal(contrastRatio([10, 20, 30], [200, 210, 220]), contrastRatio([200, 210, 220], [10, 20, 30]));
  assert.ok(Math.abs(contrastRatio([138, 138, 138], [119, 119, 119]) - 1.3) < 0.01, 'the grey caption of the low-contrast fixture reads 1.3:1');
});

test('a box is scored over its pixels: a clear ground passes, a close one fails, a scribble over a quarter does not', () => {
  const white = [255, 255, 255, 1];
  const clear = Array(60).fill([20, 20, 20]).flat();
  assert.ok(boxRatio(white, clear).ratio > 15);
  const close = Array(60).fill([240, 240, 240]).flat();
  assert.ok(boxRatio(white, close).ratio < 1.2);
  const scribbled = [...Array(45).fill([20, 20, 20]), ...Array(15).fill([250, 250, 250])].flat();
  assert.ok(boxRatio(white, scribbled).ratio > 15, 'the worst quarter is still clear');
  const half = [...Array(30).fill([20, 20, 20]), ...Array(30).fill([250, 250, 250])].flat();
  assert.ok(boxRatio(white, half).ratio < 1.2, 'half the box on a pale ground fails');
  assert.ok(Number.isNaN(boxRatio(white, []).ratio));
});

test('text with alpha is laid over the ground before it is measured', () => {
  const ink = [0, 0, 0, 0.1];
  assert.ok(boxRatio(ink, [255, 255, 255]).ratio < 1.5, 'ink at 10% on white is nearly invisible');
  assert.ok(boxRatio([0, 0, 0, 1], [255, 255, 255]).ratio > 20);
});

test('contrast is judged against 4.5 for normal text and 3 for large, and the worst box leads', () => {
  const ground = Array(40).fill([119, 119, 119]).flat();
  const grey = [160, 160, 160, 1];
  const r = judgeContrast([
    { text: 'small', color: [255, 255, 255, 1], large: false, samples: ground },
    { text: 'big', color: [255, 255, 255, 1], large: true, samples: ground },
    { text: 'fine', color: [0, 0, 0, 1], large: false, samples: Array(40).fill([255, 255, 255]).flat() },
    { text: 'faint', color: grey, large: false, samples: ground },
  ]);
  assert.equal(r.boxes, 4);
  assert.equal(r.worst.text, 'faint');
  assert.deepEqual(r.failing.map(f => f.text).sort(), ['faint', 'small']);
  assert.equal(r.failing.find(f => f.text === 'small').need, 4.5);
  assert.ok(isLarge(24, 400) && isLarge(19, 700) && !isLarge(19, 400) && !isLarge(16, 700));
});

test('forced colours: a control with nothing left is a problem; text the same colour as its ground is a problem', () => {
  const ok = { label: 'button.a', hasText: true, border: false, outline: false, graphic: false, native: false };
  const bare = { label: 'button.icon', hasText: false, border: false, outline: false, graphic: false, native: false };
  const r = judgeForced({ controls: [ok, bare, { ...bare, label: 'a.x', border: true }], texts: [
    { text: 'ink', color: [0, 0, 0, 1], ground: [255, 255, 255] },
    { text: 'ghost', color: [255, 255, 255, 1], ground: [255, 255, 255] },
    { text: 'on a picture', color: [255, 255, 255, 1], ground: null },
  ] });
  assert.equal(r.problems.length, 2);
  assert.match(r.problems[0], /1 focusable control\(s\) with no text, border or graphic left: button\.icon/);
  assert.match(r.problems[1], /1 text\(s\) the same colour as their ground: "ghost" \(1\.00:1\)/);
  assert.deepEqual(judgeForced({ controls: [ok], texts: [] }).problems, []);
});

test('six register and theme cells, and the open list names a trigger and a state for each action', () => {
  assert.equal(REGISTER_CELLS.length, 6);
  assert.deepEqual(REGISTER_CELLS[0], { register: 'quiet', theme: 'light' });
  for (const [path, actions] of Object.entries(OPEN_ACTIONS)) for (const a of actions) assert.ok(path.startsWith('/') && a.name && a.open && a.expect, `${path} ${a.name}`);
  assert.deepEqual(parseOpenMeta(['a dialog | #go | dialog[open]', 'broken | only two']), [{ name: 'a dialog', open: '#go', expect: 'dialog[open]' }]);
});

test('failures: each pass adds its own kind, and a cell repeating the default axe line is not counted twice', () => {
  const seen = {
    desktop: {
      errors: [], axe: ['color-contrast (1: p)'],
      tree: { problems: ['no heading'], baseline: 'the accessibility tree changed: ...' },
      contrast: { failing: [{ text: 'Hi', ratio: 1.3, need: 4.5 }] },
      cells: { 'quiet/light': ['color-contrast (1: p)'], 'playful/dark': ['link-name (1: a)'] },
      opens: { 'the dialog': ['image-alt (1: img)'] }, openErrors: ['the menu: could not reach the open state'],
    },
    forced: { errors: ['boom'], axe: ['role-img-alt (1: x)'], problems: ['1 text(s) the same colour as their ground: "g" (1.00:1)'] },
  };
  const kinds = a11yFailures(seen).map(f => `${f.kind}: ${f.message}`);
  assert.deepEqual(kinds, [
    'tree: no heading', 'tree-changed: the accessibility tree changed: ...', 'contrast: "Hi" is 1.3:1 over the canvas, needs 4.5:1',
    'axe-cell: playful/dark: link-name (1: a)', 'axe-open: the dialog: image-alt (1: img)', 'open-failed: the menu: could not reach the open state',
    'error: forced colours: boom', 'axe: forced colours: role-img-alt (1: x)', 'forced: 1 text(s) the same colour as their ground: "g" (1.00:1)',
  ]);
  assert.equal(a11yFailures({ desktop: { errors: [], tree: { problems: [], baseline: 'no recorded baseline (record ...)' } } })[0].kind, 'tree-missing');
  assert.deepEqual(a11yFailures({ desktop: { errors: [] } }), [], 'a run without the passes adds nothing');
});

test('the run summary says what each pass saw, exemptions and masks included', () => {
  const results = [
    { path: '/a.html', a11y: { tree: { counts: {}, exempted: ['no main landmark: DEBT 74'], masked: ['server-port'] }, contrast: { boxes: 2, worst: { text: 'Hi', ratio: 5.2, need: 4.5 } }, forced: { controls: 3, texts: 9 } } },
    { path: '/b.html' },
  ];
  const lines = a11ySummary(results, { tree: true, contrast: true, forced: true });
  assert.ok(lines.some(l => /exempt\s+\/a\.html\s+no main landmark: DEBT 74/.test(l)));
  assert.ok(lines.some(l => /masked\s+\/a\.html\s+by server-port/.test(l)));
  assert.ok(lines.some(l => /worst\s+\/a\.html\s+"Hi" 5\.2:1/.test(l)));
  assert.ok(lines.some(l => /forced colours: 1 page\(s\), 3 controls and 9 texts/.test(l)));
});

test('the contrast line says how many boxes it measured of how many it found, and names a page it cut short', () => {
  const page = (path, boxes, found) => ({ path, a11y: { contrast: { boxes, found, worst: { text: 'x', ratio: 5, need: 4.5 } } } });
  const all = a11ySummary([page('/a.html', 322, 322)], { contrast: true });
  assert.ok(all.some(l => /contrast: 1 page\(s\) with words over a canvas, 322 of 322 text boxes measured/.test(l)));
  assert.ok(!all.some(l => /cut/.test(l)));
  const cut = a11ySummary([page('/a.html', 80, 322), page('/b.html', 10, 10)], { contrast: true });
  assert.ok(cut.some(l => /90 of 332 text boxes measured/.test(l)));
  assert.ok(cut.some(l => /cut\s+\/a\.html\s+80 of 322 text boxes measured, the rest were not judged/.test(l)));
});

test('found survives summaryOf, the path the JSON takes: a page cut short prints its cut line from the real summary, not a hand-built one', () => {
  const contrast = { canvases: 1, boxes: 80, found: 322, worst: { text: 'x', ratio: 5, need: 4.5 } };
  const a11y = summaryOf({ desktop: { contrast }, forced: null }, {});
  assert.equal(a11y.contrast.found, 322, 'summaryOf kept found (it used to drop it, so every line read N of N)');
  const lines = a11ySummary([{ path: '/a.html', a11y }], { contrast: true });
  assert.ok(lines.some(l => /cut\s+\/a\.html\s+80 of 322 text boxes measured/.test(l)), lines.join(' | '));
});

test('forced colours: a glyph or painted pseudo-element counts as left, and a named exemption is listed, not failed', () => {
  const base = { hasText: false, border: false, outline: false, graphic: false, native: false };
  const glyph = { ...base, label: 'button.play', pseudo: true };
  const otp = { ...base, label: 'input#code', pseudo: false };
  assert.deepEqual(judgeForced({ controls: [glyph] }).problems, []);
  const r = judgeForced({ controls: [glyph, otp] }, ['input#code']);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.exempted, ['input#code has nothing left under forced colours']);
  assert.equal(judgeForced({ controls: [otp] }, ['button.other']).problems.length, 1, 'an exemption for another control does not cover this one');
});

test('exemptions carry control labels for the forced pass', () => {
  const rules = [{ match: '^/a\.html$', controls: ['input#code'], reason: 'DEBT 75' }, { match: '^/a\.html$', main: true, reason: 'DEBT 74' }];
  assert.deepEqual(exemptionsFor('/a.html', rules), { controls: ['input#code'], main: 'DEBT 74' });
  assert.deepEqual(exemptionsFor('/b.html', rules), {});
});
